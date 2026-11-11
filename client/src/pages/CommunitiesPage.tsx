import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  FlaskConical,
  HeartHandshake,
  MessageSquare,
  Search,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';
import { communitiesApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type { CommunityItem } from '../api/types';
import { Alert, Button, Card, DataTableContainer, TelemetryStrip } from '../components/ui';
import { useMode } from '../context/ModeContext';

export const FALLBACK_COMMUNITIES: CommunityItem[] = [
  {
    id: 'comm-01',
    code: 'BRD-NEURO-01',
    name: 'Hội Thần kinh học Lâm sàng & Đọc Bản đồ Não',
    description:
      'Diễn đàn hội chẩn ca bệnh thần kinh phức tạp, phân tích Video-EEG đa đạo trình và cập nhật phác đồ điều trị động kinh kháng thuốc.',
    category: 'clinical',
    specialtyLabel: 'Thần kinh Lâm sàng · Video-EEG',
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
      'Nhóm nghiên cứu liên viện tập trung giải mã tín hiệu điện não đồ (ERD/ERS, P300, SSVEP), lọc nhiễu ICA và mô hình hóa giao diện não - máy tính.',
    category: 'research',
    specialtyLabel: 'Kỹ thuật Y sinh · DSP / BCI',
    membersCount: 289,
    discussionsCount: 94,
    activeProtocolsCount: 9,
    isMember: false,
    isVerifiedOnly: true,
    leadInstitution: 'Phòng thí nghiệm Trọng điểm BCI & AI',
  },
  {
    id: 'comm-03',
    code: 'BRD-PNES-03',
    name: 'Hội đồng Thẩm định Ca Co giật & Tâm thần kinh (PNES vs Epilepsy)',
    description:
      'Chuyên trang thảo luận phân biệt cơn co giật nguồn gốc tâm lý (PNES) và động kinh thực tổn, hạn chế lạm dụng thuốc chống động kinh.',
    category: 'clinical',
    specialtyLabel: 'Tâm thần kinh · Chẩn đoán Phân biệt',
    membersCount: 178,
    discussionsCount: 62,
    activeProtocolsCount: 4,
    isMember: false,
    isVerifiedOnly: true,
    leadInstitution: 'BV Chợ Rẫy & BV Đại học Y Dược',
  },
  {
    id: 'comm-04',
    code: 'COM-CARE-04',
    name: 'Đồng hành cùng Bệnh nhân Động kinh & Người nhà',
    description:
      'Không gian chia sẻ kinh nghiệm sống khỏe, tuân thủ dùng thuốc, phòng ngừa chấn thương khi co giật và hỗ trợ tâm lý từ cộng đồng.',
    category: 'patient',
    specialtyLabel: 'Chăm sóc & Hỗ trợ Người bệnh',
    membersCount: 1240,
    discussionsCount: 420,
    activeProtocolsCount: 2,
    isMember: true,
    isVerifiedOnly: false,
    leadInstitution: 'Mạng lưới Hỗ trợ Bệnh nhân NeuroLink',
  },
  {
    id: 'comm-05',
    code: 'COM-SLEEP-05',
    name: 'Tối ưu Giấc ngủ & Nhịp Sóng Não Tự nhiên',
    description:
      'Cộng đồng trao đổi kiến thức khoa học dễ hiểu về cải thiện pha ngủ sâu N3, giảm mất ngủ kinh niên và tăng cường sự tỉnh táo ban ngày.',
    category: 'general',
    specialtyLabel: 'Giấc ngủ & Sức khỏe Thường thức',
    membersCount: 890,
    discussionsCount: 230,
    activeProtocolsCount: 3,
    isMember: false,
    isVerifiedOnly: false,
    leadInstitution: 'Chuyên mục Sức khỏe Giấc ngủ',
  },
  {
    id: 'comm-06',
    code: 'COM-BRAIN-06',
    name: 'Khám phá Não bộ & Sóng não cho Người mới bắt đầu',
    description:
      'Dành cho người yêu thích khoa học thần kinh, tìm hiểu nguyên lý đo điện não bề mặt và cách đọc các chỉ số sóng Alpha, Beta, Theta.',
    category: 'general',
    specialtyLabel: 'Khoa học Thần kinh Phổ thông',
    membersCount: 650,
    discussionsCount: 115,
    activeProtocolsCount: 1,
    isMember: false,
    isVerifiedOnly: false,
    leadInstitution: 'Cộng đồng Khoa học Mở NeuroLink',
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
          : `Đã tham gia "${res.community.name}" thành công.`,
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
    if (!isProfessional && c.isVerifiedOnly && activeFilter === 'all') {
      if (!searchQuery) return !c.isVerifiedOnly;
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

  /* ============================================================================
   * EXPERIENCE A: GENERAL MODE (Friendly, White & Soft Neutral, Teal/Sky Accents)
   * ============================================================================ */
  if (!isProfessional) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Friendly Light Header */}
        <section className="rounded-xl border border-teal-200/80 bg-white p-6 sm:p-7 shadow-2xs">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  Cộng đồng Sức khỏe & Chia sẻ
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 border border-teal-200/80">
                  <HeartHandshake className="size-3.5 text-teal-600" />
                  Thân thiện & Đáng tin cậy
                </span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Nơi người bệnh, gia đình và những người yêu thích khoa học não bộ cùng trao đổi kinh nghiệm chăm sóc sức khỏe, cải thiện giấc ngủ và học hỏi kiến thức y tế dễ hiểu từ các bác sĩ.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-lg bg-[#F0FDFA] border border-teal-200/70 px-4 py-3 shrink-0">
              <Users className="size-5 text-teal-600 shrink-0" />
              <div className="text-xs">
                <span className="block font-bold text-slate-900">
                  {communities.filter((c) => c.isMember).length} nhóm đang tham gia
                </span>
                <span className="text-slate-600">Không gian thảo luận an toàn</span>
              </div>
            </div>
          </div>

          {/* Search & Friendly Filter Pills */}
          <div className="mt-5 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm nhóm theo chủ đề giấc ngủ, động kinh, sóng não..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-[#F8FAFB] pl-10 pr-3.5 py-2 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
              {(
                [
                  { id: 'all', label: 'Phổ biến cho bạn' },
                  { id: 'patient', label: 'Hỗ trợ Người bệnh' },
                  { id: 'general', label: 'Giấc ngủ & Não bộ' },
                  { id: 'clinical', label: 'Góc Chuyên gia' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full font-semibold transition-colors shrink-0 ${
                    activeFilter === tab.id
                      ? 'bg-teal-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-teal-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}

        {/* Moderate, Readable 2-Column Community Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredCommunities.map((c) => (
            <Card
              key={c.id}
              className="p-5 sm:p-6 flex flex-col justify-between space-y-4 rounded-xl border-slate-200/80 bg-white hover:border-teal-300 transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                      c.category === 'patient'
                        ? 'bg-teal-50 text-teal-700 border-teal-200'
                        : c.category === 'general'
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {c.specialtyLabel}
                  </span>
                  {c.isVerifiedOnly && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200 px-2.5 py-0.5 text-[11px] font-semibold">
                      <ShieldCheck className="size-3.5 text-sky-600" /> Dành cho Chuyên gia đã xác minh
                    </span>
                  )}
                </div>

                <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                  {c.name}
                </h2>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {c.description}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1 font-medium text-slate-700">
                    <Users className="size-3.5 text-teal-600" /> {c.membersCount.toLocaleString()} thành viên
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="size-3.5 text-sky-600" /> {c.discussionsCount} thảo luận
                  </span>
                </div>

                <Button
                  size="sm"
                  variant={c.isMember ? 'outline' : 'primary'}
                  disabled={membershipMutation.isPending}
                  className={
                    c.isMember
                      ? 'border-teal-200 text-teal-700 hover:bg-teal-50'
                      : 'bg-teal-600 hover:bg-teal-700 text-white'
                  }
                  onClick={() => toggleJoin(c)}
                >
                  {c.isMember ? 'Đang tham gia' : 'Tham gia nhóm'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  /* ============================================================================
   * EXPERIENCE B: PROFESSIONAL MODE (Structured Navy/Blue/Teal, Data Table + Panels)
   * ============================================================================ */
  return (
    <div className="space-y-5">
      {/* Structured Navy Command Header + Telemetry Bar */}
      <section className="rounded-lg border border-slate-300 bg-white shadow-2xs overflow-hidden">
        <div className="bg-[#162B47] px-5 py-4 text-white flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
                Hội đồng Chuyên khoa & Liên minh Nghiên cứu BCI
              </h1>
              <span className="inline-flex items-center gap-1 rounded bg-[#2C6865] px-2 py-0.5 text-[11px] font-semibold text-teal-50 border border-teal-400/30">
                <ShieldCheck className="size-3 text-teal-200" />
                Sermo & ResearchGate Specialty Boards
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-3xl">
              Danh mục các hội đồng lâm sàng xác thực CCHN/ORCID, nhóm hợp tác giải mã tín hiệu điện não đồ đa trung tâm và diễn đàn hỗ trợ bệnh nhân có giám sát y khoa.
            </p>
          </div>

          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-300" />
            <input
              type="text"
              placeholder="Lọc mã hội đồng, chuyên khoa, BCI..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded border border-white/20 bg-white/10 pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-300 focus:bg-white/15 focus:outline-none focus:border-teal-300"
            />
          </div>
        </div>

        <TelemetryStrip
          items={[
            { label: 'Tổng số Hội đồng', value: communities.length },
            {
              label: 'Hội đồng CCHN / ORCID',
              value: communities.filter((c) => c.isVerifiedOnly).length,
              valueClassName: 'text-[#1E3A5F]',
            },
            { label: 'Ca Hội chẩn Đang mở', value: 341, valueClassName: 'text-[#2C6865]' },
            { label: 'Đề tài Đa trung tâm', value: 19 },
          ]}
        />
      </section>

      {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}

      {/* Filter Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          {(
            [
              { id: 'all', label: `Tất cả Danh mục (${communities.length})` },
              { id: 'clinical', label: 'Hội đồng Lâm sàng (CCHN)' },
              { id: 'research', label: 'Liên minh BCI & DSP (ORCID)' },
              { id: 'patient', label: 'Cộng đồng Bệnh nhân' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 rounded font-semibold transition-colors shrink-0 ${
                activeFilter === tab.id
                  ? 'bg-[#162B47] text-white'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] font-mono text-slate-500">
          Chuẩn phân quyền: RBAC + Verified Professional Credential
        </span>
      </div>

      {/* Reusable Structured Specialty Boards Data Table */}
      <DataTableContainer
        icon={<Stethoscope className="size-4 text-[#1E3A5F]" />}
        title={`Bảng Danh mục Hội đồng Chuyên khoa & Nhóm Nghiên cứu (${filteredCommunities.length})`}
        metaLabel="Hiển thị cấu trúc dữ liệu mật độ cao cho chuyên gia"
      >
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/80 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <th className="py-2.5 px-3.5">Mã</th>
              <th className="py-2.5 px-3.5">Hội đồng / Nhóm Chuyên môn</th>
              <th className="py-2.5 px-3.5">Phân ngành & Đơn vị Điều phối</th>
              <th className="py-2.5 px-3.5 text-right">Thành viên</th>
              <th className="py-2.5 px-3.5 text-right">Thảo luận</th>
              <th className="py-2.5 px-3.5">Chuẩn Truy cập</th>
              <th className="py-2.5 px-3.5 text-right">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80">
            {filteredCommunities.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/90 transition-colors">
                <td className="py-3 px-3.5 font-mono font-bold text-[#1E3A5F] whitespace-nowrap align-top">
                  {c.code}
                </td>
                <td className="py-3 px-3.5 align-top max-w-md">
                  <div className="font-bold text-slate-900 text-xs sm:text-sm leading-snug">
                    {c.name}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                    {c.description}
                  </p>
                </td>
                <td className="py-3 px-3.5 align-top whitespace-nowrap">
                  <span className="inline-block font-semibold text-slate-800">{c.specialtyLabel}</span>
                  {c.leadInstitution && (
                    <span className="block text-[11px] text-slate-500 mt-0.5">{c.leadInstitution}</span>
                  )}
                </td>
                <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-800 tabular-nums align-top">
                  {c.membersCount.toLocaleString()}
                </td>
                <td className="py-3 px-3.5 text-right font-mono font-semibold text-slate-700 tabular-nums align-top">
                  {c.discussionsCount}
                </td>
                <td className="py-3 px-3.5 align-top whitespace-nowrap">
                  {c.isVerifiedOnly ? (
                    <span className="inline-flex items-center gap-1 rounded bg-[#F0F4F8] text-[#1E3A5F] border border-[#CBD5E1] px-2 py-0.5 text-[11px] font-bold">
                      <ShieldCheck className="size-3 text-[#2B4C7E]" /> CCHN / ORCID
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 text-[11px] font-semibold">
                      Mở rộng (Cộng đồng)
                    </span>
                  )}
                </td>
                <td className="py-3 px-3.5 text-right align-top whitespace-nowrap">
                  <button
                    type="button"
                    disabled={membershipMutation.isPending}
                    onClick={() => toggleJoin(c)}
                    className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-bold transition-colors ${
                      c.isMember
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                        : 'bg-[#162B47] text-white hover:bg-[#1E3A5F]'
                    }`}
                  >
                    {c.isMember ? (
                      <>
                        <CheckCircle2 className="size-3 text-emerald-600" /> Đã tham gia
                      </>
                    ) : (
                      'Gia nhập Hội đồng'
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableContainer>

      {/* Detailed Research Consortium & Clinical Protocol Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 border-slate-300 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#162B47] flex items-center gap-1.5">
              <Stethoscope className="size-4 text-[#2B4C7E]" />
              Quy chuẩn Hội chẩn Lâm sàng (Sermo Protocol)
            </h3>
            <span className="font-mono text-[11px] text-slate-500">SOP-CLIN-2026</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Mọi ca bệnh đưa lên Hội đồng Thần kinh Lâm sàng bắt buộc ẩn danh thông tin định danh bệnh nhân (PHI Anonymized), đính kèm thông số đạo trình 10-20 và phân loại sơ bộ theo mã ICD-10 trước khi mở biểu quyết phản biện đồng cấp.
          </p>
        </Card>

        <Card className="p-4 border-slate-300 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#162B47] flex items-center gap-1.5">
              <FlaskConical className="size-4 text-[#2C6865]" />
              Hợp tác Dữ liệu EEG Đa trung tâm (ResearchGate Hub)
            </h3>
            <span className="font-mono text-[11px] text-slate-500">CONSENT-VERIFIED</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Các nhóm nghiên cứu BCI chỉ được phép truy xuất tập dữ liệu điện não đồ khi có chứng nhận ORCID hợp lệ và được chính chủ sở hữu dữ liệu cấp quyền tường minh (Explicit Data-Owner Consent).
          </p>
        </Card>
      </div>
    </div>
  );
}
