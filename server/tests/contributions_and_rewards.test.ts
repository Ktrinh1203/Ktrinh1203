import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { getApp, makeAdmin, registerUser, resetDatabase, type TestClient } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

/**
 * Helper to setup a user with a verified professional profile.
 */
async function createVerifiedDoctor(username = 'dr_test') {
  const doctor = await registerUser({ username, displayName: 'Bác sĩ Thử nghiệm' });
  const admin = await registerUser({ username: `admin_${username}` });
  await makeAdmin(admin.user.id);

  // Doctor creates professional profile
  const profileRes = await doctor.post('/api/users/me/professional', {
    type: 'HEALTHCARE_PROFESSIONAL',
    title: 'Bác sĩ Thần kinh',
    specialty: 'Thần kinh học lâm sàng',
    institution: 'Bệnh viện Trung ương',
    licenseOrOrcidNumber: '088999/BYT-CCHN',
    requestVerification: true,
  }).expect(200);

  // Admin verifies it
  await admin.patch(`/api/admin/verifications/${profileRes.body.profile.id}`, {
    status: 'VERIFIED',
    note: 'Đã xác minh bằng cấp và CCHN',
  }).expect(200);

  return { doctor, admin };
}

describe('Contribution Workflow Tests', () => {
  it('allows verified professionals to submit an existing post, blocks general users', async () => {
    const { doctor } = await createVerifiedDoctor('dr_alice');
    const generalUser = await registerUser({ username: 'general_bob' });

    // Doctor creates a post
    const postRes = await doctor.post('/api/posts', {
      content: 'Nghiên cứu lâm sàng về điều trị động kinh kháng thuốc ở trẻ em.',
    }).expect(201);
    const postId = postRes.body.post.id;

    // General user creates a post and tries to submit contribution -> 403 PROFESSIONAL_VERIFICATION_REQUIRED
    const genPostRes = await generalUser.post('/api/posts', {
      content: 'Hỏi đáp thường thức về giấc ngủ.',
    }).expect(201);

    const genContribRes = await generalUser.post('/api/contributions', {
      postId: genPostRes.body.post.id,
      category: 'HEALTHCARE_EDUCATION',
      summary: 'Bài viết chia sẻ kiến thức giấc ngủ',
    }).expect(403);
    expect(genContribRes.body.error.code).toBe('PROFESSIONAL_VERIFICATION_REQUIRED');

    // Doctor submits own post -> 201 Created
    const docContribRes = await doctor.post('/api/contributions', {
      postId,
      category: 'HEALTHCARE_EDUCATION',
      summary: 'Tổng hợp phân tích ca lâm sàng điều trị động kinh kháng thuốc',
    }).expect(201);

    expect(docContribRes.body.contribution.status).toBe('SUBMITTED');
    expect(docContribRes.body.contribution.postId).toBe(postId);
  });

  it('prevents submitting another user post and prevents duplicate active submissions', async () => {
    const { doctor } = await createVerifiedDoctor('dr_charles');
    const { doctor: doctor2 } = await createVerifiedDoctor('dr_david');

    const postRes = await doctor.post('/api/posts', {
      content: 'Phương pháp phân tích tín hiệu điện não đồ EEG.',
    }).expect(201);
    const postId = postRes.body.post.id;

    // Doctor 2 tries to submit Doctor 1's post -> 403 Forbidden
    await doctor2.post('/api/contributions', {
      postId,
      category: 'RESEARCH_CONTRIBUTION',
      summary: 'Nộp bài của đồng nghiệp',
    }).expect(403);

    // Doctor 1 submits
    await doctor.post('/api/contributions', {
      postId,
      category: 'RESEARCH_CONTRIBUTION',
      summary: 'Phân tích tín hiệu điện não EEG',
    }).expect(201);

    // Doctor 1 tries to submit duplicate for the same post -> 400 DUPLICATE_SUBMISSION
    const dupRes = await doctor.post('/api/contributions', {
      postId,
      category: 'RESEARCH_CONTRIBUTION',
      summary: 'Nộp lại bài lần hai khi bài một chưa kết thúc',
    }).expect(400);
    expect(dupRes.body.error.code).toBe('DUPLICATE_SUBMISSION');
  });

  it('enforces Anti-Self-Review: Admin cannot claim or review their own contribution', async () => {
    const { doctor: adminDoc, admin } = await createVerifiedDoctor('admin_dr');
    await makeAdmin(adminDoc.user.id);

    const postRes = await adminDoc.post('/api/posts', {
      content: 'Bài viết chuyên môn do Admin sáng tác.',
    }).expect(201);

    const contribRes = await adminDoc.post('/api/contributions', {
      postId: postRes.body.post.id,
      category: 'HEALTHCARE_EDUCATION',
      summary: 'Bài viết chia sẻ y tế của Quản trị viên',
    }).expect(201);
    const contribId = contribRes.body.contribution.id;

    // AdminDoc tries to claim own contribution -> 403 SELF_REVIEW_PROHIBITED
    const selfClaimRes = await adminDoc.post(`/api/admin/rewards/contributions/${contribId}/claim`).expect(403);
    expect(selfClaimRes.body.error.code).toBe('SELF_REVIEW_PROHIBITED');

    // AdminDoc tries to review own contribution -> 403 SELF_REVIEW_PROHIBITED
    const selfReviewRes = await adminDoc.post(`/api/admin/rewards/contributions/${contribId}/review`, {
      decision: 'APPROVE',
      scoreAccuracy: 5,
      scoreRelevance: 5,
      scoreUsefulness: 5,
      scoreOriginality: 5,
      scoreImpact: 5,
      awardedCredits: 200,
      feedback: 'Tự duyệt bài của mình',
    }).expect(403);
    expect(selfReviewRes.body.error.code).toBe('SELF_REVIEW_PROHIBITED');

    // Another independent admin CAN review it
    const claimRes = await admin.post(`/api/admin/rewards/contributions/${contribId}/claim`).expect(200);
    expect(claimRes.body.contribution.status).toBe('UNDER_REVIEW');
  });

  it('enforces state machine transition rules and revision workflow', async () => {
    const { doctor, admin } = await createVerifiedDoctor('dr_elena');

    const postRes = await doctor.post('/api/posts', {
      content: 'Đột phá về giao diện não máy tính BCI.',
    }).expect(201);

    const contribRes = await doctor.post('/api/contributions', {
      postId: postRes.body.post.id,
      category: 'RESEARCH_CONTRIBUTION',
      summary: 'Tóm tắt bài báo BCI',
    }).expect(201);
    const contribId = contribRes.body.contribution.id;

    // Claim: SUBMITTED -> UNDER_REVIEW
    await admin.post(`/api/admin/rewards/contributions/${contribId}/claim`).expect(200);

    // Reviewer requests revision: UNDER_REVIEW -> NEEDS_REVISION
    const revReq = await admin.post(`/api/admin/rewards/contributions/${contribId}/review`, {
      decision: 'REQUEST_REVISION',
      scoreAccuracy: 3,
      scoreRelevance: 4,
      scoreUsefulness: 3,
      scoreOriginality: 3,
      scoreImpact: 3,
      feedback: 'Vui lòng bổ sung thêm phần thảo luận về độ trễ xử lý tín hiệu.',
    }).expect(200);
    expect(revReq.body.contribution.status).toBe('NEEDS_REVISION');

    // Doctor resubmits: NEEDS_REVISION -> SUBMITTED
    const resubmitRes = await doctor.patch(`/api/contributions/${contribId}/resubmit`, {
      summary: 'Đã bổ sung chi tiết về độ trễ giải mã tín hiệu dưới 50ms.',
    }).expect(200);
    expect(resubmitRes.body.contribution.status).toBe('SUBMITTED');

    // Admin claims again and approves: SUBMITTED -> UNDER_REVIEW -> APPROVED
    await admin.post(`/api/admin/rewards/contributions/${contribId}/claim`).expect(200);

    const approveRes = await admin.post(`/api/admin/rewards/contributions/${contribId}/review`, {
      decision: 'APPROVE',
      scoreAccuracy: 5,
      scoreRelevance: 5,
      scoreUsefulness: 5,
      scoreOriginality: 4,
      scoreImpact: 5,
      awardedCredits: 350,
      feedback: 'Bài viết rất xuất sắc sau khi bổ sung.',
    }).expect(200);

    expect(approveRes.body.contribution.status).toBe('APPROVED');
    expect(approveRes.body.contribution.awardCredits).toBe(350);

    // Verify credits were awarded to doctor's wallet
    const walletRes = await doctor.get('/api/rewards/wallet').expect(200);
    expect(walletRes.body.wallet.balance).toBe(350);
    expect(walletRes.body.wallet.totalEarned).toBe(350);
    expect(walletRes.body.transactions).toHaveLength(1);
    expect(walletRes.body.transactions[0].type).toBe('CONTRIBUTION_REWARD');
  });
});

