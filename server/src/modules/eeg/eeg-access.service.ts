import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { AppError, badRequest, forbidden, notFound } from '../../lib/errors.js';
import { assertVerifiedProfessional } from '../contributions/contributions.service.js';

export interface ConsentedProfessionalEntry {
  userId: string;
  username: string;
  displayName: string;
  title: string;
  specialty: string;
  grantedAt: string;
}

export interface EegAccessHistoryEntry {
  id: string;
  action: 'DATASET_REGISTERED' | 'CONSENT_GRANTED' | 'CONSENT_REVOKED' | 'DATASET_ACCESSED';
  actorUsername: string;
  actorDisplayName: string;
  targetProfessional?: string;
  timestamp: string;
  note: string;
}

export interface EegDatasetRecord {
  id: string;
  ownerId: string;
  ownerUsername: string;
  patientCode: string;
  title: string;
  date: string;
  duration: string;
  samplingRate: string;
  channelsCount: number;
  montage: string;
  filter: string;
  status: 'ANALYZED' | 'REVIEW_PENDING' | 'RAW_RECORDING';
  clinicalNote: string;
  consentedProfessionals: ConsentedProfessionalEntry[];
  accessHistory: EegAccessHistoryEntry[];
}

const datasetStore = new Map<string, EegDatasetRecord>();
let defaultsSeeded = false;

