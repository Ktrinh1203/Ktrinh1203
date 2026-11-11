import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import { assertVerifiedProfessional } from '../contributions/contributions.service.js';

export type CommunityCategory = 'clinical' | 'research' | 'patient' | 'general';

export interface CommunityRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  category: CommunityCategory;
  specialtyLabel: string;
  baseMembersCount: number;
  discussionsCount: number;
  activeProtocolsCount: number;
  isVerifiedOnly: boolean;
  leadInstitution: string;
  memberUsernames: Set<string>;
  memberUserIds: Set<string>;
}

export interface CommunityItemDto {
  id: string;
  code: string;
  name: string;
  description: string;
  category: CommunityCategory;
  specialtyLabel: string;
  membersCount: number;
  discussionsCount: number;
  activeProtocolsCount: number;
  isMember: boolean;
  isVerifiedOnly: boolean;
  leadInstitution: string;
}

const communityStore = new Map<string, CommunityRecord>();
let defaultsSeeded = false;

function buildDefaultCommunities(): CommunityRecord[] {
  return [
    {
      id: 'comm-01',
      code: 'BRD-NEURO-01',
      name: 'Hội Thần kinh học Lâm sàng & Đọc Bản đồ Não',
      description:
        'Diễn đàn hội chẩn ca bệnh thần kinh phức tạp, phân tích Video-EEG đa đạo trình và cập nhật phác đồ điều trị động kinh kháng thuốc.',
      category: 'clinical',
      specialtyLabel: 'Thần kinh Lâm sàng · Video-EEG',
      baseMembersCount: 410,
      discussionsCount: 185,
      activeProtocolsCount: 6,
      isVerifiedOnly: true,
      leadInstitution: 'BV Bạch Mai & ĐH Y Hà Nội',
      memberUsernames: new Set(['dr_minh', 'prof_lan']),
      memberUserIds: new Set(),
    },
    {
      id: 'comm-02',
      code: 'LAB-BCI-02',
      name: 'BCI & Neural Signal Processing Consortium',
      description:
        'Nhóm nghiên cứu liên viện tập trung giải mã tín hiệu điện não đồ (ERD/ERS, P300, SSVEP), lọc nhiễu ICA và mô hình hóa giao diện não - máy tính.',
      category: 'research',
      specialtyLabel: 'Kỹ thuật Y sinh · DSP / BCI',
      baseMembersCount: 288,
      discussionsCount: 94,
      activeProtocolsCount: 9,
      isVerifiedOnly: true,
      leadInstitution: 'Phòng thí nghiệm Trọng điểm BCI & AI',
      memberUsernames: new Set(['prof_lan']),
      memberUserIds: new Set(),
    },
    {
      id: 'comm-03',
      code: 'BRD-PNES-03',
      name: 'Hội đồng Thẩm định Ca Co giật & Tâm thần kinh (PNES vs Epilepsy)',
      description:
        'Chuyên trang thảo luận phân biệt cơn co giật nguồn gốc tâm lý (PNES) và động kinh thực tổn, hạn chế lạm dụng thuốc chống động kinh.',
      category: 'clinical',
      specialtyLabel: 'Tâm thần kinh · Chẩn đoán Phân biệt',
      baseMembersCount: 178,
      discussionsCount: 62,
      activeProtocolsCount: 4,
      isVerifiedOnly: true,
      leadInstitution: 'BV Chợ Rẫy & BV Đại học Y Dược',
      memberUsernames: new Set(),
      memberUserIds: new Set(),
    },
    {
      id: 'comm-04',
      code: 'COM-CARE-04',
      name: 'Đồng hành cùng Bệnh nhân Động kinh & Người nhà',
      description:
        'Không gian chia sẻ kinh nghiệm sống khỏe, tuân thủ dùng thuốc, phòng ngừa chấn thương khi co giật và hỗ trợ tâm lý từ cộng đồng.',
      category: 'patient',
      specialtyLabel: 'Chăm sóc & Hỗ trợ Người bệnh',
      baseMembersCount: 1238,
      discussionsCount: 420,
      activeProtocolsCount: 2,
      isVerifiedOnly: false,
      leadInstitution: 'Mạng lưới Hỗ trợ Bệnh nhân NeuroLink',
      memberUsernames: new Set(['hoa_health', 'dr_minh']),
      memberUserIds: new Set(),
    },
    {
      id: 'comm-05',
      code: 'COM-SLEEP-05',
      name: 'Tối ưu Giấc ngủ & Nhịp Sóng Não Tự nhiên',
      description:
        'Cộng đồng trao đổi kiến thức khoa học dễ hiểu về cải thiện pha ngủ sâu N3, giảm mất ngủ kinh niên và tăng cường sự tỉnh táo ban ngày.',
      category: 'general',
      specialtyLabel: 'Giấc ngủ & Sức khỏe Thường thức',
      baseMembersCount: 890,
      discussionsCount: 230,
      activeProtocolsCount: 3,
      isVerifiedOnly: false,
      leadInstitution: 'Chuyên mục Sức khỏe Giấc ngủ',
      memberUsernames: new Set(),
      memberUserIds: new Set(),
    },
    {
      id: 'comm-06',
      code: 'COM-BRAIN-06',
      name: 'Khám phá Não bộ & Sóng não cho Người mới bắt đầu',
      description:
        'Dành cho người yêu thích khoa học thần kinh, tìm hiểu nguyên lý đo điện não bề mặt và cách đọc các chỉ số sóng Alpha, Beta, Theta.',
      category: 'general',
      specialtyLabel: 'Khoa học Thần kinh Phổ thông',
      baseMembersCount: 649,
      discussionsCount: 115,
      activeProtocolsCount: 1,
      isVerifiedOnly: false,
      leadInstitution: 'Cộng đồng Khoa học Mở NeuroLink',
      memberUsernames: new Set(['tuan_bme']),
      memberUserIds: new Set(),
    },
  ];
}