describe('Credit Wallet, Ledger & Double-Spending Prevention', () => {
  it('records immutable credit ledger and prevents overspending or negative balance', async () => {
    const { doctor, admin } = await createVerifiedDoctor('dr_frank');

    // Admin creates an active reward catalog item
    const catalogItemRes = await admin.post('/api/admin/rewards/catalog', {
      name: 'Khóa học Đọc bản ghi EEG Nâng cao',
      description: 'Khóa học có chứng chỉ 12 tiết học trực tuyến.',
      category: 'PROFESSIONAL_COURSE',
      creditCost: 200,
      stockQuantity: 5,
    }).expect(201);
    const rewardId = catalogItemRes.body.reward.id;

    // Doctor has 0 credits initially, tries to redeem -> 400 INSUFFICIENT_CREDITS
    const failRedeem = await doctor.post('/api/rewards/redeem', {
      rewardId,
    }).expect(400);
    expect(failRedeem.body.error.code).toBe('INSUFFICIENT_CREDITS');

    // Admin adjusts doctor wallet with justified manual credit adjustment (+500 credits)
    const adjustRes = await admin.post(`/api/admin/rewards/wallets/${(await doctor.get('/api/rewards/wallet')).body.wallet.id}/adjust`, {
      amount: 500,
      reason: 'Khen thưởng đóng góp phiên phản biện xuất sắc',
    }).expect(200);
    expect(adjustRes.body.wallet.balance).toBe(500);

    // Doctor redeems reward (cost 200) -> 201 Created, remaining balance 300
    const redeemRes = await doctor.post('/api/rewards/redeem', {
      rewardId,
      userNote: 'Đăng ký tham dự lớp học tháng tới',
    }).expect(201);
    expect(redeemRes.body.remainingBalance).toBe(300);

    // Check wallet and ledger
    const walletAfter = (await doctor.get('/api/rewards/wallet').expect(200)).body;
    expect(walletAfter.wallet.balance).toBe(300);
    expect(walletAfter.wallet.totalSpent).toBe(200);
    expect(walletAfter.transactions).toHaveLength(2); // ADMIN_ADJUSTMENT and REWARD_REDEMPTION
  });

  it('automatically refunds credits when a redemption request is rejected or cancelled', async () => {
    const { doctor, admin } = await createVerifiedDoctor('dr_grace');

    // Admin grants 400 credits to doctor
    const walletId = (await doctor.get('/api/rewards/wallet')).body.wallet.id;
    await admin.post(`/api/admin/rewards/wallets/${walletId}/adjust`, {
      amount: 400,
      reason: 'Cấp hạn mức nghiên cứu',
    }).expect(200);

    // Admin creates a conference ticket reward
    const reward = (await admin.post('/api/admin/rewards/catalog', {
      name: 'Vé Hội thảo Thần kinh học 2026',
      description: 'Vé đại biểu chính thức',
      category: 'CONFERENCE_ACCESS',
      creditCost: 350,
    }).expect(201)).body.reward;

    // Doctor requests redemption (balance 400 -> 50)
    const redeemRes = await doctor.post('/api/rewards/redeem', { rewardId: reward.id }).expect(201);
    const redemptionId = redeemRes.body.redemption.id;

    expect((await doctor.get('/api/rewards/wallet')).body.wallet.balance).toBe(50);

    // Admin rejects the redemption with reason -> Credits must be automatically refunded back!
    const rejectRes = await admin.post(`/api/admin/rewards/redemptions/${redemptionId}/decision`, {
      action: 'REJECT',
      adminNote: 'Hội nghị đã hết số lượng ghế đại biểu cho chuyên ngành này.',
    }).expect(200);

    expect(rejectRes.body.redemption.status).toBe('REJECTED');

    // Doctor's balance must be back to 400 (+350 refunded)
    const walletRefunded = (await doctor.get('/api/rewards/wallet')).body;
    expect(walletRefunded.wallet.balance).toBe(400);

    // Verify REFUND transaction was recorded in the ledger
    const refundTx = walletRefunded.transactions.find((t: any) => t.type === 'REFUND');
    expect(refundTx).toBeDefined();
    expect(refundTx.amount).toBe(350);
  });

  it('strictly blocks monetary payouts when payout is not enabled (Anti-Cash-Drain Guard)', async () => {
    const { doctor, admin } = await createVerifiedDoctor('dr_henry');

    // Admin creates a monetary reward entry (isMonetary = true, payoutEnabled = false by default)
    const monetaryReward = (await admin.post('/api/admin/rewards/catalog', {
      name: 'Giải ngân tiền mặt tài trợ bài báo',
      description: 'Quy đổi tín chỉ ra tiền mặt',
      category: 'MONETARY_REWARD',
      creditCost: 500,
      isMonetary: true,
    }).expect(201)).body.reward;

    expect(monetaryReward.payoutEnabled).toBe(false);

    // Grant doctor 1000 credits
    const walletId = (await doctor.get('/api/rewards/wallet')).body.wallet.id;
    await admin.post(`/api/admin/rewards/wallets/${walletId}/adjust`, {
      amount: 1000,
      reason: 'Cấp tín chỉ thử nghiệm',
    }).expect(200);

    // Doctor attempts to redeem monetary payout -> 400 MONETARY_PAYOUT_DISABLED
    const attempt = await doctor.post('/api/rewards/redeem', {
      rewardId: monetaryReward.id,
    }).expect(400);

    expect(attempt.body.error.code).toBe('MONETARY_PAYOUT_DISABLED');

    // Balance remains unchanged
    expect((await doctor.get('/api/rewards/wallet')).body.wallet.balance).toBe(1000);
  });
});
