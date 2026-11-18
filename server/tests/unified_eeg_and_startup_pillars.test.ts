import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { getApp, makeAdmin, registerUser, resetDatabase, type TestClient } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

async function createVerifiedProfessional(
  username: string,
  type: 'HEALTHCARE_PROFESSIONAL' | 'RESEARCHER',
  title: string,
) {
  const userClient = await registerUser({ username, displayName: title });
  const admin = await registerUser({ username: `adm_${username}` });
  await makeAdmin(admin.user.id);

  const profRes = await userClient
    .post('/api/users/me/professional', {
      type,
      title,
      specialty: type === 'HEALTHCARE_PROFESSIONAL' ? 'Thần kinh học & Đột quỵ' : 'BCI & qEEG',
      institution: 'Bệnh viện Đại học Y',
      licenseOrOrcidNumber: type === 'HEALTHCARE_PROFESSIONAL' ? '012345/BYT-CCHN' : '0000-0002-1825-0097',
      requestVerification: true,
    })
    .expect(200);

  await admin
    .patch(`/api/admin/verifications/${profRes.body.profile.id}`, {
      status: 'VERIFIED',
      note: 'Verified for integration test',
    })
    .expect(200);

  return { client: userClient, admin };
}

function generateSyntheticEegCsv(rows = 250, sfreq = 250): string {
  const lines = ['F3,F4,C3,C4,O1,O2'];
  for (let i = 0; i < rows; i++) {
    const t = i / sfreq;
    const f3 = 8 * Math.sin(2 * Math.PI * 10 * t) + 3 * Math.sin(2 * Math.PI * 50 * t);
    const f4 = 8 * Math.sin(2 * Math.PI * 10.2 * t) + 3 * Math.sin(2 * Math.PI * 50 * t);
    const c3 = 10 * Math.sin(2 * Math.PI * 10 * t + 0.3);
    const c4 = 10 * Math.sin(2 * Math.PI * 10 * t + 0.2);
    const o1 = 24 * Math.sin(2 * Math.PI * 10.2 * t);
    const o2 = 25 * Math.sin(2 * Math.PI * 10.2 * t + 0.1);
    lines.push([f3, f4, c3, c4, o1, o2].map((v) => v.toFixed(3)).join(','));
  }
  return lines.join('\n');
}