function buildDefaultDatasets(): EegDatasetRecord[] {
  return [
    {
      id: 'rec-01',
      ownerId: 'seed-owner-hoa',
      ownerUsername: 'hoa_health',
      patientCode: 'BN-****84 (Ẩn danh)',
      title: 'Ghi điện não đồ bề mặt: Thử nghiệm kích thích vận động tinh tay phải (Motor Imagery)',
      date: '04/11/2026 09:15',
      duration: '18 phút 42 giây',
      samplingRate: '250 Hz',
      channelsCount: 8,
      montage: 'Hệ thống quốc tế 10-20 (C3, C4, Cz, Fz, Pz, F3, F4, Oz)',
      filter: 'Dải thông 0.5 - 70 Hz · Bộ lọc khuyết 50 Hz Notch',
      status: 'ANALYZED',
      clinicalNote:
        'Phát hiện sự giảm đồng bộ liên quan đến sự kiện (ERD) rõ rệt tại đạo trình C3 trong dải sóng Mu (8-12 Hz) và Beta (18-24 Hz) khi bệnh nhân tưởng tượng nắm bàn tay phải.',
      consentedProfessionals: [
        {
          userId: 'seed-dr-minh',
          username: 'dr_minh',
          displayName: 'BS. CKII Nguyễn Văn Minh',
          title: 'Bác sĩ Chuyên khoa II Thần kinh',
          specialty: 'Thần kinh học lâm sàng',
          grantedAt: '2026-11-04T09:20:00.000Z',
        },
        {
          userId: 'seed-prof-lan',
          username: 'prof_lan',
          displayName: 'PGS. TS. Trần Mai Lan',
          title: 'Phó Giáo sư, Trưởng phòng thí nghiệm BCI',
          specialty: 'Khoa học thần kinh tính toán',
          grantedAt: '2026-11-04T09:25:00.000Z',
        },
      ],
      accessHistory: [
        {
          id: 'hist-01',
          action: 'DATASET_REGISTERED',
          actorUsername: 'hoa_health',
          actorDisplayName: 'Nguyễn Thanh Hoa',
          timestamp: '2026-11-04T09:15:00.000Z',
          note: 'Tải lên bản ghi điện não đồ cá nhân (8 kênh, 250 Hz)',
        },
        {
          id: 'hist-02',
          action: 'CONSENT_GRANTED',
          actorUsername: 'hoa_health',
          actorDisplayName: 'Nguyễn Thanh Hoa',
          targetProfessional: 'BS. CKII Nguyễn Văn Minh (@dr_minh)',
          timestamp: '2026-11-04T09:20:00.000Z',
          note: 'Chủ sở hữu dữ liệu cấp quyền đọc bản ghi lâm sàng',
        },
      ],
    },
    {
      id: 'rec-02',
      ownerId: 'seed-owner-hoa',
      ownerUsername: 'hoa_health',
      patientCode: 'BN-****29 (Ẩn danh)',
      title: 'Đánh giá hoạt động điện não giấc ngủ ban đêm & Động kinh thùy thái dương',
      date: '31/10/2026 22:40',
      duration: '45 phút',
      samplingRate: '500 Hz',
      channelsCount: 16,
      montage: 'Hệ thống quốc tế 10-20 chuẩn lưỡng cực',
      filter: '0.1 - 100 Hz · Notch 50 Hz',
      status: 'REVIEW_PENDING',
      clinicalNote:
        'Xuất hiện rải rác phức hợp nhọn - sóng chậm đồng thì vùng thái dương - đỉnh bán cầu trái trong pha ngủ sâu N3.',
      consentedProfessionals: [
        {
          userId: 'seed-dr-minh',
          username: 'dr_minh',
          displayName: 'BS. CKII Nguyễn Văn Minh',
          title: 'Bác sĩ Chuyên khoa II Thần kinh',
          specialty: 'Thần kinh học lâm sàng',
          grantedAt: '2026-10-31T22:45:00.000Z',
        },
      ],
      accessHistory: [
        {
          id: 'hist-03',
          action: 'CONSENT_GRANTED',
          actorUsername: 'hoa_health',
          actorDisplayName: 'Nguyễn Thanh Hoa',
          targetProfessional: 'BS. CKII Nguyễn Văn Minh (@dr_minh)',
          timestamp: '2026-10-31T22:45:00.000Z',
          note: 'Cấp quyền riêng cho BS. Nguyễn Văn Minh hội chẩn giấc ngủ N3',
        },
      ],
    },
    {
      id: 'rec-03',
      ownerId: 'seed-owner-tuan',
      ownerUsername: 'tuan_bme',
      patientCode: 'BN-****12 (Ẩn danh)',
      title: 'Tập dữ liệu EEG thô: Giao diện Não - Máy tính (BCI P300 Speller Trial)',
      date: '28/10/2026 14:20',
      duration: '12 phút 10 giây',
      samplingRate: '250 Hz',
      channelsCount: 8,
      montage: 'Fz, Cz, P3, Pz, P4, Oz, O1, O2',
      filter: '0.5 - 30 Hz',
      status: 'RAW_RECORDING',
      clinicalNote:
        'Sóng dương P300 xuất hiện biên độ đỉnh ~12 µV sau kích thích thị giác 320ms tại điện cực Pz.',
      consentedProfessionals: [
        {
          userId: 'seed-prof-lan',
          username: 'prof_lan',
          displayName: 'PGS. TS. Trần Mai Lan',
          title: 'Phó Giáo sư, Trưởng phòng thí nghiệm BCI',
          specialty: 'Khoa học thần kinh tính toán',
          grantedAt: '2026-10-28T14:25:00.000Z',
        },
      ],
      accessHistory: [
        {
          id: 'hist-04',
          action: 'CONSENT_GRANTED',
          actorUsername: 'tuan_bme',
          actorDisplayName: 'Lê Quốc Tuấn',
          targetProfessional: 'PGS. TS. Trần Mai Lan (@prof_lan)',
          timestamp: '2026-10-28T14:25:00.000Z',
          note: 'Chia sẻ tập dữ liệu thử nghiệm P300 cho giảng viên hướng dẫn',
        },
      ],
    },
  ];
}

function ensureDefaultsSeeded() {
  if (!defaultsSeeded) {
    for (const rec of buildDefaultDatasets()) {
      datasetStore.set(rec.id, rec);
    }
    defaultsSeeded = true;
  }
}

export function resetEegDatasetStore() {
  datasetStore.clear();
  defaultsSeeded = false;
  ensureDefaultsSeeded();
}

function isDataOwner(dataset: EegDatasetRecord, user: { id: string; username: string }): boolean {
  return dataset.ownerId === user.id || dataset.ownerUsername === user.username;
}

function hasActiveConsent(
  dataset: EegDatasetRecord,
  professional: { id: string; username: string },
): boolean {
  return dataset.consentedProfessionals.some(
    (c) => c.userId === professional.id || c.username === professional.username,
  );
}

/**
 * Lists personal EEG datasets owned by the authenticated user (General Mode: My EEG).
 */
export async function getMyPersonalDatasets(userId: string) {
  ensureDefaultsSeeded();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('User not found');

  const owned = Array.from(datasetStore.values()).filter((d) => isDataOwner(d, user));
  return owned;
}

