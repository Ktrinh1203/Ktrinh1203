import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  ClinicalCategory,
  ConsultationStatus,
  DatasetSplit,
  NeuralLabel,
  PrismaClient,
  Role,
  VerificationStatus,
  WorkBlockType,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { buildDocumentEvidenceDossier } from '../src/modules/verification/ocr.service.js';
import { PRIVATE_VERIFICATION_DIR } from '../src/middleware/uploadVerification.js';
import { analyzeCaseTs } from '../src/modules/qeeg/qeeg-dsp.engine.js';
import { verifyWalletIntegrity } from '../src/modules/rewards/ledger.crypto.js';

const prisma = new PrismaClient();

async function hash(password: string) {
  return bcrypt.hash(password, 10);
}

function createSamplePdfBuffer(textLines: string[]): Buffer {
  const header = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nstream\n';
  const body = textLines.join('\n') + '\n';
  const footer = 'endstream\n%%EOF\n';
  return Buffer.from(header + body + footer, 'utf8');
}

function saveSeedDoc(fileName: string, buffer: Buffer) {
  fs.mkdirSync(PRIVATE_VERIFICATION_DIR, { recursive: true });
  const fullPath = path.join(PRIVATE_VERIFICATION_DIR, fileName);
  fs.writeFileSync(fullPath, buffer);
  const sha256Hash = createHash('sha256').update(buffer).digest('hex');
  return {
    storagePath: fileName,
    fileName,
    mimeType: 'application/pdf',
    sizeBytes: buffer.length,
    sha256Hash,
    buffer,
  };
}