describe('Unified qEEG Workstation, Neural DB & 4 Startup Pillars', () => {
  it('serves /clinical-workstation with workstation CSP and executes qEEG DSP analysis, CSV ingestion, PDF export & save-to-platform', async () => {
    const app = getApp();

    // 1. Clinical Workstation HTML & tailored CSP
    const wsRes = await request(app).get('/clinical-workstation').expect(200);
    expect(wsRes.headers['content-type']).toContain('text/html');
    const csp = String(wsRes.headers['content-security-policy'] ?? '');
    expect(csp).toContain('fonts.googleapis.com');
    expect(csp).toContain('cdn.tailwindcss.com');
    expect(csp).toContain('unpkg.com');
    expect(csp).toContain('cdnjs.cloudflare.com');

    // 2. qEEG health & cases across all 4 categories
    const healthRes = await request(app).get('/api/qeeg/health').expect(200);
    expect(healthRes.body.status).toBe('ok');
    expect(['python_qeeg_service', 'ts_dsp_fallback']).toContain(healthRes.body.engineSource);
    expect(healthRes.body.categories).toEqual(
      expect.arrayContaining(['VASCULAR_STROKE', 'EPILEPSY_ICU', 'SLEEP_COGNITIVE', 'HARDWARE_BCI']),
    );

    const casesRes = await request(app).get('/api/qeeg/cases').expect(200);
    expect(casesRes.body.cases.length).toBeGreaterThanOrEqual(6);
    const categories = new Set(casesRes.body.cases.map((c: any) => c.clinicalCategory));
    expect(categories.size).toBe(4);

    // 3. Analyze cases (Ischemia, ICH lockout, Healthy Control)
    const ichRes = await request(app)
      .post('/api/qeeg/analyze-case')
      .send({ caseId: 'case_ich_hemorrhage', timeWindowSec: 6, notch50Hz: true })
      .expect(200);
    expect(ichRes.body.status).toBe('SUCCESS');
    expect(ichRes.body.classificationLabel).toBe('HEMORRHAGIC_STROKE');
    expect(ichRes.body.trafficLight).toBe('purple');
    expect(ichRes.body.biomarkers.tpaLockoutTriggered).toBe(true);
    expect(ichRes.body.featureVector80).toHaveLength(80);
    expect(ichRes.body.topomap).toHaveLength(19);
    expect(ichRes.body.waveforms.channels).toHaveLength(6);

    const ischemiaRes = await request(app)
      .post('/api/qeeg/analyze-case')
      .send({ caseId: 'case_ischemia_lvo', timeWindowSec: 6 })
      .expect(200);
    expect(ischemiaRes.body.classificationLabel).toBe('ISCHEMIC_STROKE');
    expect(ischemiaRes.body.trafficLight).toBe('red');
    expect(ischemiaRes.body.biomarkers.meanDar).toBeGreaterThanOrEqual(3.0);
    expect(ischemiaRes.body.biomarkers.meanBsi).toBeGreaterThanOrEqual(0.2);

    const healthyRes = await request(app)
      .post('/api/qeeg/analyze-case')
      .send({ caseId: 'case_healthy_alpha', timeWindowSec: 6 })
      .expect(200);
    expect(healthyRes.body.classificationLabel).toBe('CONTROL');
    expect(healthyRes.body.trafficLight).toBe('green');
    expect(healthyRes.body.biomarkers.alphaPeakHz).toBeGreaterThanOrEqual(8);
    expect(healthyRes.body.biomarkers.alphaPeakHz).toBeLessThanOrEqual(13);

    // 4. Analyze uploaded CSV
    const csvRes = await request(app)
      .post('/api/qeeg/analyze-csv')
      .send({
        filename: 'test_alpha_250hz.csv',
        csvText: generateSyntheticEegCsv(300, 250),
        samplingRateHz: 250,
        clinicalCategory: 'HARDWARE_BCI',
      })
      .expect(200);
    expect(csvRes.body.status).toBe('SUCCESS');
    expect(csvRes.body.featureVector80).toHaveLength(80);
    expect(csvRes.body.topomap).toHaveLength(19);
    expect(csvRes.body.biomarkers.alphaPeakHz).toBeGreaterThanOrEqual(8.5);

    // Reject too-short CSV
    await request(app)
      .post('/api/qeeg/analyze-csv')
      .send({ filename: 'bad.csv', csvText: 'F3,F4\n1,2\n3,4' })
      .expect(400);

    // 5. PDF export fallback produces valid %PDF binary
    const pdfRes = await request(app)
      .get('/api/qeeg/export-pdf-summary?caseId=case_ich_hemorrhage')
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');
    const pdfText = (pdfRes.body as Buffer).toString('latin1');
    expect(pdfText.startsWith('%PDF-1.')).toBe(true);
    expect(pdfText.trim().endsWith('%%EOF')).toBe(true);

    // 6. Save to platform requires auth + deidentifiedConfirmed === true
    await request(app)
      .post('/api/qeeg/save-to-platform')
      .send({
        title: 'Unauth test',
        clinicalCategory: 'VASCULAR_STROKE',
        groundTruthLabel: 'ISCHEMIC_STROKE',
        deidentifiedConfirmed: true,
        analysis: ischemiaRes.body,
      })
      .expect(401);

    const user = await registerUser({ username: 'qeeg_user' });
    await user
      .post('/api/qeeg/save-to-platform', {
        title: 'Missing deidentification',
        clinicalCategory: 'VASCULAR_STROKE',
        groundTruthLabel: 'ISCHEMIC_STROKE',
        deidentifiedConfirmed: false,
        analysis: ischemiaRes.body,
      })
      .expect(400);

    const saved = await user
      .post('/api/qeeg/save-to-platform', {
        title: 'Bản ghi LVO từ Trạm qEEG',
        clinicalCategory: 'VASCULAR_STROKE',
        groundTruthLabel: 'ISCHEMIC_STROKE',
        split: 'VALIDATION',
        deidentifiedConfirmed: true,
        analysis: ischemiaRes.body,
      })
      .expect(201);

    expect(saved.body.dataset.ownerId).toBe(user.user.id);
    expect(saved.body.sample.datasetId).toBe(saved.body.dataset.id);
    expect(saved.body.sample.featureVector).toHaveLength(80);
    expect(saved.body.sample.deidentifiedConfirmed).toBe(true);

    // Confirm dataset appears in My EEG and sample appears in Neural DB
    const myDatasets = await user.get('/api/eeg-datasets/my').expect(200);
    expect(myDatasets.body.datasets.some((d: any) => d.id === saved.body.dataset.id)).toBe(true);

    const samplesRes = await user.get('/api/neural-db/samples').expect(200);
    expect(samplesRes.body.samples.some((s: any) => s.id === saved.body.sample.id)).toBe(true);
  });

  it('enforces Neural DB de-identification, professional verification, stats aggregation, and CSV/JSONL export', async () => {
    const { client: doctor } = await createVerifiedProfessional(
      'dr_neural',
      'HEALTHCARE_PROFESSIONAL',
      'BS. CKII Thần kinh',
    );
    const general = await registerUser({ username: 'gen_neural' });

    const analysis = (
      await request(getApp())
        .post('/api/qeeg/analyze-case')
        .send({ caseId: 'case_epilepsy_temporal' })
        .expect(200)
    ).body;

    // Must enforce deidentifiedConfirmed === true
    await general
      .post('/api/neural-db/samples', {
        subjectCode: 'BN-TEST-01',
        clinicalCategory: 'EPILEPSY_ICU',
        groundTruthLabel: 'EPILEPTIFORM_SLOWING',
        dar: analysis.biomarkers.meanDar,
        bsi: analysis.biomarkers.meanBsi,
        tar: analysis.biomarkers.meanTar,
        spectralBands: analysis.bandPowers,
        featureVector: analysis.featureVector80,
        waveformPreview: analysis.waveforms,
        deidentifiedConfirmed: false,
      })
      .expect(400);

    const created = await general
      .post('/api/neural-db/samples', {
        subjectCode: 'BN-ANON-77',
        clinicalCategory: 'EPILEPSY_ICU',
        groundTruthLabel: 'EPILEPTIFORM_SLOWING',
        split: 'TRAIN',
        dar: analysis.biomarkers.meanDar,
        bsi: analysis.biomarkers.meanBsi,
        tar: analysis.biomarkers.meanTar,
        pri: analysis.biomarkers.pri,
        wpli: analysis.biomarkers.wpli,
        spectralBands: analysis.bandPowers,
        featureVector: analysis.featureVector80,
        waveformPreview: {
          time: analysis.waveforms.time.slice(0, 50),
          channels: analysis.waveforms.channels,
          filtered: Object.fromEntries(
            Object.entries(analysis.waveforms.filtered).map(([k, v]) => [k, (v as number[]).slice(0, 50)]),
          ),
        },
        deidentifiedConfirmed: true,
      })
      .expect(201);

    const sampleId = created.body.sample.id;
    expect(created.body.sample.verifiedById).toBeNull();

    // General user cannot verify sample
    const failVerify = await general.patch(`/api/neural-db/samples/${sampleId}/verify`, {}).expect(403);
    expect(failVerify.body.error.code).toBe('PROFESSIONAL_VERIFICATION_REQUIRED');

    // Verified doctor can verify and adjust split/label
    const verified = await doctor
      .patch(`/api/neural-db/samples/${sampleId}/verify`, {
        groundTruthLabel: 'EPILEPTIFORM_SLOWING',
        split: 'TEST',
      })
      .expect(200);
    expect(verified.body.sample.verifiedById).toBe(doctor.user.id);
    expect(verified.body.sample.split).toBe('TEST');

    // Stats & verifiedOnly filter
    const stats = (await doctor.get('/api/neural-db/stats').expect(200)).body;
    expect(stats.totalSamples).toBe(1);
    expect(stats.verifiedSamples).toBe(1);
    expect(stats.byLabel.EPILEPTIFORM_SLOWING).toBe(1);
    expect(stats.byCategory.EPILEPSY_ICU).toBe(1);
    expect(stats.bySplit.TEST).toBe(1);

    const verifiedOnly = await doctor.get('/api/neural-db/samples?verifiedOnly=true').expect(200);
    expect(verifiedOnly.body.samples).toHaveLength(1);

    // Export CSV & JSONL with numeric class label 0..4
    const csvExport = await doctor.get('/api/neural-db/export?format=csv').expect(200);
    expect(csvExport.headers['content-type']).toContain('text/csv');
    const csvLines = csvExport.text.trim().split('\n');
    expect(csvLines[0]).toContain('sample_id,subject_code,clinical_category,ground_truth_label,label_id');
    expect(csvLines[0]).toContain('f79');
    expect(csvLines[1]).toContain('EPILEPTIFORM_SLOWING,3,TEST,true');

    const jsonlExport = await doctor.get('/api/neural-db/export?format=jsonl').expect(200);
    const parsedLine = JSON.parse(jsonlExport.text.trim().split('\n')[0]!);
    expect(parsedLine.labelId).toBe(3);
    expect(parsedLine.featureVector).toHaveLength(80);
  });

  it('grants idempotent +250 STARTER_GRANT credits via /api/rewards/claim-onboarding-grant without affecting initial balance=0', async () => {
    const user = await registerUser({ username: 'onboarding_user' });

    // Initial wallet must start at 0 (preserving existing reward tests)
    const initialWallet = (await user.get('/api/rewards/wallet').expect(200)).body.wallet;
    expect(initialWallet.balance).toBe(0);

    // First claim -> +250
    const first = (await user.post('/api/rewards/claim-onboarding-grant').expect(200)).body;
    expect(first.granted).toBe(true);
    expect(first.amount).toBe(250);
    expect(first.wallet.balance).toBe(250);

    // Second claim -> idempotent no-op
    const second = (await user.post('/api/rewards/claim-onboarding-grant').expect(200)).body;
    expect(second.granted).toBe(false);
    expect(second.amount).toBe(0);
    expect(second.wallet.balance).toBe(250);

    const walletAfter = (await user.get('/api/rewards/wallet').expect(200)).body;
    expect(walletAfter.transactions).toHaveLength(1);
    expect(walletAfter.transactions[0].type).toBe('STARTER_GRANT');
  });

  it('executes Startup Pillar 1 (Consultations) escrow, red-flag detection, claim, reply, and acceptance bounty payout', async () => {
    const requester = await registerUser({ username: 'patient_triage' });
    const generalOther = await registerUser({ username: 'non_doc' });
    const { client: residentDoc } = await createVerifiedProfessional(
      'bs_khang_test',
      'HEALTHCARE_PROFESSIONAL',
      'Bác sĩ Nội trú Thần kinh (Ngoài giờ)',
    );

    // Claim 250 starter credits
    await requester.post('/api/rewards/claim-onboarding-grant').expect(200);

    // Cannot create ticket with bounty exceeding balance
    const overBounty = await requester
      .post('/api/consultations', {
        title: 'Hỏi đáp vượt quá số dư ví tín chỉ',
        symptomSummary: 'Kiểm tra bảo vệ chống chi vượt số dư ví khi ký quỹ.',
        clinicalCategory: 'SLEEP_COGNITIVE',
        bountyCredits: 400,
      })
      .expect(400);
    expect(overBounty.body.error.code).toBe('INSUFFICIENT_CREDITS');

    // Attach high-DAR/BSI sample -> auto urgentRedFlag = true
    const strokeAnalysis = (
      await request(getApp())
        .post('/api/qeeg/analyze-case')
        .send({ caseId: 'case_ischemia_lvo' })
        .expect(200)
    ).body;

    const sampleRes = await requester
      .post('/api/neural-db/samples', {
        subjectCode: 'TRIAGE-LVO-1',
        clinicalCategory: 'VASCULAR_STROKE',
        groundTruthLabel: 'ISCHEMIC_STROKE',
        dar: 3.65,
        bsi: 0.28,
        tar: strokeAnalysis.biomarkers.meanTar,
        spectralBands: strokeAnalysis.bandPowers,
        featureVector: strokeAnalysis.featureVector80,
        waveformPreview: strokeAnalysis.waveforms,
        deidentifiedConfirmed: true,
      })
      .expect(201);

    const ticketRes = await requester
      .post('/api/consultations', {
        title: 'Yếu nửa người phải, nhờ bác sĩ trực đọc nhanh qEEG',
        symptomSummary: 'Khởi phát đột ngột 60 phút trước, đã đo qEEG 6 kênh tại trạm y tế.',
        clinicalCategory: 'VASCULAR_STROKE',
        bountyCredits: 100,
        neuralSampleId: sampleRes.body.sample.id,
      })
      .expect(201);

    const ticketId = ticketRes.body.ticket.id;
    expect(ticketRes.body.ticket.urgentRedFlag).toBe(true);
    expect(ticketRes.body.remainingBalance).toBe(150);

    // General user cannot claim
    await generalOther.post(`/api/consultations/${ticketId}/claim`).expect(403);

    // Verified requester cannot claim own ticket
    const { client: verifiedRequester } = await createVerifiedProfessional(
      'dr_self_triage',
      'HEALTHCARE_PROFESSIONAL',
      'Bác sĩ Tự hỏi',
    );
    await verifiedRequester.post('/api/rewards/claim-onboarding-grant').expect(200);
    const selfTicket = (
      await verifiedRequester
        .post('/api/consultations', {
          title: 'Kiểm tra tự nhận phiếu của chính mình',
          symptomSummary: 'Đảm bảo người tạo phiếu không thể tự nhận bounty của chính mình.',
          clinicalCategory: 'EPILEPSY_ICU',
          bountyCredits: 50,
        })
        .expect(201)
    ).body.ticket;
    const selfClaim = await verifiedRequester.post(`/api/consultations/${selfTicket.id}/claim`).expect(403);
    expect(selfClaim.body.error.code).toBe('SELF_CLAIM_PROHIBITED');

    // Resident doc claims -> replies -> requester accepts -> +100 CONSULTATION_EARNING
    const claimed = await residentDoc.post(`/api/consultations/${ticketId}/claim`).expect(200);
    expect(claimed.body.ticket.status).toBe('CLAIMED');

    const replied = await residentDoc
      .post(`/api/consultations/${ticketId}/replies`, {
        waveAnalysisText: 'DAR 3.65 và BSI 0.28 cho thấy sóng chậm Delta khu trú bán cầu trái.',
        clinicalGuidanceText: 'Kích hoạt báo động Code Stroke và chuyển chụp CT sọ não không cản quang ngay.',
        recommendedFollowUp: 'Kiểm tra cửa sổ tiêu sợi huyết r-tPA tại đơn vị Đột quỵ.',
      })
      .expect(201);
    expect(replied.body.ticket.status).toBe('ANSWERED');
    expect(replied.body.reply.responderTier).toContain('Bác sĩ Nội trú');

    // Non-requester cannot accept
    await residentDoc
      .post(`/api/consultations/${ticketId}/accept/${replied.body.reply.id}`, { rating: 5 })
      .expect(403);

    const accepted = await requester
      .post(`/api/consultations/${ticketId}/accept/${replied.body.reply.id}`, { rating: 5 })
      .expect(200);
    expect(accepted.body.ticket.status).toBe('ACCEPTED');
    expect(accepted.body.ticket.acceptedReplyId).toBe(replied.body.reply.id);

    const docWallet = (await residentDoc.get('/api/rewards/wallet').expect(200)).body;
    expect(docWallet.wallet.balance).toBe(100);
    expect(docWallet.transactions[0].type).toBe('CONSULTATION_EARNING');

    // Scope queries
    const mineTickets = (await requester.get('/api/consultations?scope=mine').expect(200)).body.tickets;
    expect(mineTickets.some((t: any) => t.id === ticketId)).toBe(true);
    const queueTickets = (await residentDoc.get('/api/consultations?scope=queue').expect(200)).body.tickets;
    expect(queueTickets.some((t: any) => t.id === selfTicket.id)).toBe(true);
  });

  it('enforces Startup Pillar 2 (Data Bank) paywall redaction and atomic buyer debit / author royalty', async () => {
    const { client: researcher } = await createVerifiedProfessional(
      'prof_databank',
      'RESEARCHER',
      'PGS. TS. Lab BCI',
    );
    const buyer = await registerUser({ username: 'buyer_bme' });

    // General user cannot publish listing
    await buyer
      .post('/api/databank', {
        title: 'Unauthorized listing',
        summary: 'Should fail for unverified user',
        clinicalCategory: 'HARDWARE_BCI',
        methodologyNote: 'Methodology text',
        sampleCount: 10,
        channelsSpec: '6 channels',
        samplingRateHz: 500,
        priceCredits: 50,
        previewMetrics: { meanDar: 1.1, meanBsi: 0.05, meanTar: 1.2, meanWpli: 0.4, dominantBand: 'Alpha' },
        payloadCsv: 'F3,F4\n1,2',
      })
      .expect(403);

    const paidCsv = 'timestamp,F3,F4\n0.002,12.4,-9.1\n0.004,13.1,-8.7';
    const paidRes = await researcher
      .post('/api/databank', {
        title: 'Gói dữ liệu ADS1299 6 kênh chuẩn hóa',
        summary: 'Gói dữ liệu có phí kèm thông số tiền xử lý đầy đủ.',
        clinicalCategory: 'HARDWARE_BCI',
        methodologyNote: 'Ghi ở 500 Hz, lọc thông dải 0.5-45 Hz và Notch 50 Hz.',
        sampleCount: 32,
        channelsSpec: '6 kênh (F3, F4, C3, C4, O1, O2)',
        samplingRateHz: 500,
        priceCredits: 120,
        previewMetrics: { meanDar: 0.85, meanBsi: 0.05, meanTar: 0.9, meanWpli: 0.38, dominantBand: 'Alpha' },
        payloadCsv: paidCsv,
      })
      .expect(201);
    const paidId = paidRes.body.listing.id;

    const freeRes = await researcher
      .post('/api/databank', {
        title: 'Mẫu mở đối chứng sóng Alpha',
        summary: 'Gói dữ liệu miễn phí cho sinh viên thực hành.',
        clinicalCategory: 'SLEEP_COGNITIVE',
        methodologyNote: 'Mắt nhắm nghỉ ngơi 5 phút.',
        sampleCount: 10,
        channelsSpec: '6 kênh 10-20',
        samplingRateHz: 250,
        priceCredits: 0,
        previewMetrics: { meanDar: 0.6, meanBsi: 0.04, meanTar: 0.7, meanWpli: 0.42, dominantBand: 'Alpha' },
        payloadCsv: 'timestamp,O1,O2\n0.004,22.1,21.8',
      })
      .expect(201);
    const freeId = freeRes.body.listing.id;

    // Paywall check before purchase: paid payloadCsv MUST be null in both list & detail
    const listBefore = (await buyer.get('/api/databank').expect(200)).body.listings;
    const paidInList = listBefore.find((l: any) => l.id === paidId);
    const freeInList = listBefore.find((l: any) => l.id === freeId);
    expect(paidInList.hasAccess).toBe(false);
    expect(paidInList.payloadCsv).toBeNull();
    expect(freeInList.hasAccess).toBe(true);
    expect(freeInList.payloadCsv).toContain('O1,O2');

    const detailBefore = (await buyer.get(`/api/databank/${paidId}`).expect(200)).body.listing;
    expect(detailBefore.hasAccess).toBe(false);
    expect(detailBefore.payloadCsv).toBeNull();

    // Insufficient credits check
    await buyer.post(`/api/databank/${paidId}/purchase`).expect(400);

    // Grant 250 credits and purchase
    await buyer.post('/api/rewards/claim-onboarding-grant').expect(200);
    const purchaseRes = (await buyer.post(`/api/databank/${paidId}/purchase`).expect(200)).body;
    expect(purchaseRes.remainingBalance).toBe(130);
    expect(purchaseRes.listing.hasAccess).toBe(true);
    expect(purchaseRes.listing.payloadCsv).toBe(paidCsv);
    expect(purchaseRes.listing.downloadsCount).toBe(1);

    // Author received +120 royalty
    const authorWallet = (await researcher.get('/api/rewards/wallet').expect(200)).body;
    expect(authorWallet.wallet.balance).toBe(120);
    expect(authorWallet.transactions[0].type).toBe('DATABANK_ROYALTY');

    // Detail now exposes payloadCsv; duplicate purchase returns 409
    const detailAfter = (await buyer.get(`/api/databank/${paidId}`).expect(200)).body.listing;
    expect(detailAfter.hasAccess).toBe(true);
    expect(detailAfter.payloadCsv).toBe(paidCsv);
    await buyer.post(`/api/databank/${paidId}/purchase`).expect(409);
  });

  it('supports Startup Pillar 3 (Self-Service) health check-ins & work-plan CRUD with ownership enforcement, and Pillar 4 (Community Spotlight) ranking', async () => {
    const owner = await registerUser({ username: 'self_owner' });
    const intruder = await registerUser({ username: 'self_intruder' });

    // Check-in & Work block CRUD
    const checkInRes = await owner
      .post('/api/self-service/check-ins', {
        focusScore: 88,
        fatigueIndexTar: 1.08,
        hemisphericBsi: 0.041,
        alphaPeakHz: 10.4,
        sleepHours: 7.5,
        stressLevel: 3,
        notes: 'Giấc ngủ đủ giúp nhịp Alpha ổn định.',
      })
      .expect(201);
    expect(checkInRes.body.checkIn.focusScore).toBe(88);

    const blockRes = await owner
      .post('/api/self-service/work-plan', {
        dayOfWeek: 'Thứ 2',
        timeSlot: '08:30 - 10:30',
        title: 'Phân tích số liệu qEEG tập trung cao',
        blockType: 'DEEP_WORK',
        eegRationale: 'TAR = 1.08 và Alpha Peak = 10.4 Hz tối ưu cho nhận thức sâu.',
      })
      .expect(201);
    const blockId = blockRes.body.block.id;

    const overview = (await owner.get('/api/self-service/overview').expect(200)).body;
    expect(overview.checkIns).toHaveLength(1);
    expect(overview.workPlan).toHaveLength(1);

    // Intruder cannot PATCH or DELETE owner's work block
    await intruder.patch(`/api/self-service/work-plan/${blockId}`, { completed: true }).expect(403);
    await intruder.del(`/api/self-service/work-plan/${blockId}`).expect(403);

    const updatedBlock = (
      await owner.patch(`/api/self-service/work-plan/${blockId}`, { completed: true }).expect(200)
    ).body.block;
    expect(updatedBlock.completed).toBe(true);
    await owner.del(`/api/self-service/work-plan/${blockId}`).expect(204);

    // Startup Pillar 4: Community Spotlight ranking from real DB metrics
    const { client: topDoc } = await createVerifiedProfessional(
      'dr_spotlight_top',
      'HEALTHCARE_PROFESSIONAL',
      'BS. CKII Đột quỵ',
    );
    const { client: midRes } = await createVerifiedProfessional(
      'prof_spotlight_mid',
      'RESEARCHER',
      'TS. Xử lý tín hiệu',
    );

    // TopDoc publishes 2 posts, gets liked + followed, and completes 1 accepted consultation
    const p1 = (await topDoc.post('/api/posts', { content: 'Chia sẻ lâm sàng qEEG đột quỵ #1' }).expect(201)).body
      .post;
    await topDoc.post('/api/posts', { content: 'Chia sẻ lâm sàng qEEG đột quỵ #2' }).expect(201);
    await owner.post(`/api/posts/${p1.id}/like`).expect(200);
    await intruder.post(`/api/posts/${p1.id}/like`).expect(200);
    await owner.post(`/api/users/${topDoc.user.id}/follow`).expect(200);

    const ticket = (
      await owner
        .post('/api/consultations', {
          title: 'Tư vấn đọc chỉ số sóng não',
          symptomSummary: 'Nhờ bác sĩ kiểm tra chỉ số Alpha chẩm.',
          clinicalCategory: 'SLEEP_COGNITIVE',
          bountyCredits: 0,
        })
        .expect(201)
    ).body.ticket;
    const rep = (
      await topDoc
        .post(`/api/consultations/${ticket.id}/replies`, {
          waveAnalysisText: 'Nhịp Alpha ổn định ở 10.2 Hz.',
          clinicalGuidanceText: 'Không thấy dấu hiệu bất thường khu trú.',
          recommendedFollowUp: 'Duy trì nhịp sinh hoạt hiện tại.',
        })
        .expect(201)
    ).body.reply;
    await owner.post(`/api/consultations/${ticket.id}/accept/${rep.id}`, { rating: 5 }).expect(200);

    // MidRes publishes 1 DataBank listing with 0 downloads
    await midRes
      .post('/api/databank', {
        title: 'Gói dữ liệu tham chiếu',
        summary: 'Tập dữ liệu nghiên cứu nội bộ.',
        clinicalCategory: 'HARDWARE_BCI',
        methodologyNote: 'Thu ở 500 Hz.',
        sampleCount: 5,
        channelsSpec: '6 kênh',
        samplingRateHz: 500,
        priceCredits: 0,
        previewMetrics: { meanDar: 0.7, meanBsi: 0.04, meanTar: 0.8, meanWpli: 0.4, dominantBand: 'Alpha' },
        payloadCsv: 'F3,F4\n1,2',
      })
      .expect(201);

    const spotlight = (await request(getApp()).get('/api/community-insights/spotlight').expect(200)).body
      .professionals;
    expect(spotlight.length).toBeGreaterThanOrEqual(2);
    expect(spotlight[0].user.username).toBe('dr_spotlight_top');
    expect(spotlight[0].metrics.publicPostsCount).toBe(2);
    expect(spotlight[0].metrics.totalLikesReceived).toBe(2);
    expect(spotlight[0].metrics.followersCount).toBe(1);
    expect(spotlight[0].metrics.consultationsCompleted).toBe(1);
    expect(spotlight[0].metrics.impactScore).toBeGreaterThan(spotlight[1].metrics.impactScore);

    void (null as unknown as TestClient);
  });
});
