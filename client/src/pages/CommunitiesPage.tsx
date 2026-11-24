import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  MessageSquare,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { communitiesApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type { CommunityItem } from '../api/types';
import { Alert, Button, Card, EmptyState } from '../components/ui';
import { useMode } from '../context/ModeContext';

export const FALLBACK_COMMUNITIES: CommunityItem[] = [
  {
    id: 'comm-01',
    code: 'BRD-NEURO-01',
    name: 'Hội Thần kinh học Lâm sàng & Đọc Bản đồ Não',
    description:
      'Hội chẩn ca bệnh thần kinh, phân tích Video-EEG đa đạo trình và cập nhật phác đồ động kinh.',
    category: 'clinical',
    specialtyLabel: 'Thần kinh Lâm sàng',
    membersCount: 412,
    discussionsCount: 185,
    activeProtocolsCount: 6,
    isMember: true,
    isVerifiedOnly: true,
    leadInstitution: 'BV Bạch Mai & ĐH Y Hà Nội',
  },
  {
    id: 'comm-02',
    code: 'LAB-BCI-02',
    name: 'BCI & Neural Signal Processing Consortium',
    description:
      'Nghiên cứu giải mã tín hiệu điện não đồ (ERD/ERS, P300, SSVEP), lọc nhiễu ICA và giao diện não - máy.',
    category: 'research',
    specialtyLabel: 'Kỹ thuật Y sinh · BCI',
    membersCount: 289,
    discussionsCount: 94,
    activeProtocolsCount: 9,
    isMember: false,
    isVerifiedOnly: true,
    leadInstitution: 'Phòng thí nghiệm BCI & AI',
  },
  {
    id: 'comm-03',
    code: 'BRD-PNES-03',
    name: 'Hội đồng Thẩm định Ca Co giật & Tâm thần kinh',
    description:
      'Thảo luận phân biệt cơn co giật nguồn gốc tâm lý (PNES) và động kinh thực tổn.',
    category: 'clinical',
    specialtyLabel: 'Tâm thần kinh',
    membersCount: 178,
    discussionsCount: 62,
    activeProtocolsCount: 4,
    isMember: false,
    isVerifiedOnly: true,
    leadInstitution: 'BV Chợ Rẫy & BV ĐH Y Dược',
  },
  {
    id: 'comm-04',
    code: 'COM-CARE-04',
    name: 'Đồng hành cùng Bệnh nhân Động kinh & Người nhà',
    description:
      'Chia sẻ kinh nghiệm sống khỏe, tuân thủ dùng thuốc và hỗ trợ tâm lý từ cộng đồng.',
    category: 'patient',
    specialtyLabel: 'Hỗ trợ Người bệnh',
    membersCount: 1240,
    discussionsCount: 420,
    activeProtocolsCount: 2,
    isMember: true,
    isVerifiedOnly: false,
    leadInstitution: 'Cộng đồng NeuroLink',
  },
  {
    id: 'comm-05',
    code: 'COM-SLEEP-05',
    name: 'Tối ưu Giấc ngủ & Nhịp Sóng Não Tự nhiên',
    description:
      'Trao đổi kiến thức cải thiện giấc ngủ sâu, giảm mất ngủ và tăng sự tỉnh táo ban ngày.',
    category: 'general',
    specialtyLabel: 'Giấc ngủ & Sức khỏe',
    membersCount: 890,
    discussionsCount: 230,
    activeProtocolsCount: 3,
    isMember: false,
    isVerifiedOnly: false,
    leadInstitution: 'Chuyên mục Giấc ngủ',
  },
  {
    id: 'comm-06',
    code: 'COM-BRAIN-06',
    name: 'Khám phá Não bộ & Sóng não cho Người mới',
    description:
      'Tìm hiểu nguyên lý đo điện não và cách đọc các chỉ số sóng Alpha, Beta, Theta dễ hiểu.',
    category: 'general',
    specialtyLabel: 'Kiến thức Não bộ',
    membersCount: 650,
    discussionsCount: 115,
    activeProtocolsCount: 1,
    isMember: false,
    isVerifiedOnly: false,
    leadInstitution: 'Cộng đồng Mở NeuroLink',
  },
];

export function CommunitiesPage() {
  const { isProfessional } = useMode();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'clinical' | 'research' | 'patient' | 'general'>('all');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const { data } = useQuery({
    queryKey: ['communities'],
    queryFn: () => communitiesApi.list(),
    initialData: { communities: FALLBACK_COMMUNITIES },
    staleTime: 30_000,
  });

  const communities = data?.communities ?? FALLBACK_COMMUNITIES;

  const membershipMutation = useMutation({
    mutationFn: async (item: CommunityItem) => {
      if (item.isMember) {
        return communitiesApi.leave(item.id);
      }
      return communitiesApi.join(item.id);
    },
    onSuccess: (res, item) => {
      setFeedback({
        tone: 'success',
        text: item.isMember
          ? `Đã rời khỏi "${res.community.name}".`
          : `Đã tham gia "${res.community.name}".`,
      });
      queryClient.setQueryData<{ communities: CommunityItem[] }>(['communities'], (old) => {
        const list = old?.communities ?? FALLBACK_COMMUNITIES;
        return {
          communities: list.map((c) => (c.id === res.community.id ? res.community : c)),
        };
      });
    },
    onError: (err) => {
      setFeedback({
        tone: 'error',
        text: errorMessage(err),
      });
    },
  });

  const toggleJoin = (item: CommunityItem) => {
    setFeedback(null);
    membershipMutation.mutate(item);
  };

  const filteredCommunities = communities.filter((c) => {
    if (!isProfessional && c.isVerifiedOnly && activeFilter === 'all' && !searchQuery) {
      return false;
    }
    if (activeFilter !== 'all' && c.category !== activeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.specialtyLabel.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filterTabs = isProfessional
    ? ([
        { id: 'all', label: `Tất cả (${communities.length})` },
        { id: 'clinical', label: 'Lâm sàng' },
        { id: 'research', label: 'Nghiên cứu BCI' },
        { id: 'patient', label: 'Người bệnh' },
        { id: 'general', label: 'Phổ thông' },
      ] as const)
    : ([
        { id: 'all', label: 'Phù hợp với bạn' },
        { id: 'patient', label: 'Người bệnh' },
        { id: 'general', label: 'Giấc ngủ & Não bộ' },
        { id: 'clinical', label: 'Chuyên gia' },
      ] as const);

  const joinedCount = communities.filter((c) => c.isMember).length;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Clean Compact Header */}
      <Card className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#141413]">
            Cộng đồng
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF6F1] border border-[#DCE6DF] px-3 py-1 text-xs font-semibold text-[#15803D] tabular-nums">
            <Users className="size-3.5 text-[#16A34A]" aria-hidden />
            {joinedCount} nhóm đang tham gia
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-[#DCE6DF]">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#6E6D68]" aria-hidden />
            <input
              type="text"
              placeholder="Tìm cộng đồng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] pl-10 pr-3.5 py-2 text-xs sm:text-sm text-[#141413] placeholder:text-[#6E6D68] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 focus:border-[#16A34A]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-1.5 px-1.5 -mx-1.5 text-xs">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 rounded-full font-semibold transition-[background-color,color,border-color,transform] duration-150 ease-out active:scale-[0.97] shrink-0 border ${
                  activeFilter === tab.id
                    ? 'bg-[#16A34A] text-white border-[#16A34A]'
                    : 'bg-white text-[#6E6D68] border-[#DCE6DF] hover:bg-[#EFF6F1] hover:text-[#15803D]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}

      {/* Community Cards */}
      {filteredCommunities.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="size-7 text-[#16A34A]" />}
            title="Không tìm thấy cộng đồng phù hợp"
            description="Thử từ khóa hoặc bộ lọc khác."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCommunities.map((c) => (
            <Card
              key={c.id}
              className="p-5 flex flex-col justify-between space-y-4 hover:border-[#86EFAC] transition-colors"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="inline-flex items-center rounded-full bg-[#EFF6F1] text-[#15803D] border border-[#DCE6DF] px-2.5 py-0.5 text-xs font-semibold">
                    {c.specialtyLabel}
                  </span>
                  {isProfessional && c.isVerifiedOnly ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#F5FAF7] text-[#262624] border border-[#DCE6DF] px-2.5 py-0.5 text-[11px] font-mono font-semibold">
                      <ShieldCheck className="size-3 text-[#16A34A]" aria-hidden /> {c.code}
                    </span>
                  ) : c.isVerifiedOnly ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#F5FAF7] text-[#6E6D68] border border-[#DCE6DF] px-2.5 py-0.5 text-[11px] font-medium">
                      <ShieldCheck className="size-3 text-[#16A34A]" aria-hidden /> Chuyên gia
                    </span>
                  ) : null}
                </div>

                <h2 className="text-base font-bold text-[#141413] leading-snug">
                  {c.name}
                </h2>

                <p className="text-xs sm:text-sm text-[#6E6D68] leading-relaxed line-clamp-2">
                  {c.description}
                </p>

                {isProfessional && c.leadInstitution && (
                  <p className="text-[11px] text-[#6E6D68] truncate">
                    Đơn vị: <span className="font-medium text-[#262624]">{c.leadInstitution}</span>
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-[#DCE6DF] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-xs text-[#6E6D68] tabular-nums">
                  <span className="flex items-center gap-1 font-medium text-[#262624]">
                    <Users className="size-3.5 text-[#16A34A]" aria-hidden />
                    {c.membersCount.toLocaleString('vi-VN')} thành viên
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="size-3.5 text-[#6E6D68]" aria-hidden />
                    {c.discussionsCount}
                  </span>
                </div>

                <Button
                  size="sm"
                  variant={c.isMember ? 'secondary' : 'primary'}
                  disabled={membershipMutation.isPending}
                  onClick={() => toggleJoin(c)}
                  icon={c.isMember ? <CheckCircle2 className="size-3.5" aria-hidden /> : undefined}
                >
                  {c.isMember ? 'Đã tham gia' : 'Tham gia'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