async function main() {
  console.log('[seed] Seeding demo data for PBL4_Web development...');

  // Clean existing seed data safely (hardware IoT & startup & qEEG tables first)
  await prisma.deviceRecordingSession.deleteMany();
  await prisma.deviceAlert.deleteMany();
  await prisma.deviceTelemetryLog.deleteMany();
  await prisma.hardwareDevice.deleteMany();
  await prisma.workingPlanBlock.deleteMany();
  await prisma.healthCheckIn.deleteMany();
  await prisma.consultationReply.deleteMany();
  await prisma.consultationTicket.deleteMany();
  await prisma.dataBankPurchase.deleteMany();
  await prisma.dataBankListing.deleteMany();
  await prisma.neuralTrainingSample.deleteMany();
  await prisma.payoutRequest.deleteMany();
  await prisma.paymentOrder.deleteMany();
  await prisma.rewardRedemption.deleteMany();
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "CreditTransaction", "CreditWallet" CASCADE');
  await prisma.rewardCatalog.deleteMany();
  await prisma.contributionReview.deleteMany();
  await prisma.contribution.deleteMany();
  await prisma.verificationAuditLog.deleteMany();
  await prisma.verificationDocument.deleteMany();
  await prisma.verificationRequest.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.postLike.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.postMedia.deleteMany();
  await prisma.post.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.professionalProfile.deleteMany();
  await prisma.session.deleteMany();
  await prisma.report.deleteMany();
  await prisma.user.deleteMany();

  const commonPassword = await hash('Password123');

  // 1. Admin
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@neurolink.test',
      displayName: 'Ban Quản trị NeuroLink',
      bio: 'Tài khoản điều hành và kiểm duyệt nội dung y tế & học thuật trên NeuroLink.',
      passwordHash: commonPassword,
      role: Role.ADMIN,
    },
  });

  // 2. Doctor / Neurologist
  const doctor = await prisma.user.create({
    data: {
      username: 'dr_minh',
      email: 'minh.neurologist@neurolink.test',
      displayName: 'BS. CKII Nguyễn Văn Minh',
      bio: 'Bác sĩ chuyên khoa Thần kinh tại Bệnh viện Bạch Mai. Quan tâm nghiên cứu chẩn đoán động kinh và rối loạn giấc ngủ.',
      passwordHash: commonPassword,
      role: Role.USER,
      professionalProfiles: {
        create: {
          type: 'HEALTHCARE_PROFESSIONAL',
          title: 'Bác sĩ Chuyên khoa II Thần kinh',
          specialty: 'Thần kinh học lâm sàng',
          institution: 'Bệnh viện Bạch Mai - Hà Nội',
          licenseOrOrcidNumber: '012845/BYT-CCHN',
          researchInterests: ['Động kinh', 'Rối loạn giấc ngủ', 'Điện não đồ lâm sàng (EEG)'],
          verificationStatus: VerificationStatus.VERIFIED,
          verificationNote: 'Đã xác minh chứng chỉ hành nghề số 012845/BYT-CCHN và đơn vị công tác Bệnh viện Bạch Mai',
          verifiedById: admin.id,
          verifiedAt: new Date(Date.now() - 86400000 * 5),
        },
      },
    },
    include: { professionalProfiles: true },
  });

  // 3. Researcher / Scientist
  const researcher = await prisma.user.create({
    data: {
      username: 'prof_lan',
      email: 'lan.neurosci@neurolink.test',
      displayName: 'PGS. TS. Trần Mai Lan',
      bio: 'Giảng viên & Trưởng nhóm nghiên cứu Giao diện Não - Máy tính (BCI) tại ĐHQG Hà Nội. Nghiên cứu giải mã tín hiệu thần kinh.',
      passwordHash: commonPassword,
      role: Role.USER,
      professionalProfiles: {
        create: {
          type: 'RESEARCHER',
          title: 'Phó Giáo sư, Trưởng phòng thí nghiệm BCI',
          specialty: 'Khoa học thần kinh tính toán (Computational Neuroscience)',
          institution: 'Viện Công nghệ Thông tin - Đại học Quốc gia',
          licenseOrOrcidNumber: '0000-0002-1825-0097',
          researchInterests: ['Brain-Computer Interface (BCI)', 'Deep Learning cho tín hiệu não', 'Motor Imagery'],
          verificationStatus: VerificationStatus.VERIFIED,
          verificationNote: 'Đã xác minh hồ sơ ORCID 0000-0002-1825-0097 và công bố khoa học',
          verifiedById: admin.id,
          verifiedAt: new Date(Date.now() - 86400000 * 3),
        },
      },
    },
    include: { professionalProfiles: true },
  });

  // 4. Biomedical Engineering Student (Pending verification)
  const student = await prisma.user.create({
    data: {
      username: 'tuan_bme',
      email: 'tuan.student@neurolink.test',
      displayName: 'Lê Quốc Tuấn',
      bio: 'Sinh viên năm cuối ngành Kỹ thuật Y sinh (BME), ĐH Bách Khoa. Đang làm khoá luận tốt nghiệp về phân tích sóng não alpha/beta.',
      passwordHash: commonPassword,
      role: Role.USER,
      professionalProfiles: {
        create: {
          type: 'RESEARCHER',
          title: 'Sinh viên nghiên cứu Kỹ thuật Y sinh',
          specialty: 'Kỹ thuật Y sinh & Xử lý tín hiệu y sinh',
          institution: 'Đại học Bách Khoa',
          licenseOrOrcidNumber: '0000-0003-1415-9265',
          researchInterests: ['Xử lý tín hiệu số', 'Phân loại sóng não', 'Feature Extraction'],
          verificationStatus: VerificationStatus.PENDING,
          verificationNote: 'Đang chờ thẩm định giấy chứng nhận sinh viên nghiên cứu và hồ sơ ORCID',
        },
      },
    },
    include: { professionalProfiles: true },
  });

  // 5. General User
  const generalUser = await prisma.user.create({
    data: {
      username: 'hoa_health',
      email: 'hoa@neurolink.test',
      displayName: 'Nguyễn Thanh Hoa',
      bio: 'Thành viên quan tâm đến sức khoẻ tinh thần, tối ưu hoá giấc ngủ và khoa học não bộ thường thức.',
      passwordHash: commonPassword,
      role: Role.USER,
    },
  });

  // 6. Healthcare Worker (Rejected verification -> Resubmission enabled)
  const healthcareWorker = await prisma.user.create({
    data: {
      username: 'ktv_linh',
      email: 'linh.eegtech@neurolink.test',
      displayName: 'KTV. Đặng Thùy Linh',
      bio: 'Kỹ thuật viên Điện não đồ & Thăm dò chức năng thần kinh. Đang cập nhật hồ sơ chứng chỉ hành nghề.',
      passwordHash: commonPassword,
      role: Role.USER,
      professionalProfiles: {
        create: {
          type: 'HEALTHCARE_PROFESSIONAL',
          title: 'Kỹ thuật viên Điện não đồ lâm sàng',
          specialty: 'Thăm dò chức năng thần kinh',
          institution: 'Bệnh viện Đa khoa Trung ương',
          licenseOrOrcidNumber: '008912/HNO-CCHN',
          researchInterests: ['Kỹ thuật ghi Video-EEG', 'Khử nhiễu điện cực'],
          verificationStatus: VerificationStatus.REJECTED,
          verificationNote: 'Bản chụp CCHN bị lóa sáng che khuất số hiệu và dấu mộc. Vui lòng tải lại bản scan rõ nét.',
        },
      },
    },
    include: { professionalProfiles: true },
  });

  // 7. Junior / Resident Overtime Neurologist (Verified)
  const residentDoctor = await prisma.user.create({
    data: {
      username: 'bs_noitru_khang',
      email: 'khang.noitru@neurolink.test',
      displayName: 'BS. Nội trú Lê Minh Khang',
      bio: 'Bác sĩ Nội trú Thần kinh & Hồi sức Đột quỵ tại BV Đại học Y Dược TP.HCM. Nhận đọc băng ghi qEEG từ xa ngoài giờ và sàng lọc ca trực cấp cứu.',
      passwordHash: commonPassword,
      role: Role.USER,
      professionalProfiles: {
        create: {
          type: 'HEALTHCARE_PROFESSIONAL',
          title: 'Bác sĩ Nội trú Thần kinh (Ngoài giờ)',
          specialty: 'Hồi sức Đột quỵ & Điện não đồ Cấp cứu',
          institution: 'Bệnh viện Đại học Y Dược TP.HCM',
          licenseOrOrcidNumber: '029418/HCM-CCHN',
          researchInterests: ['qEEG Cấp cứu Đột quỵ', 'NCSE trong ICU', 'Đọc sóng não từ xa'],
          verificationStatus: VerificationStatus.VERIFIED,
          verificationNote: 'Đã xác minh CCHN 029418/HCM-CCHN và phân công trực nội trú Thần kinh',
          verifiedById: admin.id,
          verifiedAt: new Date(Date.now() - 86400000 * 2),
        },
      },
    },
    include: { professionalProfiles: true },
  });

  // Seed Verification Requests, Documents & Audit Logs
  // 1) Doctor Minh (VERIFIED)
  const docMinhPdf = saveSeedDoc(
    'seed_dr_minh_cchn.pdf',
    createSamplePdfBuffer([
      'BO Y TE VIET NAM - CHUNG CHI HANH NGHE KHAM BENH CHUA BENH',
      'Họ và tên: BS. CKII Nguyễn Văn Minh',
      'Số CCHN: 012845/BYT-CCHN',
      'Phạm vi hoạt động chuyên môn: Thần kinh học lâm sàng',
      'Nơi cấp: Bộ Y tế - Bệnh viện Bạch Mai - Hà Nội',
      'Ngày cấp: 15/06/2018',
    ]),
  );
  const docMinhDossier = buildDocumentEvidenceDossier({
    buffer: docMinhPdf.buffer,
    documentType: 'MEDICAL_LICENSE',
    profileType: 'HEALTHCARE_PROFESSIONAL',
    claimedName: doctor.displayName,
    claimedSpecialty: 'Thần kinh học lâm sàng',
    claimedInstitution: 'Bệnh viện Bạch Mai - Hà Nội',
    claimedLicenseOrOrcid: '012845/BYT-CCHN',
  });

  const reqMinh = await prisma.verificationRequest.create({
    data: {
      profileId: doctor.professionalProfiles[0]!.id,
      userId: doctor.id,
      status: 'VERIFIED',
      claimedTitle: 'Bác sĩ Chuyên khoa II Thần kinh',
      claimedSpecialty: 'Thần kinh học lâm sàng',
      claimedInstitution: 'Bệnh viện Bạch Mai - Hà Nội',
      licenseOrOrcidNumber: '012845/BYT-CCHN',
      submissionNotes: 'Đính kèm bản scan Chứng chỉ hành nghề khám bệnh, chữa bệnh do Bộ Y tế cấp.',
      reviewerId: admin.id,
      reviewedAt: new Date(Date.now() - 86400000 * 5),
      reviewNotes: 'Đã đối chiếu bản scan CCHN 012845/BYT-CCHN trùng khớp hoàn toàn với thông tin khai báo.',
      documents: {
        create: {
          documentType: 'MEDICAL_LICENSE',
          storagePath: docMinhPdf.storagePath,
          fileName: 'CCHN_BS_Nguyen_Van_Minh_012845.pdf',
          mimeType: docMinhPdf.mimeType,
          sizeBytes: docMinhPdf.sizeBytes,
          sha256Hash: docMinhPdf.sha256Hash,
          ocrData: docMinhDossier as any,
        },
      },
      auditLogs: {
        create: [
          {
            actorId: doctor.id,
            action: 'SUBMIT_REQUEST',
            previousState: null,
            newState: 'PENDING_REVIEW',
            reason: 'Nộp hồ sơ xác minh Chứng chỉ hành nghề Y khoa',
            ipAddress: '127.0.0.1',
          },
          {
            actorId: admin.id,
            action: 'ADMIN_CLAIM',
            previousState: 'PENDING_REVIEW',
            newState: 'IN_REVIEW',
            reason: 'Tiếp nhận hồ sơ thẩm định',
            ipAddress: '127.0.0.1',
          },
          {
            actorId: admin.id,
            action: 'ADMIN_APPROVE',
            previousState: 'IN_REVIEW',
            newState: 'VERIFIED',
            reason: 'Đã xác minh chứng chỉ hành nghề số 012845/BYT-CCHN và đơn vị công tác Bệnh viện Bạch Mai',
            ipAddress: '127.0.0.1',
          },
        ],
      },
    },
  });

  // 2) Researcher Lan (VERIFIED)
  const docLanPdf = saveSeedDoc(
    'seed_prof_lan_orcid.pdf',
    createSamplePdfBuffer([
      'VIEN CONG NGHE THONG TIN - DAI HOC QUOC GIA HA NOI',
      'Họ và tên: PGS. TS. Trần Mai Lan',
      'ORCID: 0000-0002-1825-0097',
      'Chuyên ngành: Khoa học thần kinh tính toán (Computational Neuroscience)',
      'Đơn vị: Viện Công nghệ Thông tin - Đại học Quốc gia',
      'Ngày cấp: 10/09/2021',
    ]),
  );
  const docLanDossier = buildDocumentEvidenceDossier({
    buffer: docLanPdf.buffer,
    documentType: 'ORCID_RECORD',
    profileType: 'RESEARCHER',
    claimedName: researcher.displayName,
    claimedSpecialty: 'Khoa học thần kinh tính toán (Computational Neuroscience)',
    claimedInstitution: 'Viện Công nghệ Thông tin - Đại học Quốc gia',
    claimedLicenseOrOrcid: '0000-0002-1825-0097',
  });

  await prisma.verificationRequest.create({
    data: {
      profileId: researcher.professionalProfiles[0]!.id,
      userId: researcher.id,
      status: 'VERIFIED',
      claimedTitle: 'Phó Giáo sư, Trưởng phòng thí nghiệm BCI',
      claimedSpecialty: 'Khoa học thần kinh tính toán (Computational Neuroscience)',
      claimedInstitution: 'Viện Công nghệ Thông tin - Đại học Quốc gia',
      licenseOrOrcidNumber: '0000-0002-1825-0097',
      submissionNotes: 'Hồ sơ lý lịch khoa học kèm mã định danh ORCID quốc tế của nhóm nghiên cứu BCI.',
      reviewerId: admin.id,
      reviewedAt: new Date(Date.now() - 86400000 * 3),
      reviewNotes: 'Hồ sơ ORCID và đơn vị Viện CNTT - ĐHQGHN hợp lệ.',
      documents: {
        create: {
          documentType: 'ORCID_RECORD',
          storagePath: docLanPdf.storagePath,
          fileName: 'ORCID_Record_Prof_Tran_Mai_Lan.pdf',
          mimeType: docLanPdf.mimeType,
          sizeBytes: docLanPdf.sizeBytes,
          sha256Hash: docLanPdf.sha256Hash,
          ocrData: docLanDossier as any,
        },
      },
      auditLogs: {
        create: [
          {
            actorId: researcher.id,
            action: 'SUBMIT_REQUEST',
            previousState: null,
            newState: 'PENDING_REVIEW',
            reason: 'Nộp hồ sơ xác minh Nhà nghiên cứu học thuật',
            ipAddress: '127.0.0.1',
          },
          {
            actorId: admin.id,
            action: 'ADMIN_APPROVE',
            previousState: 'PENDING_REVIEW',
            newState: 'VERIFIED',
            reason: 'Đã xác minh hồ sơ ORCID 0000-0002-1825-0097 và công bố khoa học',
            ipAddress: '127.0.0.1',
          },
        ],
      },
    },
  });

  // 3) Student Tuan (PENDING_REVIEW)
  const docTuanPdf = saveSeedDoc(
    'seed_tuan_bme_affiliation.pdf',
    createSamplePdfBuffer([
      'DAI HOC BACH KHOA - KHOA KY THUAT Y SINH',
      'Họ và tên: Lê Quốc Tuấn',
      'ORCID: 0000-0003-1415-9265',
      'Chuyên ngành: Kỹ thuật Y sinh & Xử lý tín hiệu y sinh',
      'Đơn vị: Đại học Bách Khoa',
      'Ngày cấp: 01/10/2025',
    ]),
  );
  const docTuanDossier = buildDocumentEvidenceDossier({
    buffer: docTuanPdf.buffer,
    documentType: 'INSTITUTION_AFFILIATION',
    profileType: 'RESEARCHER',
    claimedName: student.displayName,
    claimedSpecialty: 'Kỹ thuật Y sinh & Xử lý tín hiệu y sinh',
    claimedInstitution: 'Đại học Bách Khoa',
    claimedLicenseOrOrcid: '0000-0003-1415-9265',
  });

  await prisma.verificationRequest.create({
    data: {
      profileId: student.professionalProfiles[0]!.id,
      userId: student.id,
      status: 'PENDING_REVIEW',
      claimedTitle: 'Sinh viên nghiên cứu Kỹ thuật Y sinh',
      claimedSpecialty: 'Kỹ thuật Y sinh & Xử lý tín hiệu y sinh',
      claimedInstitution: 'Đại học Bách Khoa',
      licenseOrOrcidNumber: '0000-0003-1415-9265',
      submissionNotes: 'Em xin nộp Giấy xác nhận thành viên nhóm nghiên cứu Xử lý tín hiệu y sinh và mã ORCID cá nhân để xin cấp huy hiệu Nghiên cứu viên.',
      documents: {
        create: {
          documentType: 'INSTITUTION_AFFILIATION',
          storagePath: docTuanPdf.storagePath,
          fileName: 'Giay_Xac_Nhan_NCKH_Le_Quoc_Tuan_BK.pdf',
          mimeType: docTuanPdf.mimeType,
          sizeBytes: docTuanPdf.sizeBytes,
          sha256Hash: docTuanPdf.sha256Hash,
          ocrData: docTuanDossier as any,
        },
      },
      auditLogs: {
        create: [
          {
            actorId: student.id,
            action: 'SUBMIT_REQUEST',
            previousState: null,
            newState: 'PENDING_REVIEW',
            reason: 'Nộp hồ sơ xác minh Sinh viên nghiên cứu Kỹ thuật Y sinh',
            ipAddress: '127.0.0.1',
          },
        ],
      },
    },
  });

  // 4) Healthcare Worker Linh (REJECTED -> Resubmission enabled)
  const docLinhPdf = saveSeedDoc(
    'seed_ktv_linh_cchn.pdf',
    createSamplePdfBuffer([
      'SO Y TE HA NOI',
      'Họ và tên: Đặng Thùy Linh',
      'Số CCHN: 008912/HNO-CCHN',
      'Chuyên môn: Kỹ thuật viên Điện não đồ lâm sàng',
    ]),
  );
  await prisma.verificationRequest.create({
    data: {
      profileId: healthcareWorker.professionalProfiles[0]!.id,
      userId: healthcareWorker.id,
      status: 'REJECTED',
      claimedTitle: 'Kỹ thuật viên Điện não đồ lâm sàng',
      claimedSpecialty: 'Thăm dò chức năng thần kinh',
      claimedInstitution: 'Bệnh viện Đa khoa Trung ương',
      licenseOrOrcidNumber: '008912/HNO-CCHN',
      submissionNotes: 'Nộp hồ sơ xác minh Kỹ thuật viên Y tế chuyên trách ghi đo EEG.',
      reviewerId: admin.id,
      reviewedAt: new Date(Date.now() - 86400000),
      rejectionReason: 'Bản chụp CCHN bị lóa sáng che khuất số hiệu và dấu mộc. Vui lòng tải lại bản scan rõ nét.',
      documents: {
        create: {
          documentType: 'MEDICAL_LICENSE',
          storagePath: docLinhPdf.storagePath,
          fileName: 'CCHN_KTV_Dang_Thuy_Linh_Blurred.pdf',
          mimeType: docLinhPdf.mimeType,
          sizeBytes: docLinhPdf.sizeBytes,
          sha256Hash: docLinhPdf.sha256Hash,
        },
      },
      auditLogs: {
        create: [
          {
            actorId: healthcareWorker.id,
            action: 'SUBMIT_REQUEST',
            previousState: null,
            newState: 'PENDING_REVIEW',
            reason: 'Nộp hồ sơ xác minh Kỹ thuật viên Điện não đồ',
            ipAddress: '127.0.0.1',
          },
          {
            actorId: admin.id,
            action: 'ADMIN_REJECT',
            previousState: 'PENDING_REVIEW',
            newState: 'REJECTED',
            reason: 'Bản chụp CCHN bị lóa sáng che khuất số hiệu và dấu mộc. Vui lòng tải lại bản scan rõ nét.',
            ipAddress: '127.0.0.1',
          },
        ],
      },
    },
  });

  // 5) Resident Doctor Khang (VERIFIED)
  const docKhangPdf = saveSeedDoc(
    'seed_bs_khang_cchn.pdf',
    createSamplePdfBuffer([
      'SO Y TE TP HO CHI MINH - CHUNG CHI HANH NGHE',
      'Họ và tên: BS. Nội trú Lê Minh Khang',
      'Số CCHN: 029418/HCM-CCHN',
      'Chuyên khoa: Hồi sức Đột quỵ & Điện não đồ Cấp cứu',
      'Đơn vị: Bệnh viện Đại học Y Dược TP.HCM',
    ]),
  );
  const docKhangDossier = buildDocumentEvidenceDossier({
    buffer: docKhangPdf.buffer,
    documentType: 'MEDICAL_LICENSE',
    profileType: 'HEALTHCARE_PROFESSIONAL',
    claimedName: residentDoctor.displayName,
    claimedSpecialty: 'Hồi sức Đột quỵ & Điện não đồ Cấp cứu',
    claimedInstitution: 'Bệnh viện Đại học Y Dược TP.HCM',
    claimedLicenseOrOrcid: '029418/HCM-CCHN',
  });

  await prisma.verificationRequest.create({
    data: {
      profileId: residentDoctor.professionalProfiles[0]!.id,
      userId: residentDoctor.id,
      status: 'VERIFIED',
      claimedTitle: 'Bác sĩ Nội trú Thần kinh (Ngoài giờ)',
      claimedSpecialty: 'Hồi sức Đột quỵ & Điện não đồ Cấp cứu',
      claimedInstitution: 'Bệnh viện Đại học Y Dược TP.HCM',
      licenseOrOrcidNumber: '029418/HCM-CCHN',
      submissionNotes: 'Hồ sơ CCHN bác sĩ nội trú tham gia trực đọc qEEG ngoài giờ trên NeuroLink.',
      reviewerId: admin.id,
      reviewedAt: new Date(Date.now() - 86400000 * 2),
      reviewNotes: 'Hồ sơ CCHN và đơn vị công tác BV ĐH Y Dược TP.HCM hợp lệ.',
      documents: {
        create: {
          documentType: 'MEDICAL_LICENSE',
          storagePath: docKhangPdf.storagePath,
          fileName: 'CCHN_BS_Noi_Tru_Le_Minh_Khang.pdf',
          mimeType: docKhangPdf.mimeType,
          sizeBytes: docKhangPdf.sizeBytes,
          sha256Hash: docKhangPdf.sha256Hash,
          ocrData: docKhangDossier as any,
        },
      },
      auditLogs: {
        create: [
          {
            actorId: residentDoctor.id,
            action: 'SUBMIT_REQUEST',
            previousState: null,
            newState: 'PENDING_REVIEW',
            reason: 'Nộp hồ sơ xác minh Bác sĩ Nội trú đọc qEEG ngoài giờ',
            ipAddress: '127.0.0.1',
          },
          {
            actorId: admin.id,
            action: 'ADMIN_APPROVE',
            previousState: 'PENDING_REVIEW',
            newState: 'VERIFIED',
            reason: 'Đã xác minh CCHN 029418/HCM-CCHN',
            ipAddress: '127.0.0.1',
          },
        ],
      },
    },
  });

  void reqMinh;

  // Follow relationships
  await prisma.follow.createMany({
    data: [
      { followerId: generalUser.id, followingId: doctor.id },
      { followerId: student.id, followingId: researcher.id },
      { followerId: student.id, followingId: doctor.id },
      { followerId: doctor.id, followingId: researcher.id },
      { followerId: researcher.id, followingId: doctor.id },
    ],
  });

  // Posts
  const post1 = await prisma.post.create({
    data: {
      authorId: doctor.id,
      content: `Phân biệt hiện tượng co giật do tâm lý (PNES - Psychogenic Non-Epileptic Seizures) và cơn động kinh thực tổn qua quan sát lâm sàng và ghi đo điện não video liên tục (Video-EEG monitoring).\n\nTrong thực tế lâm sàng, có tới 20-30% bệnh nhân được chuyển đến các trung tâm động kinh chuyên sâu thực chất mắc PNES. Việc chẩn đoán nhầm dẫn đến điều trị thuốc kháng động kinh kéo dài không cần thiết.\n\nCác bạn đồng nghiệp có kinh nghiệm kết hợp test kích hoạt (provocative testing) trong các ca này xin cùng thảo luận!`,
      createdAt: new Date(Date.now() - 86400000 * 5),
    },
  });

  const post2 = await prisma.post.create({
    data: {
      authorId: researcher.id,
      content: `Nhóm nghiên cứu BCI của chúng tôi vừa hoàn thành thử nghiệm tiền lâm sàng về mô hình Spatial-Temporal Transformer để giải mã ý định vận động (Motor Imagery) từ các điện cực C3, Cz, C4.\n\nKết quả cho thấy độ chính xác phân loại 4 lớp chuyển động tay/chân đạt trên 86.4% với độ trễ xử lý dưới 50ms, mở ra triển vọng cho các thiết bị hỗ trợ phục hồi chức năng sau đột quỵ.\n\nSinh viên và các nhà nghiên cứu quan tâm có thể nhắn tin trao đổi về hướng hợp tác này!`,
      createdAt: new Date(Date.now() - 86400000 * 3),
    },
  });

  const post3 = await prisma.post.create({
    data: {
      authorId: student.id,
      content: `Em đang tìm hiểu về thuật toán Common Spatial Pattern (CSP) kết hợp bộ lọc Filter Bank (FBCSP) trong tiền xử lý tín hiệu não. Cho em hỏi các thầy cô và anh chị có kinh nghiệm thường chọn dải tần số nào là tối ưu nhất cho dải mu (8-12Hz) và beta (16-24Hz) khi người dùng tưởng tượng nắm tay ạ?`,
      createdAt: new Date(Date.now() - 86400000),
    },
  });

  // Comments
  await prisma.comment.create({
    data: {
      postId: post1.id,
      authorId: researcher.id,
      content:
        'Cảm ơn BS Minh đã chia sẻ góc nhìn lâm sàng rất rõ nét. Bên nhóm nghiên cứu của tôi cũng đang tìm cách ứng dụng phát hiện bất đối xứng bán cầu để hỗ trợ phân loại sơ bộ trước khi bác sĩ đọc băng ghi dài.',
      createdAt: new Date(Date.now() - 86400000 * 4),
    },
  });

  await prisma.comment.create({
    data: {
      postId: post3.id,
      authorId: researcher.id,
      content:
        'Chào Tuấn, thông thường với FBCSP người ta chia thành các sub-band 4Hz chồng lấn nhẹ (ví dụ 4-8, 8-12, 12-16... đến 36-40Hz), sau đó dùng Mutual Information để tự động chọn lọc các dải có tính phân tách cao nhất.',
      createdAt: new Date(Date.now() - 3600000 * 9),
    },
  });

  await prisma.comment.create({
    data: {
      postId: post3.id,
      authorId: doctor.id,
      content:
        'Ngoài lý thuyết tín hiệu, trên lâm sàng sóng mu thường suy giảm mạnh (Event-Related Desynchronization - ERD) ngay trước khi cử động thật hoặc cử động tưởng tượng ở vùng vỏ não cảm giác - vận động đối bên.',
      createdAt: new Date(Date.now() - 3600000 * 5),
    },
  });

  // Likes
  await prisma.postLike.createMany({
    data: [
      { postId: post1.id, userId: researcher.id },
      { postId: post1.id, userId: student.id },
      { postId: post1.id, userId: generalUser.id },
      { postId: post2.id, userId: doctor.id },
      { postId: post2.id, userId: student.id },
      { postId: post3.id, userId: student.id },
    ],
  });

  // Direct conversation between Doctor and Researcher
  const directKey = [doctor.id, researcher.id].sort().join(':');
  const conv = await prisma.conversation.create({
    data: {
      directKey,
      lastMessageAt: new Date(),
      participants: {
        create: [{ userId: doctor.id }, { userId: researcher.id }],
      },
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conv.id,
      senderId: doctor.id,
      content:
        'Chào PGS Lan, tuần sau bên khoa Thần kinh có một ca lâm sàng động kinh thùy thái dương khá điển hình. Bên cô có muốn thu thập thêm dữ liệu nghiên cứu không?',
      createdAt: new Date(Date.now() - 3600000 * 2),
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conv.id,
      senderId: researcher.id,
      content:
        'Chào BS Minh, rất tốt ạ! Nhóm chúng tôi đang cần kiểm chứng thuật toán định vị ổ phát sóng trên dữ liệu thực tế. Thứ Ba tuần tới tôi sẽ cử bạn Tuấn qua trao đổi theo quy trình đạo đức nghiên cứu.',
      createdAt: new Date(Date.now() - 3600000),
    },
  });

  // Seed Reward Catalog
  console.log('[seed] Seeding reward catalog...');
  const [courseReward, confReward] = await Promise.all([
    prisma.rewardCatalog.create({
      data: {
        name: 'Khóa Đào tạo Chuyên sâu: Điện não đồ Lâm sàng & Bắt sóng Động kinh (CME 24h)',
        description:
          'Khóa học thực hành trực tuyến có chứng chỉ đào tạo liên tục (CME) do Hội Thần kinh học phối hợp cùng Bệnh viện Bạch Mai cấp.',
        category: 'PROFESSIONAL_COURSE',
        creditCost: 300,
        stockQuantity: 30,
        eligibilityReq: 'Bác sĩ hoặc Kỹ sư y sinh đã xác minh tích xanh',
        terms: 'Chứng nhận hoàn thành sau khi nộp đủ bài tập thực hành đọc băng ghi Video-EEG.',
      },
    }),
    prisma.rewardCatalog.create({
      data: {
        name: 'Vé Tham dự Toàn phần: Hội nghị Thần kinh học & Giao diện Não - Máy tính (BCI) 2026',
        description:
          'Vé đại biểu chính thức tham dự toàn bộ các phiên báo cáo khoa học, workshop kỹ thuật và tiệc giao lưu kết nối tại Hà Nội.',
        category: 'CONFERENCE_ACCESS',
        creditCost: 450,
        stockQuantity: 15,
        eligibilityReq: 'Dành cho Bác sĩ, Nghiên cứu viên và Giảng viên đại học',
      },
    }),
    prisma.rewardCatalog.create({
      data: {
        name: 'Gói Truy cập 12 tháng Cơ sở dữ liệu Tạp chí Khoa học Thần kinh Quốc tế',
        description:
          'Quyền truy cập toàn văn hơn 150 tạp chí chuyên ngành hàng đầu về Thần kinh học lâm sàng và Xử lý tín hiệu não.',
        category: 'ACADEMIC_RESOURCE',
        creditCost: 200,
        stockQuantity: null,
      },
    }),
    prisma.rewardCatalog.create({
      data: {
        name: 'Buổi Cố vấn 1:1 Định hướng Nghiên cứu & Công bố Quốc tế (Mentoring 60 phút)',
        description:
          'Trao đổi trực tiếp 1:1 cùng các Phó Giáo sư / Trưởng Lab BCI hàng đầu về đề cương nghiên cứu, phương pháp xử lý tín hiệu.',
        category: 'MENTORING',
        creditCost: 250,
        stockQuantity: 10,
      },
    }),
    prisma.rewardCatalog.create({
      data: {
        name: 'Quỹ Hỗ trợ Kinh phí Công bố Bài báo Khoa học Quốc tế (Chờ kích hoạt)',
        description:
          'Hỗ trợ lệ phí xuất bản bài báo Open Access (APC) cho các công trình nghiên cứu xuất sắc. Lưu ý: Tính năng giải ngân tài chính đang trong giai đoạn hoàn thiện quy chế pháp lý & thuế.',
        category: 'MONETARY_REWARD',
        creditCost: 1000,
        isMonetary: true,
        payoutEnabled: false, // Strict: remain disabled
      },
    }),
  ]);

  // Seed Approved Contributions & Credit Wallets for Doctor Minh and Researcher Lan
  console.log('[seed] Seeding contributions and wallets...');

  // Dr. Minh Contribution (Post 1)
  const contribMinh = await prisma.contribution.create({
    data: {
      userId: doctor.id,
      postId: post1.id,
      category: 'HEALTHCARE_EDUCATION',
      status: 'APPROVED',
      summary:
        'Phân tích chuyên sâu về chẩn đoán phân biệt co giật tâm lý (PNES) và cơn động kinh thực tổn qua Video-EEG, giúp cộng đồng bác sĩ tránh kê nhầm thuốc kháng động kinh.',
      awardCredits: 300,
      currentReviewerId: admin.id,
      reviews: {
        create: {
          reviewerId: admin.id,
          scoreAccuracy: 5,
          scoreRelevance: 5,
          scoreUsefulness: 5,
          scoreOriginality: 4,
          scoreImpact: 5,
          scoreOverall: 4.8,
          awardedCredits: 300,
          decision: 'APPROVED',
          feedback:
            'Nội dung chia sẻ lâm sàng rất sâu sắc, có giá trị thực tiễn cao cho các bác sĩ trẻ và sinh viên y khoa.',
        },
      },
    },
  });

  const walletAdmin = await prisma.creditWallet.create({
    data: {
      userId: admin.id,
      balance: 250,
      promoCredits: 250,
      purchasedCredits: 0,
      earnedCredits: 0,
      lockedCredits: 0,
      totalEarned: 250,
      totalSpent: 0,
    },
  });
  await prisma.creditTransaction.create({
    data: {
      walletId: walletAdmin.id,
      amount: 250,
      bucket: 'PROMO',
      type: 'STARTER_GRANT',
      referenceId: admin.id,
      idempotencyKey: `starter-grant:${admin.id}`,
      description: 'Cấp Credit khởi đầu hệ sinh thái NeuroLink (+250 Credit)',
      actorId: admin.id,
    },
  });

  const walletMinh = await prisma.creditWallet.create({
    data: {
      userId: doctor.id,
      balance: 550,
      promoCredits: 250,
      purchasedCredits: 0,
      earnedCredits: 300,
      lockedCredits: 0,
      totalEarned: 550,
      totalSpent: 0,
      bankBin: '970422',
      bankName: 'MB Bank',
      bankAccountNo: '0912345678',
      bankAccountName: 'NGUYEN VAN MINH',
    },
  });

  await prisma.creditTransaction.createMany({
    data: [
      {
        walletId: walletMinh.id,
        amount: 250,
        bucket: 'PROMO',
        type: 'STARTER_GRANT',
        referenceId: doctor.id,
        idempotencyKey: `starter-grant:${doctor.id}`,
        description: 'Cấp Credit khởi đầu hệ sinh thái NeuroLink (+250 Credit)',
        actorId: doctor.id,
        createdAt: new Date(Date.now() - 86400000 * 6),
      },
      {
        walletId: walletMinh.id,
        amount: 300,
        bucket: 'EARNED',
        type: 'CONTRIBUTION_REWARD',
        referenceId: contribMinh.id,
        idempotencyKey: `contribution-reward:${contribMinh.id}`,
        description: 'Khen thưởng bài đóng góp học thuật/chuyên môn (HEALTHCARE_EDUCATION): +300 Credit',
        actorId: admin.id,
        contributionId: contribMinh.id,
        createdAt: new Date(Date.now() - 86400000 * 4),
      },
    ],
  });

  // Researcher Lan Contribution (Post 2)
  const contribLan = await prisma.contribution.create({
    data: {
      userId: researcher.id,
      postId: post2.id,
      category: 'RESEARCH_CONTRIBUTION',
      status: 'APPROVED',
      summary:
        'Tóm tắt kết quả thử nghiệm tiền lâm sàng mô hình Spatial-Temporal Transformer giải mã tín hiệu Motor Imagery đạt độ chính xác 86.4% với độ trễ dưới 50ms.',
      awardCredits: 450,
      currentReviewerId: admin.id,
      reviews: {
        create: {
          reviewerId: admin.id,
          scoreAccuracy: 5,
          scoreRelevance: 5,
          scoreUsefulness: 5,
          scoreOriginality: 5,
          scoreImpact: 5,
          scoreOverall: 5.0,
          awardedCredits: 450,
          decision: 'APPROVED',
          feedback:
            'Đóng góp học thuật xuất sắc, cung cấp dữ liệu thử nghiệm thực tế giá trị cho lĩnh vực BCI tại Việt Nam.',
        },
      },
    },
  });

  const walletLan = await prisma.creditWallet.create({
    data: {
      userId: researcher.id,
      balance: 800,
      promoCredits: 250,
      purchasedCredits: 0,
      earnedCredits: 550,
      lockedCredits: 0,
      totalEarned: 800,
      totalSpent: 0,
      bankBin: '970436',
      bankName: 'Vietcombank',
      bankAccountNo: '0011009988776',
      bankAccountName: 'TRAN MAI LAN',
    },
  });

  await prisma.creditTransaction.createMany({
    data: [
      {
        walletId: walletLan.id,
        amount: 250,
        bucket: 'PROMO',
        type: 'STARTER_GRANT',
        referenceId: researcher.id,
        idempotencyKey: `starter-grant:${researcher.id}`,
        description: 'Cấp Credit khởi đầu hệ sinh thái NeuroLink (+250 Credit)',
        actorId: researcher.id,
        createdAt: new Date(Date.now() - 86400000 * 5),
      },
      {
        walletId: walletLan.id,
        amount: 450,
        bucket: 'EARNED',
        type: 'CONTRIBUTION_REWARD',
        referenceId: contribLan.id,
        idempotencyKey: `contribution-reward:${contribLan.id}`,
        description: 'Khen thưởng bài đóng góp học thuật/chuyên môn (RESEARCH_CONTRIBUTION): +450 Credit',
        actorId: admin.id,
        contributionId: contribLan.id,
        createdAt: new Date(Date.now() - 86400000 * 3),
      },
    ],
  });

  // Seed post for residentDoctor + follows for Community Spotlight
  const postKhang = await prisma.post.create({
    data: {
      authorId: residentDoctor.id,
      content:
        'Kinh nghiệm sàng lọc nhanh ngoài giờ tại phòng trực đột quỵ: khi bệnh nhân chưa kịp chuyển chụp CT sọ não, việc kiểm tra chỉ số DAR kết hợp bất đối xứng bán cầu BSI trên 6 đạo trình giúp ưu tiên kích hoạt báo động Code Stroke sớm hơn từ 12-18 phút.',
      createdAt: new Date(Date.now() - 3600000 * 2),
    },
  });
  await prisma.postLike.createMany({
    data: [
      { postId: postKhang.id, userId: doctor.id },
      { postId: postKhang.id, userId: researcher.id },
      { postId: postKhang.id, userId: generalUser.id },
    ],
  });
  await prisma.follow.createMany({
    data: [
      { followerId: generalUser.id, followingId: residentDoctor.id },
      { followerId: student.id, followingId: residentDoctor.id },
    ],
  });

  // Starter Grants for Hoa, Tuan, KTV Linh, and BS Khang
  const walletHoa = await prisma.creditWallet.create({
    data: {
      userId: generalUser.id,
      balance: 190,
      promoCredits: 190,
      purchasedCredits: 0,
      earnedCredits: 0,
      lockedCredits: 60,
      totalEarned: 250,
      totalSpent: 60,
    },
  });
  await prisma.creditTransaction.create({
    data: {
      walletId: walletHoa.id,
      amount: 250,
      bucket: 'PROMO',
      type: 'STARTER_GRANT',
      referenceId: generalUser.id,
      idempotencyKey: `starter-grant:${generalUser.id}`,
      description: 'Cấp Credit khởi đầu hệ sinh thái NeuroLink (+250 Credit)',
      actorId: generalUser.id,
      createdAt: new Date(Date.now() - 86400000 * 5),
    },
  });

  const walletTuan = await prisma.creditWallet.create({
    data: {
      userId: student.id,
      balance: 70,
      promoCredits: 70,
      purchasedCredits: 0,
      earnedCredits: 0,
      lockedCredits: 0,
      totalEarned: 250,
      totalSpent: 180,
    },
  });
  await prisma.creditTransaction.create({
    data: {
      walletId: walletTuan.id,
      amount: 250,
      bucket: 'PROMO',
      type: 'STARTER_GRANT',
      referenceId: student.id,
      idempotencyKey: `starter-grant:${student.id}`,
      description: 'Cấp Credit khởi đầu hệ sinh thái NeuroLink (+250 Credit)',
      actorId: student.id,
      createdAt: new Date(Date.now() - 86400000 * 5),
    },
  });

  const walletLinh = await prisma.creditWallet.create({
    data: {
      userId: healthcareWorker.id,
      balance: 175,
      promoCredits: 175,
      purchasedCredits: 0,
      earnedCredits: 0,
      lockedCredits: 75,
      totalEarned: 250,
      totalSpent: 75,
    },
  });
  await prisma.creditTransaction.create({
    data: {
      walletId: walletLinh.id,
      amount: 250,
      bucket: 'PROMO',
      type: 'STARTER_GRANT',
      referenceId: healthcareWorker.id,
      idempotencyKey: `starter-grant:${healthcareWorker.id}`,
      description: 'Cấp Credit khởi đầu hệ sinh thái NeuroLink (+250 Credit)',
      actorId: healthcareWorker.id,
      createdAt: new Date(Date.now() - 86400000 * 5),
    },
  });

  const walletKhang = await prisma.creditWallet.create({
    data: {
      userId: residentDoctor.id,
      balance: 330,
      promoCredits: 250,
      purchasedCredits: 0,
      earnedCredits: 80,
      lockedCredits: 0,
      totalEarned: 330,
      totalSpent: 0,
      bankBin: '970407',
      bankName: 'Techcombank',
      bankAccountNo: '19034567890123',
      bankAccountName: 'LE MINH KHANG',
    },
  });
  await prisma.creditTransaction.create({
    data: {
      walletId: walletKhang.id,
      amount: 250,
      bucket: 'PROMO',
      type: 'STARTER_GRANT',
      referenceId: residentDoctor.id,
      idempotencyKey: `starter-grant:${residentDoctor.id}`,
      description: 'Cấp Credit khởi đầu hệ sinh thái NeuroLink (+250 Credit)',
      actorId: residentDoctor.id,
      createdAt: new Date(Date.now() - 86400000 * 5),
    },
  });

  // ---------------------------------------------------------------------------
  // Seed 12 NeuralTrainingSamples (covering all 5 labels & 4 categories)
  // ---------------------------------------------------------------------------
  console.log('[seed] Seeding 12 Neural Network DB samples...');
  const baseAnalyses = {
    ischemia: analyzeCaseTs({ caseId: 'case_ischemia_lvo', timeWindowSec: 6 })!,
    ich: analyzeCaseTs({ caseId: 'case_ich_hemorrhage', timeWindowSec: 6 })!,
    epilepsy: analyzeCaseTs({ caseId: 'case_epilepsy_temporal', timeWindowSec: 6 })!,
    fatigue: analyzeCaseTs({ caseId: 'case_sleep_fatigue_n3', timeWindowSec: 6 })!,
    healthy: analyzeCaseTs({ caseId: 'case_healthy_alpha', timeWindowSec: 6 })!,
    hardware: analyzeCaseTs({ caseId: 'case_ads1299_hardware', timeWindowSec: 6 })!,
  };

  const sampleSpecs: {
    subjectCode: string;
    datasetId: string | null;
    uploaderId: string;
    verifiedById: string | null;
    clinicalCategory: ClinicalCategory;
    groundTruthLabel: NeuralLabel;
    split: DatasetSplit;
    analysis: NonNullable<ReturnType<typeof analyzeCaseTs>>;
    darOverride?: number;
    bsiOverride?: number;
    tarOverride?: number;
    tpaLockout?: boolean;
  }[] = [
    {
      subjectCode: 'UCLH-P26-A1',
      datasetId: 'rec-01',
      uploaderId: doctor.id,
      verifiedById: doctor.id,
      clinicalCategory: ClinicalCategory.VASCULAR_STROKE,
      groundTruthLabel: NeuralLabel.ISCHEMIC_STROKE,
      split: DatasetSplit.EXTERNAL_HOLDOUT,
      analysis: baseAnalyses.ischemia,
      darOverride: 3.84,
      bsiOverride: 0.312,
    },
    {
      subjectCode: 'BM-STROKE-02',
      datasetId: null,
      uploaderId: residentDoctor.id,
      verifiedById: doctor.id,
      clinicalCategory: ClinicalCategory.VASCULAR_STROKE,
      groundTruthLabel: NeuralLabel.ISCHEMIC_STROKE,
      split: DatasetSplit.TRAIN,
      analysis: baseAnalyses.ischemia,
      darOverride: 3.45,
      bsiOverride: 0.265,
    },
    {
      subjectCode: 'UCLH-P11-ICH',
      datasetId: null,
      uploaderId: doctor.id,
      verifiedById: doctor.id,
      clinicalCategory: ClinicalCategory.VASCULAR_STROKE,
      groundTruthLabel: NeuralLabel.HEMORRHAGIC_STROKE,
      split: DatasetSplit.EXTERNAL_HOLDOUT,
      analysis: baseAnalyses.ich,
      darOverride: 4.92,
      bsiOverride: 0.238,
      tpaLockout: true,
    },
    {
      subjectCode: 'UMP-ICH-04',
      datasetId: null,
      uploaderId: residentDoctor.id,
      verifiedById: null,
      clinicalCategory: ClinicalCategory.VASCULAR_STROKE,
      groundTruthLabel: NeuralLabel.HEMORRHAGIC_STROKE,
      split: DatasetSplit.VALIDATION,
      analysis: baseAnalyses.ich,
      darOverride: 4.41,
      bsiOverride: 0.194,
      tpaLockout: true,
    },
    {
      subjectCode: 'BM-EPI-05',
      datasetId: 'rec-02',
      uploaderId: doctor.id,
      verifiedById: doctor.id,
      clinicalCategory: ClinicalCategory.EPILEPSY_ICU,
      groundTruthLabel: NeuralLabel.EPILEPTIFORM_SLOWING,
      split: DatasetSplit.TRAIN,
      analysis: baseAnalyses.epilepsy,
      darOverride: 2.38,
      bsiOverride: 0.196,
      tarOverride: 1.72,
    },
    {
      subjectCode: 'ICU-NCSE-06',
      datasetId: null,
      uploaderId: residentDoctor.id,
      verifiedById: doctor.id,
      clinicalCategory: ClinicalCategory.EPILEPSY_ICU,
      groundTruthLabel: NeuralLabel.EPILEPTIFORM_SLOWING,
      split: DatasetSplit.TEST,
      analysis: baseAnalyses.epilepsy,
      darOverride: 2.64,
      bsiOverride: 0.214,
      tarOverride: 1.89,
    },
    {
      subjectCode: 'ICU-POSTICTAL-07',
      datasetId: null,
      uploaderId: healthcareWorker.id,
      verifiedById: null,
      clinicalCategory: ClinicalCategory.EPILEPSY_ICU,
      groundTruthLabel: NeuralLabel.EPILEPTIFORM_SLOWING,
      split: DatasetSplit.VALIDATION,
      analysis: baseAnalyses.epilepsy,
      darOverride: 2.15,
      bsiOverride: 0.171,
    },
    {
      subjectCode: 'SLEEP-N3-08',
      datasetId: 'rec-02',
      uploaderId: generalUser.id,
      verifiedById: doctor.id,
      clinicalCategory: ClinicalCategory.SLEEP_COGNITIVE,
      groundTruthLabel: NeuralLabel.COGNITIVE_FATIGUE,
      split: DatasetSplit.TRAIN,
      analysis: baseAnalyses.fatigue,
      darOverride: 1.48,
      bsiOverride: 0.052,
      tarOverride: 1.94,
    },
    {
      subjectCode: 'SHIFT-RES-09',
      datasetId: null,
      uploaderId: residentDoctor.id,
      verifiedById: researcher.id,
      clinicalCategory: ClinicalCategory.SLEEP_COGNITIVE,
      groundTruthLabel: NeuralLabel.COGNITIVE_FATIGUE,
      split: DatasetSplit.TEST,
      analysis: baseAnalyses.fatigue,
      darOverride: 1.32,
      bsiOverride: 0.048,
      tarOverride: 2.18,
    },
    {
      subjectCode: 'UCLH-S8-CTRL',
      datasetId: null,
      uploaderId: researcher.id,
      verifiedById: researcher.id,
      clinicalCategory: ClinicalCategory.SLEEP_COGNITIVE,
      groundTruthLabel: NeuralLabel.CONTROL,
      split: DatasetSplit.EXTERNAL_HOLDOUT,
      analysis: baseAnalyses.healthy,
      darOverride: 0.62,
      bsiOverride: 0.041,
      tarOverride: 0.74,
    },
    {
      subjectCode: 'ADS1299-MI-11',
      datasetId: 'rec-03',
      uploaderId: researcher.id,
      verifiedById: researcher.id,
      clinicalCategory: ClinicalCategory.HARDWARE_BCI,
      groundTruthLabel: NeuralLabel.CONTROL,
      split: DatasetSplit.TRAIN,
      analysis: baseAnalyses.hardware,
      darOverride: 0.78,
      bsiOverride: 0.059,
      tarOverride: 0.85,
    },
    {
      subjectCode: 'ADS1299-FTG-12',
      datasetId: null,
      uploaderId: student.id,
      verifiedById: null,
      clinicalCategory: ClinicalCategory.HARDWARE_BCI,
      groundTruthLabel: NeuralLabel.COGNITIVE_FATIGUE,
      split: DatasetSplit.TRAIN,
      analysis: baseAnalyses.fatigue,
      darOverride: 1.54,
      bsiOverride: 0.067,
      tarOverride: 1.76,
    },
  ];

  const createdSamples = [];
  for (const spec of sampleSpecs) {
    const sample = await prisma.neuralTrainingSample.create({
      data: {
        datasetId: spec.datasetId,
        uploaderId: spec.uploaderId,
        verifiedById: spec.verifiedById,
        subjectCode: spec.subjectCode,
        clinicalCategory: spec.clinicalCategory,
        groundTruthLabel: spec.groundTruthLabel,
        split: spec.split,
        samplingRateHz: spec.analysis.samplingRateHz,
        channelsCount: spec.analysis.channelsCount,
        montage: spec.analysis.montage,
        signalQualityScore: spec.analysis.biomarkers.signalQualityScore,
        dar: spec.darOverride ?? spec.analysis.biomarkers.meanDar,
        bsi: spec.bsiOverride ?? spec.analysis.biomarkers.meanBsi,
        tar: spec.tarOverride ?? spec.analysis.biomarkers.meanTar,
        pri: spec.analysis.biomarkers.pri,
        wpli: spec.analysis.biomarkers.wpli,
        tpaLockoutTriggered: spec.tpaLockout ?? spec.analysis.biomarkers.tpaLockoutTriggered,
        spectralBandsJson: JSON.stringify(spec.analysis.bandPowers),
        featureVectorJson: JSON.stringify(spec.analysis.featureVector80),
        waveformPreviewJson: JSON.stringify({
          time: spec.analysis.waveforms.time.slice(0, 120),
          channels: spec.analysis.waveforms.channels,
          filtered: Object.fromEntries(
            Object.entries(spec.analysis.waveforms.filtered).map(([k, arr]) => [
              k,
              arr.slice(0, 120),
            ]),
          ),
        }),
        deidentifiedConfirmed: true,
      },
    });
    createdSamples.push(sample);
  }

  // ---------------------------------------------------------------------------
  // Seed 5 DataBankListings (free + paid) & 1 purchase ledger
  // ---------------------------------------------------------------------------
  console.log('[seed] Seeding 5 DataBank listings...');
  const sampleCsvHeader = 'timestamp_s,F3_uV,F4_uV,C3_uV,C4_uV,O1_uV,O2_uV\n';
  const makeSampleCsv = (seedAmp: number) =>
    sampleCsvHeader +
    Array.from({ length: 16 }, (_, i) => {
      const t = (i * 0.002).toFixed(3);
      return `${t},${(seedAmp * Math.sin(i * 0.4)).toFixed(2)},${(seedAmp * 0.6 * Math.cos(i * 0.35)).toFixed(2)},${(seedAmp * 0.9 * Math.sin(i * 0.5)).toFixed(2)},${(seedAmp * 0.55 * Math.cos(i * 0.45)).toFixed(2)},${(12 * Math.sin(i * 0.8)).toFixed(2)},${(12.4 * Math.sin(i * 0.8 + 0.2)).toFixed(2)}`;
    }).join('\n');

  await prisma.dataBankListing.create({
    data: {
      authorId: doctor.id,
      datasetId: 'rec-01',
      title: 'Bộ mẫu Mở: Sóng Alpha Chuẩn & Giả Đột quỵ Ngủ sâu N3 (Đối chứng Miễn phí)',
      summary:
        'Tập dữ liệu mở giúp sinh viên Y khoa và kỹ sư BME phân biệt sóng chậm sinh lý trong pha ngủ sâu N3 với bất đối xứng bán cầu bệnh lý.',
      clinicalCategory: ClinicalCategory.SLEEP_COGNITIVE,
      methodologyNote:
        'Ghi điện não 6 kênh F3-F4-C3-C4-O1-O2 ở 500 Hz, lọc thông dải 0.5-45 Hz, khử nhiễu lưới 50 Hz Notch và tái tham chiếu trung bình toàn cục (CAR).',
      sampleCount: 18,
      channelsSpec: '6 kênh 10-20 (F3, F4, C3, C4, O1, O2)',
      samplingRateHz: 500,
      priceCredits: 0,
      downloadsCount: 42,
      previewMetricsJson: JSON.stringify({
        meanDar: 1.12,
        meanBsi: 0.049,
        meanTar: 1.45,
        meanWpli: 0.41,
        dominantBand: 'Alpha / Theta',
      }),
      payloadCsvJson: makeSampleCsv(18),
    },
  });

  const paidBciListing = await prisma.dataBankListing.create({
    data: {
      authorId: researcher.id,
      datasetId: 'rec-03',
      title: 'Tập dữ liệu Chuẩn hóa Motor Imagery & SSVEP trên Mạch TI ADS1299 24-bit',
      summary:
        'Gồm 45 phiên ghi thực nghiệm từ bo mạch TI ADS1299 500 Hz kèm nhãn thời điểm mở/nhắm mắt và tưởng tượng vận động tay phải/trái.',
      clinicalCategory: ClinicalCategory.HARDWARE_BCI,
      methodologyNote:
        'Thu thập trong buồng thí nghiệm chống nhiễu ĐHQG Hà Nội, hiệu chuẩn điện trở tiếp xúc < 10 kOhm, kiểm định tỷ lệ tín hiệu trên nhiễu (SNR >= 18 dB).',
      sampleCount: 45,
      channelsSpec: '8 kênh ADS1299 (F3, F4, C3, C4, O1, O2, Pz, Oz)',
      samplingRateHz: 500,
      priceCredits: 100,
      downloadsCount: 15,
      previewMetricsJson: JSON.stringify({
        meanDar: 0.78,
        meanBsi: 0.059,
        meanTar: 0.85,
        meanWpli: 0.37,
        dominantBand: 'Mu / Beta (10-22 Hz)',
      }),
      payloadCsvJson: makeSampleCsv(24),
    },
  });

  await prisma.dataBankListing.create({
    data: {
      authorId: doctor.id,
      title: 'Cohort qEEG Đột quỵ Thiếu máu LVO & Ngoại kiểm Xuất huyết Não (N=28)',
      summary:
        'Tập đặc trưng 80 chiều và chuỗi thời gian đã khử danh tính dùng huấn luyện mô hình phân biệt Thiếu máu cục bộ vs Xuất huyết não cấp.',
      clinicalCategory: ClinicalCategory.VASCULAR_STROKE,
      methodologyNote:
        'Đối chiếu nhãn vàng từ CT/MRI sọ não, tuân thủ cổng an toàn CM[2,1] = 0 không bỏ sót ca xuất huyết não chống chỉ định tiêu sợi huyết.',
      sampleCount: 28,
      channelsSpec: '6 kênh chuẩn tái tạo Spherical Splines 19 kênh',
      samplingRateHz: 500,
      priceCredits: 140,
      downloadsCount: 9,
      previewMetricsJson: JSON.stringify({
        meanDar: 3.92,
        meanBsi: 0.287,
        meanTar: 1.68,
        meanWpli: 0.29,
        dominantBand: 'Delta (0.5-3.5 Hz)',
      }),
      payloadCsvJson: makeSampleCsv(42),
    },
  });

  await prisma.dataBankListing.create({
    data: {
      authorId: residentDoctor.id,
      datasetId: 'rec-02',
      title: 'Bộ Băng ghi Nhọn - Sóng chậm Động kinh Thùy Thái dương & ICU NCSE',
      summary:
        'Tập các đoạn trích xuất 10 giây chứa phức hợp nhọn-chậm 3 Hz và sóng chậm kịch phát vùng thái dương phục vụ kiểm thử thuật toán phát hiện sớm tại ICU.',
      clinicalCategory: ClinicalCategory.EPILEPSY_ICU,
      methodologyNote:
        'Ghi tại đơn vị Hồi sức Thần kinh BV ĐH Y Dược TP.HCM, hai bác sĩ nội trú và chuyên khoa II đọc mù độc lập đối chiếu.',
      sampleCount: 24,
      channelsSpec: '6 kênh lưỡng cực trán-thái dương-chẩm',
      samplingRateHz: 500,
      priceCredits: 90,
      downloadsCount: 11,
      previewMetricsJson: JSON.stringify({
        meanDar: 2.41,
        meanBsi: 0.198,
        meanTar: 1.78,
        meanWpli: 0.44,
        dominantBand: 'Theta / Spike-Wave',
      }),
      payloadCsvJson: makeSampleCsv(31),
    },
  });

  await prisma.dataBankListing.create({
    data: {
      authorId: researcher.id,
      title: 'Mẫu Mở: Chuỗi Chỉ số Thức - Ngủ & Đánh giá Mệt mỏi Trực đêm',
      summary:
        'Dữ liệu mẫu miễn phí mô tả biến thiên TAR và đỉnh Alpha ở nhân viên y tế trước và sau ca trực kéo dài.',
      clinicalCategory: ClinicalCategory.SLEEP_COGNITIVE,
      methodologyNote:
        'Đo lặp 5 phút mắt nhắm trước ca và sau 16 giờ trực liên tục.',
      sampleCount: 12,
      channelsSpec: '6 kênh (F3, F4, C3, C4, O1, O2)',
      samplingRateHz: 250,
      priceCredits: 0,
      downloadsCount: 27,
      previewMetricsJson: JSON.stringify({
        meanDar: 1.35,
        meanBsi: 0.055,
        meanTar: 1.92,
        meanWpli: 0.39,
        dominantBand: 'Theta (4-8 Hz)',
      }),
      payloadCsvJson: makeSampleCsv(15),
    },
  });

  // Seed 1 DataBankPurchase (tuan_bme purchased paidBciListing for 100 credits from prof_lan)
  await prisma.dataBankPurchase.create({
    data: {
      listingId: paidBciListing.id,
      buyerId: student.id,
      creditsPaid: 100,
    },
  });
  await prisma.creditTransaction.createMany({
    data: [
      {
        walletId: walletTuan.id,
        amount: -100,
        bucket: 'PROMO',
        type: 'DATABANK_PURCHASE',
        referenceId: paidBciListing.id,
        idempotencyKey: `databank-purchase:${paidBciListing.id}:${student.id}`,
        description: `Mở khóa gói dữ liệu "${paidBciListing.title}" (-100 Credit)`,
        actorId: student.id,
        createdAt: new Date(Date.now() - 86400000 * 4),
      },
      {
        walletId: walletLan.id,
        amount: 100,
        bucket: 'EARNED',
        type: 'DATABANK_ROYALTY',
        referenceId: paidBciListing.id,
        idempotencyKey: `databank-royalty:${paidBciListing.id}:${student.id}`,
        description: `Tác quyền Data Bank cho gói "${paidBciListing.title}" (+100 Credit)`,
        actorId: student.id,
        createdAt: new Date(Date.now() - 86400000 * 2),
      },
    ],
  });

  // ---------------------------------------------------------------------------
  // Seed 4 ConsultationTickets (open + answered/accepted)
  // ---------------------------------------------------------------------------
  console.log('[seed] Seeding 4 Consultation tickets...');
  const ischemicSample = createdSamples[0]!;
  const fatigueSample = createdSamples[7]!;
  const epilepsySample = createdSamples[4]!;
  const hardwareSample = createdSamples[10]!;

  // Ticket 1: OPEN urgent red flag (Hoa escrowed 60 credits)
  const ticket1 = await prisma.consultationTicket.create({
    data: {
      requesterId: generalUser.id,
      datasetId: 'rec-01',
      neuralSampleId: ischemicSample.id,
      title: 'Khẩn: Người nhà yếu nửa người phải, bản ghi qEEG có DAR 3.84 và BSI 0.312',
      symptomSummary:
        'Bệnh nhân 64 tuổi đột ngột nói khó và yếu tay chân phải cách đây 70 phút. Nhờ bác sĩ trực đọc nhanh bản đồ bất đối xứng và hướng dẫn bước xử trí trước khi vào chụp CT.',
      clinicalCategory: ClinicalCategory.VASCULAR_STROKE,
      bountyCredits: 60,
      urgentRedFlag: true,
      status: ConsultationStatus.OPEN,
      createdAt: new Date(Date.now() - 3600000 * 2),
    },
  });
  await prisma.creditTransaction.create({
    data: {
      walletId: walletHoa.id,
      amount: -60,
      type: 'CONSULTATION_ESCROW',
      referenceId: ticket1.id,
      idempotencyKey: `consultation-escrow:${ticket1.id}`,
      description: `Ký quỹ credit tư vấn ca "${ticket1.title}" (-60 credit)`,
      actorId: generalUser.id,
    },
  });

  // Ticket 2: OPEN non-urgent BCI/Hardware ticket (Tuan, bounty 0)
  await prisma.consultationTicket.create({
    data: {
      requesterId: student.id,
      datasetId: 'rec-03',
      neuralSampleId: hardwareSample.id,
      title: 'Nhờ hiệu chỉnh phổ nhiễu 50 Hz trên bo mạch TI ADS1299 khi đo ngoài phòng lab',
      symptomSummary:
        'Khi đo tại ký túc xá không có lồng Faraday, kênh F3 xuất hiện đỉnh 50 Hz khá rõ làm lệch nhẹ chỉ số Beta. Nhờ thầy cô xem giúp bộ lọc Notch Q=30 hiện tại đã đủ sạch chưa.',
      clinicalCategory: ClinicalCategory.HARDWARE_BCI,
      bountyCredits: 0,
      urgentRedFlag: false,
      status: ConsultationStatus.OPEN,
      createdAt: new Date(Date.now() - 3600000 * 9),
    },
  });

  // Ticket 3: ANSWERED (awaiting requester acceptance, KTV Linh escrowed 75 credits, Dr. Minh answered)
  const ticket3 = await prisma.consultationTicket.create({
    data: {
      requesterId: healthcareWorker.id,
      claimedById: doctor.id,
      datasetId: 'rec-02',
      neuralSampleId: epilepsySample.id,
      title: 'Hội chẩn băng ghi nghi ngờ phức hợp nhọn - sóng chậm 3 Hz thùy thái dương trái',
      symptomSummary:
        'Bệnh nhân nữ 29 tuổi sau cơn vắng ý thức kéo dài 40 giây, băng ghi 6 đạo trình có cụm sóng chậm nhịp 3 Hz vùng F3-C3. Xin ý kiến BS chuyên khoa về hướng theo dõi Video-EEG.',
      clinicalCategory: ClinicalCategory.EPILEPSY_ICU,
      bountyCredits: 75,
      urgentRedFlag: false,
      status: ConsultationStatus.ANSWERED,
      createdAt: new Date(Date.now() - 86400000),
    },
  });
  await prisma.creditTransaction.create({
    data: {
      walletId: walletLinh.id,
      amount: -75,
      type: 'CONSULTATION_ESCROW',
      referenceId: ticket3.id,
      idempotencyKey: `consultation-escrow:${ticket3.id}`,
      description: `Ký quỹ credit tư vấn ca "${ticket3.title}" (-75 credit)`,
      actorId: healthcareWorker.id,
    },
  });
  await prisma.consultationReply.create({
    data: {
      ticketId: ticket3.id,
      responderId: doctor.id,
      responderTier: 'Bác sĩ Chuyên khoa II Thần kinh',
      waveAnalysisText:
        'Trên đoạn 10 giây ghi nhận cụm nhọn - sóng chậm đồng thì tần số ~3.1 Hz ưu thế tại F3/C3, TAR tăng lên 1.72 trong khi nhịp Alpha chẩm O1/O2 suy giảm tạm thời.',
      clinicalGuidanceText:
        'Đặc điểm phù hợp phóng điện dạng động kinh khu trú có xu hướng lan tỏa thứ phát, chưa thấy mẫu bất đối xứng Delta đơn thuần kiểu thiếu máu não.',
      recommendedFollowUp:
        'Đề xuất ghi Video-EEG 19 kênh đầy đủ kèm nghiệm pháp thở sâu và kích thích ánh sáng trong 24 giờ.',
      isAccepted: false,
      createdAt: new Date(Date.now() - 3600000 * 18),
    },
  });

  // Ticket 4: ACCEPTED (Tuan escrowed 80 credits, BS Noi tru Khang answered & accepted -> +80 earning)
  const ticket4 = await prisma.consultationTicket.create({
    data: {
      requesterId: student.id,
      claimedById: residentDoctor.id,
      neuralSampleId: fatigueSample.id,
      title: 'Đánh giá chỉ số TAR = 1.94 và BSI = 0.052 sau thức khuya làm đồ án',
      symptomSummary:
        'Em đo thử bản ghi mắt nhắm lúc 2h sáng thấy sóng chậm tăng nhẹ, lo ngại có phải bất thường mạch máu não không hay chỉ là mệt mỏi nhận thức.',
      clinicalCategory: ClinicalCategory.SLEEP_COGNITIVE,
      bountyCredits: 80,
      urgentRedFlag: false,
      status: ConsultationStatus.ACCEPTED,
      createdAt: new Date(Date.now() - 86400000 * 3),
    },
  });
  const reply4 = await prisma.consultationReply.create({
    data: {
      ticketId: ticket4.id,
      responderId: residentDoctor.id,
      responderTier: 'Bác sĩ Nội trú Thần kinh (Ngoài giờ)',
      waveAnalysisText:
        'Chỉ số BSI = 0.052 nằm sâu dưới ngưỡng bất đối xứng (0.15), cho thấy sóng chậm Theta/Delta phân bố rất cân xứng hai bán cầu. Nhịp Alpha chẩm vẫn bảo tồn ở ~9.4 Hz.',
      clinicalGuidanceText:
        'Đây là biểu hiện sinh lý điển hình của buồn ngủ và suy giảm tỉnh táo do thiếu ngủ, hoàn toàn không có dấu hiệu thiếu máu não khu trú.',
      recommendedFollowUp:
        'Ưu tiên ngủ bù đủ 7.5 giờ, dời lịch tác vụ phân tích nặng sang khung giờ 08:30-11:00 sáng.',
      rating: 5,
      isAccepted: true,
      createdAt: new Date(Date.now() - 86400000 * 2),
    },
  });
  await prisma.consultationTicket.update({
    where: { id: ticket4.id },
    data: { acceptedReplyId: reply4.id },
  });
  await prisma.creditTransaction.createMany({
    data: [
      {
        walletId: walletTuan.id,
        amount: -80,
        type: 'CONSULTATION_ESCROW',
        referenceId: ticket4.id,
        idempotencyKey: `consultation-escrow:${ticket4.id}`,
        description: `Ký quỹ credit tư vấn ca "${ticket4.title}" (-80 credit)`,
        actorId: student.id,
      },
      {
        walletId: walletKhang.id,
        amount: 80,
        type: 'CONSULTATION_EARNING',
        referenceId: ticket4.id,
        idempotencyKey: `consultation-earning:${ticket4.id}`,
        description: `Thù lao đọc sóng não & tư vấn từ xa ca "${ticket4.title}" (+80 credit)`,
        actorId: student.id,
      },
    ],
  });

  // ---------------------------------------------------------------------------
  // Seed 7 HealthCheckIns + 5 WorkingPlanBlocks for demo accounts
  // ---------------------------------------------------------------------------
  console.log('[seed] Seeding Self-Service HealthCheckIns & WorkingPlanBlocks...');
  const dayMs = 86400000;
  const hoaCheckInSeed = [
    { daysAgo: 6, focusScore: 64, tar: 1.82, bsi: 0.062, alpha: 9.6, sleep: 5.8, stress: 7, notes: 'Ngủ muộn hoàn thành báo cáo cuối tuần, cảm giác nặng đầu đầu giờ sáng.' },
    { daysAgo: 5, focusScore: 71, tar: 1.54, bsi: 0.055, alpha: 9.8, sleep: 6.5, stress: 6, notes: 'Ngủ sớm hơn 45 phút, giảm sử dụng màn hình sau 22h30.' },
    { daysAgo: 4, focusScore: 76, tar: 1.38, bsi: 0.051, alpha: 10.0, sleep: 7.0, stress: 5, notes: 'Tập trung tốt trong khối Deep Work buổi sáng, chợp mắt 15 phút buổi trưa.' },
    { daysAgo: 3, focusScore: 79, tar: 1.29, bsi: 0.048, alpha: 10.1, sleep: 7.2, stress: 4, notes: 'Nhịp Alpha chẩm ổn định 10.1 Hz, ít xao nhãng.' },
    { daysAgo: 2, focusScore: 73, tar: 1.49, bsi: 0.053, alpha: 9.9, sleep: 6.4, stress: 6, notes: 'Họp kéo dài buổi chiều làm tăng mệt mỏi Theta nhẹ.' },
    { daysAgo: 1, focusScore: 84, tar: 1.12, bsi: 0.044, alpha: 10.3, sleep: 7.8, stress: 3, notes: 'Ngủ đủ 7.8 giờ, trạng thái tỉnh táo tốt nhất tuần.' },
    { daysAgo: 0, focusScore: 86, tar: 1.06, bsi: 0.042, alpha: 10.4, sleep: 7.6, stress: 3, notes: 'Đo baseline sáng nay: Alpha rõ nét, cân xứng hai bán cầu.' },
  ];

  for (const item of hoaCheckInSeed) {
    await prisma.healthCheckIn.create({
      data: {
        userId: generalUser.id,
        neuralSampleId: item.daysAgo === 0 ? createdSamples[9]!.id : null,
        recordedDate: new Date(Date.now() - item.daysAgo * dayMs),
        focusScore: item.focusScore,
        fatigueIndexTar: item.tar,
        hemisphericBsi: item.bsi,
        alphaPeakHz: item.alpha,
        sleepHours: item.sleep,
        stressLevel: item.stress,
        notes: item.notes,
      },
    });
  }

  await prisma.workingPlanBlock.createMany({
    data: [
      {
        userId: generalUser.id,
        dayOfWeek: 'Thứ 2',
        timeSlot: '08:30 - 10:30',
        title: 'Phân tích tài liệu & tác vụ nhận thức sâu (Deep Work)',
        blockType: WorkBlockType.DEEP_WORK,
        eegRationale: 'Alpha Peak 10.3 Hz và TAR < 1.20 đạt đỉnh tỉnh táo vỏ não trán-chẩm buổi sáng.',
        completed: true,
      },
      {
        userId: generalUser.id,
        dayOfWeek: 'Thứ 3',
        timeSlot: '13:30 - 14:00',
        title: 'Thư giãn mắt nhắm & phục hồi nhịp Alpha (NSDR)',
        blockType: WorkBlockType.NEURO_RECOVERY,
        eegRationale: 'Hạ tải dải Theta tăng cao sau giờ trưa trước khi bước vào ca chiều.',
        completed: true,
      },
      {
        userId: generalUser.id,
        dayOfWeek: 'Thứ 4',
        timeSlot: '15:00 - 16:30',
        title: 'Xử lý email, tổng hợp hành chính nhẹ',
        blockType: WorkBlockType.LIGHT_ADMIN,
        eegRationale: 'Khung giờ cuối chiều TAR thường tăng nhẹ (~1.45), phù hợp công việc ít tải trí nhớ làm việc.',
        completed: false,
      },
      {
        userId: generalUser.id,
        dayOfWeek: 'Thứ 5',
        timeSlot: '07:45 - 08:15',
        title: 'Đo kiểm tra baseline qEEG 6 kênh tại nhà',
        blockType: WorkBlockType.CLINICAL_CHECK,
        eegRationale: 'Theo dõi xu hướng BSI & DAR định kỳ hàng tuần để hiệu chỉnh khối lượng làm việc.',
        completed: false,
      },
      {
        userId: generalUser.id,
        dayOfWeek: 'Hằng ngày',
        timeSlot: '22:45 - 06:30',
        title: 'Ngắt màn hình xanh & mục tiêu ngủ sâu N3 >= 7.5 giờ',
        blockType: WorkBlockType.SLEEP_TARGET,
        eegRationale: 'Đảm bảo chu kỳ sóng chậm N3 phục hồi dẫn truyền synap và giữ TAR ngày hôm sau < 1.25.',
        completed: false,
      },
    ],
  });

  // Also add 2 check-ins & 2 blocks for residentDoctor so Professional demo works cleanly too
  await prisma.healthCheckIn.createMany({
    data: [
      {
        userId: residentDoctor.id,
        recordedDate: new Date(Date.now() - dayMs),
        focusScore: 72,
        fatigueIndexTar: 1.62,
        hemisphericBsi: 0.047,
        alphaPeakHz: 9.7,
        sleepHours: 5.5,
        stressLevel: 6,
        notes: 'Sau ca trực đêm Hồi sức Đột quỵ, cần ưu tiên nghỉ bù trước khi nhận ca đọc sóng não.',
      },
      {
        userId: residentDoctor.id,
        recordedDate: new Date(),
        focusScore: 85,
        fatigueIndexTar: 1.14,
        hemisphericBsi: 0.043,
        alphaPeakHz: 10.2,
        sleepHours: 7.5,
        stressLevel: 4,
        notes: 'Đã ngủ bù đủ giấc, sẵn sàng tiếp nhận ca trực đọc qEEG ngoài giờ.',
      },
    ],
  });
  await prisma.workingPlanBlock.createMany({
    data: [
      {
        userId: residentDoctor.id,
        dayOfWeek: 'Thứ 6',
        timeSlot: '19:30 - 21:30',
        title: 'Ca trực đọc băng ghi qEEG từ xa & hỗ trợ sàng lọc tuyến dưới',
        blockType: WorkBlockType.CLINICAL_CHECK,
        eegRationale: 'Chỉ số TAR = 1.14 đảm bảo độ nhạy phát hiện sóng chậm đột quỵ và gai nhọn động kinh.',
        completed: false,
      },
      {
        userId: residentDoctor.id,
        dayOfWeek: 'Thứ 7',
        timeSlot: '13:00 - 14:00',
        title: 'Phục hồi nhận thức sau trực đêm',
        blockType: WorkBlockType.NEURO_RECOVERY,
        eegRationale: 'Phòng ngừa kiệt sức bác sĩ nội trú khi tần suất trực cấp cứu cao.',
        completed: false,
      },
    ],
  });

  // Seed Hardware IoT EEG Devices (ESP32-ADS1299 v3) + Telemetry + Alerts + Sessions
  console.log('[seed] Seeding hardware IoT devices and telemetry...');
  const holterApiKeyHash = createHash('sha256').update('nldev_demo_holter01').digest('hex');
  const clinicApiKeyHash = createHash('sha256').update('nldev_demo_clinic01').digest('hex');

  const holterDevice = await prisma.hardwareDevice.create({
    data: {
      ownerId: generalUser.id,
      deviceCode: 'NL-HOLTER-01',
      name: 'NeuroLink Holter Cá nhân v3 (ESP32-ADS1299)',
      model: 'ESP32_ADS1299_V3',
      firmwareVersion: 'V3.0.0',
      montage: 'neurolink6',
      sampleRateSps: 500,
      pgaGain: 24,
      apiKeyHash: holterApiKeyHash,
      apiKeyPrefix: 'nldev_demo_',
      status: 'ONLINE',
      connectionSource: 'WS_DIRECT',
      ipAddress: '192.168.1.142',
      lastSeenAt: new Date(Date.now() - 45_000),
      lastBatteryMv: 3940,
      lastBatteryPct: 86,
      lastAiState: 'NORMAL',
      lastAiRfProb: 0.084,
      lastAiBsi: 0.051,
      lastAiDar: 1.16,
      lastLeadOffMask: 0,
      sdRecording: false,
    },
  });

  const clinicDevice = await prisma.hardwareDevice.create({
    data: {
      ownerId: doctor.id,
      deviceCode: 'NL-CLINIC-01',
      name: 'NeuroLink Trạm Cấp cứu BV Bạch Mai #01',
      model: 'ESP32_ADS1299_V3',
      firmwareVersion: 'V3.0.0',
      montage: 'neurolink6',
      sampleRateSps: 500,
      pgaGain: 24,
      apiKeyHash: clinicApiKeyHash,
      apiKeyPrefix: 'nldev_demo_',
      status: 'ONLINE',
      connectionSource: 'NODERED_HTTP',
      ipAddress: '10.12.4.88',
      lastSeenAt: new Date(Date.now() - 120_000),
      lastBatteryMv: 4080,
      lastBatteryPct: 95,
      lastAiState: 'NORMAL',
      lastAiRfProb: 0.112,
      lastAiBsi: 0.064,
      lastAiDar: 1.29,
      lastLeadOffMask: 0,
      sdRecording: true,
    },
  });

  const nowMs = Date.now();
  await prisma.deviceTelemetryLog.createMany({
    data: [
      {
        deviceId: holterDevice.id,
        mode: 'EEG',
        rateSps: 500,
        pga: 24,
        actualSps: 499.7,
        vbatMv: 3980,
        batPct: 89,
        usbOnly: false,
        sdRec: false,
        markers: 0,
        loffMask: 0,
        aiState: 'NORMAL',
        aiRfProb: 0.075,
        aiLrProb: 0.068,
        aiBsi: 0.048,
        aiDar: 1.12,
        aiUsableCh: 8,
        source: 'WS_DIRECT',
        recordedAt: new Date(nowMs - 600_000),
      },
      {
        deviceId: holterDevice.id,
        mode: 'EEG',
        rateSps: 500,
        pga: 24,
        actualSps: 499.9,
        vbatMv: 3960,
        batPct: 87,
        usbOnly: false,
        sdRec: true,
        markers: 1,
        loffMask: 0,
        aiState: 'NORMAL',
        aiRfProb: 0.081,
        aiLrProb: 0.072,
        aiBsi: 0.053,
        aiDar: 1.15,
        aiUsableCh: 8,
        source: 'WS_DIRECT',
        recordedAt: new Date(nowMs - 300_000),
      },
      {
        deviceId: holterDevice.id,
        mode: 'EEG',
        rateSps: 500,
        pga: 24,
        actualSps: 499.8,
        vbatMv: 3940,
        batPct: 86,
        usbOnly: false,
        sdRec: false,
        markers: 2,
        loffMask: 0,
        aiState: 'NORMAL',
        aiRfProb: 0.084,
        aiLrProb: 0.074,
        aiBsi: 0.051,
        aiDar: 1.16,
        aiUsableCh: 8,
        source: 'WS_DIRECT',
        recordedAt: new Date(nowMs - 45_000),
      },
      {
        deviceId: clinicDevice.id,
        mode: 'EEG',
        rateSps: 500,
        pga: 24,
        actualSps: 500.0,
        vbatMv: 4100,
        batPct: 96,
        usbOnly: true,
        sdRec: true,
        markers: 3,
        loffMask: 0,
        aiState: 'NORMAL',
        aiRfProb: 0.105,
        aiLrProb: 0.095,
        aiBsi: 0.061,
        aiDar: 1.25,
        aiUsableCh: 8,
        source: 'NODERED_HTTP',
        recordedAt: new Date(nowMs - 420_000),
      },
      {
        deviceId: clinicDevice.id,
        mode: 'EEG',
        rateSps: 500,
        pga: 24,
        actualSps: 499.9,
        vbatMv: 4080,
        batPct: 95,
        usbOnly: true,
        sdRec: true,
        markers: 4,
        loffMask: 0,
        aiState: 'NORMAL',
        aiRfProb: 0.112,
        aiLrProb: 0.099,
        aiBsi: 0.064,
        aiDar: 1.29,
        aiUsableCh: 8,
        source: 'NODERED_HTTP',
        recordedAt: new Date(nowMs - 120_000),
      },
    ],
  });

  await prisma.deviceAlert.createMany({
    data: [
      {
        deviceId: holterDevice.id,
        severity: 'INFO',
        code: 'POST_SELF_TEST_OK',
        message: 'ADS1299 8 kênh tự kiểm tra POST đạt nhiễu nền 0.28 uVrms; tất cả 8 điện cực tiếp xúc tốt.',
        acknowledged: true,
        acknowledgedAt: new Date(nowMs - 550_000),
        createdAt: new Date(nowMs - 600_000),
      },
      {
        deviceId: clinicDevice.id,
        severity: 'WARNING',
        code: 'LEAD_OFF',
        message: 'Phát hiện trở kháng tiếp xúc tăng thoáng qua trên kênh C3 (CH3) trong lúc gắn mũ đo.',
        acknowledged: false,
        createdAt: new Date(nowMs - 180_000),
      },
    ],
  });

  const baselineQeeg = analyzeCaseTs({ caseId: 'case_ads1299_hardware', timeWindowSec: 4, notch50Hz: true });
  const clinicalQeeg = analyzeCaseTs({ caseId: 'case_healthy_alpha', timeWindowSec: 4, notch50Hz: true });

  await prisma.deviceRecordingSession.createMany({
    data: [
      {
        deviceId: holterDevice.id,
        ownerId: generalUser.id,
        title: 'Phiên đo Baseline buổi sáng · NL-HOLTER-01',
        montage: 'neurolink6',
        sampleRateSps: 500,
        channelNames: ['F3', 'F4', 'C3', 'C4', 'O1', 'O2', 'T3', 'T4'],
        sampleCount: 2000,
        durationSec: 4.0,
        csvSummary: 'F3,F4,C3,C4,O1,O2,T3,T4\n1.24,-0.88,2.11,-1.04,12.40,11.95,0.52,-0.41',
        qeegResultJson: baselineQeeg ? JSON.parse(JSON.stringify(baselineQeeg)) : undefined,
        startedAt: new Date(nowMs - 900_000),
        endedAt: new Date(nowMs - 896_000),
      },
      {
        deviceId: clinicDevice.id,
        ownerId: doctor.id,
        title: 'Đo đối chứng Alpha chẩm 10 Hz · NL-CLINIC-01',
        montage: 'neurolink6',
        sampleRateSps: 500,
        channelNames: ['F3', 'F4', 'C3', 'C4', 'O1', 'O2', 'T3', 'T4'],
        sampleCount: 2000,
        durationSec: 4.0,
        csvSummary: 'F3,F4,C3,C4,O1,O2,T3,T4\n0.85,0.92,1.12,1.08,18.20,17.84,0.34,0.29',
        qeegResultJson: clinicalQeeg ? JSON.parse(JSON.stringify(clinicalQeeg)) : undefined,
        startedAt: new Date(nowMs - 700_000),
        endedAt: new Date(nowMs - 696_000),
      },
    ],
  });

  // Seal HMAC-SHA256 cryptographic ledger chains for all seeded wallets
  for (const u of [
    admin,
    doctor,
    researcher,
    student,
    generalUser,
    healthcareWorker,
    residentDoctor,
  ]) {
    const check = await verifyWalletIntegrity(u.id);
    if (!check.valid) {
      throw new Error(`Seeded wallet integrity check failed for ${u.username}`);
    }
  }

  void courseReward;
  void confReward;

  console.log('[seed] Seeding completed successfully!');
  console.log('[seed] Demo accounts:');
  console.log(' - Admin: admin / Password123');
  console.log(' - Doctor: dr_minh / Password123 (Verified)');
  console.log(' - Resident Overtime Doctor: bs_noitru_khang / Password123 (Verified)');
  console.log(' - Researcher: prof_lan / Password123 (Verified)');
  console.log(' - Student: tuan_bme / Password123 (Pending verification)');
  console.log(' - General User: hoa_health / Password123');
}

main()
  .catch((e) => {
    console.error('[seed] Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