/**
 * Registers a new personal EEG dataset record owned by the authenticated user.
 * Starts with zero consented professionals (explicit consent required before any professional can view).
 */
export async function createPersonalDataset(
  userId: string,
  input: {
    title: string;
    duration?: string;
    samplingRate?: string;
    channelsCount?: number;
    montage?: string;
    filter?: string;
    clinicalNote?: string;
  },
) {
  ensureDefaultsSeeded();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('User not found');

  const id = `rec-${randomUUID().slice(0, 8)}`;
  const nowIso = new Date().toISOString();
  const record: EegDatasetRecord = {
    id,
    ownerId: user.id,
    ownerUsername: user.username,
    patientCode: `BN-****${Math.floor(10 + Math.random() * 89)} (Ẩn danh)`,
    title: input.title.trim(),
    date: new Date().toLocaleDateString('vi-VN'),
    duration: input.duration || '15 phút 00 giây',
    samplingRate: input.samplingRate || '250 Hz',
    channelsCount: input.channelsCount ?? 8,
    montage: input.montage || 'Hệ thống quốc tế 10-20 (C3, C4, Cz, Fz, Pz, O1, O2)',
    filter: input.filter || '0.5 - 70 Hz · Notch 50 Hz',
    status: 'RAW_RECORDING',
    clinicalNote:
      input.clinicalNote ||
      'Bản ghi điện não đồ cá nhân mới tải lên. Chờ chủ sở hữu cấp quyền cho bác sĩ chuyên khoa đọc kết quả.',
    consentedProfessionals: [],
    accessHistory: [
      {
        id: `hist-${randomUUID().slice(0, 8)}`,
        action: 'DATASET_REGISTERED',
        actorUsername: user.username,
        actorDisplayName: user.displayName,
        timestamp: nowIso,
        note: 'Người dùng tạo bản ghi EEG cá nhân (Mặc định khoá riêng tư 100%)',
      },
    ],
  };

  datasetStore.set(id, record);
  return record;
}

/**
 * Lists EEG datasets accessible in the Professional EEG Workspace.
 *
 * SECURITY INVARIANTS:
 * 1. Caller MUST be a verified professional (assertVerifiedProfessional).
 * 2. Professional status does NOT automatically grant access to every patient's EEG data.
 *    Only datasets where the data owner has explicitly granted consent to this professional
 *    (or datasets owned by the professional themselves) are returned.
 */
export async function getWorkspaceDatasetsForProfessional(userId: string) {
  ensureDefaultsSeeded();
  // Independent backend verification check (ignores frontend mode state)
  await assertVerifiedProfessional(userId);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('User not found');

  return Array.from(datasetStore.values()).filter(
    (d) => isDataOwner(d, user) || hasActiveConsent(d, user),
  );
}

/**
 * Retrieves a single EEG dataset by ID, enforcing strict ownership or verified professional + explicit consent.
 */
export async function getDatasetByIdWithConsentCheck(datasetId: string, userId: string) {
  ensureDefaultsSeeded();
  const dataset = datasetStore.get(datasetId);
  if (!dataset) throw notFound('Bản ghi EEG không tồn tại');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('User not found');

  // 1. Data owner always has access to their own dataset
  if (isDataOwner(dataset, user)) {
    return dataset;
  }

  // 2. Non-owner MUST be a verified professional
  await assertVerifiedProfessional(userId);

  // 3. Verified professional MUST hold explicit data-owner consent for this specific dataset
  if (!hasActiveConsent(dataset, user)) {
    throw new AppError(
      403,
      'EEG_CONSENT_REQUIRED',
      'Trạng thái Chuyên gia không tự động cấp quyền xem mọi dữ liệu EEG của bệnh nhân. Bạn cần được chủ sở hữu dữ liệu cấp quyền (Data-Owner Consent) cho bản ghi này.',
    );
  }

  // Record access in immutable dataset history
  dataset.accessHistory.unshift({
    id: `hist-${randomUUID().slice(0, 8)}`,
    action: 'DATASET_ACCESSED',
    actorUsername: user.username,
    actorDisplayName: user.displayName,
    timestamp: new Date().toISOString(),
    note: `Chuyên gia @${user.username} đã truy cập xem đạo trình EEG theo uỷ quyền`,
  });

  return dataset;
}

/**
 * Grants explicit data-owner consent to a verified professional.
 * ONLY the dataset owner may grant consent.
 */