function ensureDefaultsSeeded() {
  if (!defaultsSeeded) {
    for (const c of buildDefaultCommunities()) {
      communityStore.set(c.id, c);
    }
    defaultsSeeded = true;
  }
}

export function resetCommunityStore() {
  communityStore.clear();
  defaultsSeeded = false;
  ensureDefaultsSeeded();
}

function isUserMember(rec: CommunityRecord, user: { id: string; username: string }): boolean {
  return rec.memberUserIds.has(user.id) || rec.memberUsernames.has(user.username.toLowerCase());
}

function toDto(rec: CommunityRecord, user: { id: string; username: string }): CommunityItemDto {
  const dynamicMembers = new Set<string>([
    ...Array.from(rec.memberUsernames),
    ...Array.from(rec.memberUserIds),
  ]).size;

  return {
    id: rec.id,
    code: rec.code,
    name: rec.name,
    description: rec.description,
    category: rec.category,
    specialtyLabel: rec.specialtyLabel,
    membersCount: rec.baseMembersCount + dynamicMembers,
    discussionsCount: rec.discussionsCount,
    activeProtocolsCount: rec.activeProtocolsCount,
    isMember: isUserMember(rec, user),
    isVerifiedOnly: rec.isVerifiedOnly,
    leadInstitution: rec.leadInstitution,
  };
}

/**
 * Lists all communities from the unified platform store for both General Mode and Professional Mode.
 */
export async function listCommunities(
  userId: string,
  query?: { category?: string; q?: string },
): Promise<CommunityItemDto[]> {
  ensureDefaultsSeeded();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('User not found');

  let items = Array.from(communityStore.values()).map((rec) => toDto(rec, user));

  if (query?.category && query.category !== 'all') {
    items = items.filter((c) => c.category === query.category);
  }

  if (query?.q?.trim()) {
    const q = query.q.trim().toLowerCase();
    items = items.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.specialtyLabel.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }

  return items;
}

/**
 * Joins a community.
 * SECURITY INVARIANT: If the community is a verified-only professional board (`isVerifiedOnly === true`),
 * the backend independently validates that the user holds a VERIFIED professional credential.
 */
export async function joinCommunity(
  communityId: string,
  userId: string,
): Promise<CommunityItemDto> {
  ensureDefaultsSeeded();
  const rec = communityStore.get(communityId);
  if (!rec) throw notFound('Cộng đồng / Hội đồng không tồn tại');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('User not found');

  if (rec.isVerifiedOnly) {
    await assertVerifiedProfessional(userId);
  }

  rec.memberUsernames.add(user.username.toLowerCase());
  rec.memberUserIds.delete(user.id);

  return toDto(rec, user);
}

/**
 * Leaves a community.
 */
export async function leaveCommunity(
  communityId: string,
  userId: string,
): Promise<CommunityItemDto> {
  ensureDefaultsSeeded();
  const rec = communityStore.get(communityId);
  if (!rec) throw notFound('Cộng đồng / Hội đồng không tồn tại');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('User not found');

  rec.memberUsernames.delete(user.username.toLowerCase());
  rec.memberUserIds.delete(user.id);

  return toDto(rec, user);
}
