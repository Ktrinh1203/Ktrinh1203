import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PrismaClient, Role, VerificationStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { buildDocumentEvidenceDossier } from '../src/modules/verification/ocr.service.js';
import { PRIVATE_VERIFICATION_DIR } from '../src/middleware/uploadVerification.js';

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

  // Clean existing seed data safely
  await prisma.rewardRedemption.deleteMany();
  await prisma.creditTransaction.deleteMany();
  await prisma.creditWallet.deleteMany();
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
      content: `[Chia sẻ ca lâm sàng & Học thuật]\n\nPhân biệt hiện tượng co giật do tâm lý (PNES - Psychogenic Non-Epileptic Seizures) và cơn động kinh thực tổn qua quan sát lâm sàng và ghi đo điện não video liên tục (Video-EEG monitoring).\n\nTrong thực tế lâm sàng, có tới 20-30% bệnh nhân được chuyển đến các trung tâm động kinh chuyên sâu thực chất mắc PNES. Việc chẩn đoán nhầm dẫn đến điều trị thuốc kháng động kinh kéo dài không cần thiết.\n\nCác bạn đồng nghiệp có kinh nghiệm kết hợp test kích hoạt (provocative testing) trong các ca này xin cùng thảo luận!`,
    },
  });

  const post2 = await prisma.post.create({
    data: {
      authorId: researcher.id,
      content: `Nhóm nghiên cứu BCI của chúng tôi vừa hoàn thành thử nghiệm tiền lâm sàng về mô hình Spatial-Temporal Transformer để giải mã ý định vận động (Motor Imagery) từ các điện cực C3, Cz, C4.\n\nKết quả cho thấy độ chính xác phân loại 4 lớp chuyển động tay/chân đạt trên 86.4% với độ trễ xử lý dưới 50ms, mở ra triển vọng cho các thiết bị hỗ trợ phục hồi chức năng sau đột quỵ.\n\nSinh viên và các nhà nghiên cứu quan tâm có thể nhắn tin trao đổi về hướng hợp tác này!`,
    },
  });

  const post3 = await prisma.post.create({
    data: {
      authorId: student.id,
      content: `Em đang tìm hiểu về thuật toán Common Spatial Pattern (CSP) kết hợp bộ lọc Filter Bank (FBCSP) trong tiền xử lý tín hiệu não. Cho em hỏi các thầy cô và anh chị có kinh nghiệm thường chọn dải tần số nào là tối ưu nhất cho dải mu (8-12Hz) và beta (16-24Hz) khi người dùng tưởng tượng nắm tay ạ?`,
    },
  });

  // Comments
  await prisma.comment.create({
    data: {
      postId: post1.id,
      authorId: researcher.id,
      content:
        'Cảm ơn BS Minh đã chia sẻ góc nhìn lâm sàng rất rõ nét. Bên nhóm nghiên cứu của tôi cũng đang tìm cách ứng dụng phát hiện bất đối xứng bán cầu để hỗ trợ phân loại sơ bộ trước khi bác sĩ đọc băng ghi dài.',
    },
  });

  await prisma.comment.create({
    data: {
      postId: post3.id,
      authorId: researcher.id,
      content:
        'Chào Tuấn, thông thường với FBCSP người ta chia thành các sub-band 4Hz chồng lấn nhẹ (ví dụ 4-8, 8-12, 12-16... đến 36-40Hz), sau đó dùng Mutual Information để tự động chọn lọc các dải có tính phân tách cao nhất.',
    },
  });

  await prisma.comment.create({
    data: {
      postId: post3.id,
      authorId: doctor.id,
      content:
        'Ngoài lý thuyết tín hiệu, trên lâm sàng sóng mu thường suy giảm mạnh (Event-Related Desynchronization - ERD) ngay trước khi cử động thật hoặc cử động tưởng tượng ở vùng vỏ não cảm giác - vận động đối bên.',
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

  const walletMinh = await prisma.creditWallet.create({
    data: {
      userId: doctor.id,
      balance: 300,
      totalEarned: 300,
      totalSpent: 0,
    },
  });

  await prisma.creditTransaction.create({
    data: {
      walletId: walletMinh.id,
      amount: 300,
      type: 'CONTRIBUTION_REWARD',
      referenceId: contribMinh.id,
      idempotencyKey: `contribution-reward:${contribMinh.id}`,
      description: 'Khen thưởng bài đóng góp học thuật/chuyên môn (HEALTHCARE_EDUCATION): +300 tín chỉ',
      actorId: admin.id,
      contributionId: contribMinh.id,
    },
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
      balance: 450,
      totalEarned: 450,
      totalSpent: 0,
    },
  });

  await prisma.creditTransaction.create({
    data: {
      walletId: walletLan.id,
      amount: 450,
      type: 'CONTRIBUTION_REWARD',
      referenceId: contribLan.id,
      idempotencyKey: `contribution-reward:${contribLan.id}`,
      description: 'Khen thưởng bài đóng góp học thuật/chuyên môn (RESEARCH_CONTRIBUTION): +450 tín chỉ',
      actorId: admin.id,
      contributionId: contribLan.id,
    },
  });

  void courseReward;
  void confReward;

  console.log('[seed] Seeding completed successfully!');
  console.log('[seed] Demo accounts:');
  console.log(' - Admin: admin / Password123');
  console.log(' - Doctor: dr_minh / Password123 (Verified)');
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