export async function grantDatasetConsent(
  datasetId: string,
  actorUserId: string,
  professionalUsernameOrId: string,
) {
  ensureDefaultsSeeded();
  const dataset = datasetStore.get(datasetId);
  if (!dataset) throw notFound('Bản ghi EEG không tồn tại');

  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor) throw notFound('User not found');

  if (!isDataOwner(dataset, actor)) {
    throw new AppError(
      403,
      'ONLY_DATA_OWNER_CAN_MANAGE_CONSENT',
      'Chỉ chủ sở hữu dữ liệu EEG mới có quyền cấp hoặc thu hồi quyền truy cập của chuyên gia.',
    );
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    professionalUsernameOrId,
  );
  const targetUser = await prisma.user.findFirst({
    where: isUuid
      ? { id: professionalUsernameOrId }
      : { username: professionalUsernameOrId.toLowerCase() },
    include: {
      professionalProfiles: {
        where: { verificationStatus: 'VERIFIED' },
      },
    },
  });

  if (!targetUser) {
    throw notFound('Không tìm thấy tài khoản chuyên gia');
  }

  const verifiedProfile = targetUser.professionalProfiles[0];
  if (!verifiedProfile) {
    throw badRequest(
      'TARGET_NOT_VERIFIED_PROFESSIONAL: Chỉ có thể cấp quyền truy cập EEG cho Bác sĩ hoặc Nhà nghiên cứu đã được xác minh tích xanh.',
    );
  }

  const alreadyConsented = hasActiveConsent(dataset, targetUser);
  if (!alreadyConsented) {
    dataset.consentedProfessionals.push({
      userId: targetUser.id,
      username: targetUser.username,
      displayName: targetUser.displayName,
      title: verifiedProfile.title,
      specialty: verifiedProfile.specialty,
      grantedAt: new Date().toISOString(),
    });

    dataset.accessHistory.unshift({
      id: `hist-${randomUUID().slice(0, 8)}`,
      action: 'CONSENT_GRANTED',
      actorUsername: actor.username,
      actorDisplayName: actor.displayName,
      targetProfessional: `${targetUser.displayName} (@${targetUser.username})`,
      timestamp: new Date().toISOString(),
      note: `Chủ sở hữu dữ liệu cấp quyền truy cập cho ${verifiedProfile.title} ${targetUser.displayName}`,
    });
  }

  return dataset;
}

/**
 * Revokes a professional's consent to access an EEG dataset.
 * ONLY the dataset owner may revoke consent.
 */
export async function revokeDatasetConsent(
  datasetId: string,
  actorUserId: string,
  professionalUsernameOrId: string,
) {
  ensureDefaultsSeeded();
  const dataset = datasetStore.get(datasetId);
  if (!dataset) throw notFound('Bản ghi EEG không tồn tại');

  const actor = await prisma.user.findUnique({ where: { id: actorUserId } });
  if (!actor) throw notFound('User not found');

  if (!isDataOwner(dataset, actor)) {
    throw new AppError(
      403,
      'ONLY_DATA_OWNER_CAN_MANAGE_CONSENT',
      'Chỉ chủ sở hữu dữ liệu EEG mới có quyền thu hồi quyền truy cập của chuyên gia.',
    );
  }

  const beforeCount = dataset.consentedProfessionals.length;
  const removedTarget = dataset.consentedProfessionals.find(
    (c) =>
      c.userId === professionalUsernameOrId ||
      c.username.toLowerCase() === professionalUsernameOrId.toLowerCase(),
  );

  dataset.consentedProfessionals = dataset.consentedProfessionals.filter(
    (c) =>
      c.userId !== professionalUsernameOrId &&
      c.username.toLowerCase() !== professionalUsernameOrId.toLowerCase(),
  );

  if (dataset.consentedProfessionals.length < beforeCount && removedTarget) {
    dataset.accessHistory.unshift({
      id: `hist-${randomUUID().slice(0, 8)}`,
      action: 'CONSENT_REVOKED',
      actorUsername: actor.username,
      actorDisplayName: actor.displayName,
      targetProfessional: `${removedTarget.displayName} (@${removedTarget.username})`,
      timestamp: new Date().toISOString(),
      note: `Chủ sở hữu dữ liệu đã thu hồi quyền truy cập của @${removedTarget.username}`,
    });
  }

  return dataset;
}
