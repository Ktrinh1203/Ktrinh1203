import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import {
  Activity,
  Coins,
  FileSpreadsheet,
  Plus,
  Stethoscope,
} from 'lucide-react';
import { Alert, Button, Card, DataTableContainer, cn } from '../components/ui';
import { useAuth } from '../features/auth/AuthContext';
import {
  rewardsApi,
  contributionsApi,
  eegDatasetsApi,
  postsApi,
  consultationsApi,
} from '../api/endpoints';
import { errorMessage } from '../api/client';
import {
  CONTRIBUTION_CATEGORY_LABELS,
  CONTRIBUTION_STATUS_META,
} from './ContributionsPage';

const CLINICAL_CONSULTATION_QUEUE = [
  {
    code: 'CA-2026-041',
    specialty: 'Thần kinh học Lâm sàng',
    title: 'Phân biệt co giật tâm căn (PNES) và động kinh thùy thái dương qua Video-EEG',
    author: 'PGS. TS. Trần Mai Lan',
    institution: 'Viện CNTT - BCI Lab',
    peerReviews: 12,
    cmeReward: '+30 CME',
    urgency: 'Ưu tiên hội chẩn',
  },
  {
    code: 'CA-2026-038',
    specialty: 'BCI & Xử lý Tín hiệu',
    title: 'Khử nhiễu điện cơ (EMG Artifact Removal) bằng ICA thích ứng trên EEG 8 kênh',
    author: 'BS. CKII Nguyễn Văn Minh',
    institution: 'Bệnh viện Bạch Mai',
    peerReviews: 8,
    cmeReward: '+50 CME',
    urgency: 'Đang bình duyệt',
  },
  {
    code: 'CA-2026-035',
    specialty: 'Đột quỵ & Phục hồi',
    title: 'Đánh giá mức độ tái tổ chức vỏ não vận động qua chỉ số ERD dải Mu (8–12 Hz)',
    author: 'PGS. TS. Trần Mai Lan',
    institution: 'Đại học Quốc gia',
    peerReviews: 15,
    cmeReward: '+40 CME',
    urgency: 'Đã đồng thuận',
  },
];

const RESEARCH_PROJECTS_LEDGER = [
  {
    projectId: 'PRJ-BCI-09',
    title: 'Giao diện P300 Speller hỗ trợ giao tiếp cho bệnh nhân xơ cứng cột bên teo cơ (ALS)',
    lead: 'PGS. TS. Trần Mai Lan',
    phase: 'Thử nghiệm lâm sàng Pha II',
    openRole: '01 Bác sĩ Thần kinh / Phục hồi chức năng',
    sampleSize: 'n = 32 ca',
  },
  {
    projectId: 'PRJ-EEG-14',
    title: 'Bộ dữ liệu chuẩn hóa Video-EEG giấc ngủ N3 phát hiện sớm phóng điện kịch phát',
    lead: 'BS. CKII Nguyễn Văn Minh',
    phase: 'Thu thập & Gắn nhãn dữ liệu',
    openRole: '02 Chuyên gia đọc điện não đồ (CCHN)',
    sampleSize: 'n = 120 bản ghi',
  },
];

export function ProfessionalDashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTableTab, setActiveTableTab] = useState<'cases' | 'projects'>('cases');
  const [grantFeedback, setGrantFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const { data: walletData, isLoading: loadingWallet } = useQuery({
    queryKey: ['rewards', 'wallet'],
    queryFn: () => rewardsApi.getWallet(),
  });

  const { data: myContributions } = useQuery({
    queryKey: ['contributions', 'my'],
    queryFn: () => contributionsApi.getMyContributions(),
  });

  const { data: eegWorkspaceData } = useQuery({
    queryKey: ['eeg-workspace-dashboard'],
    queryFn: () => eegDatasetsApi.getWorkspaceDatasets(),
  });

  const { data: publicationsData } = useQuery({
    queryKey: ['contributions', 'publications'],
    queryFn: () => contributionsApi.getPublications(),
  });

  const { data: recentFeedData } = useQuery({
    queryKey: ['feed', 'dashboard'],
    queryFn: () => postsApi.getFeed('community'),
  });

  const { data: queueData } = useQuery({
    queryKey: ['consultations', 'dashboard-queue'],
    queryFn: () => consultationsApi.list({ scope: 'queue' }),
  });

  const claimGrantMutation = useMutation({
    mutationFn: () => rewardsApi.claimOnboardingGrant(),
    onSuccess: (res) => {
      setGrantFeedback({
        tone: 'success',
        text: res.granted
          ? `Đã kích hoạt +${res.amount} Credit Khởi đầu vào ví.`
          : 'Tài khoản đã nhận gói credit khởi đầu trước đó.',
      });
      void queryClient.invalidateQueries({ queryKey: ['rewards', 'wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['my-wallet'] });
    },
    onError: (err) => setGrantFeedback({ tone: 'error', text: errorMessage(err) }),
  });

  const wallet = walletData?.wallet;
  const transactions = walletData?.transactions ?? [];
  const hasClaimedStarterGrant = transactions.some((tx) => tx.type === 'STARTER_GRANT');
  const openQueueCount = (queueData?.tickets ?? []).filter((t) => t.status === 'OPEN').length;
  const balance = wallet?.balance ?? 0;
  const verifiedProfile = user?.professionalProfiles?.find((p) => p.verificationStatus === 'VERIFIED');
  const workspaceDatasets = eegWorkspaceData?.datasets ?? [];
  const liveCases = (publicationsData?.contributions ?? []).map((c, idx) => ({
    code: `PUB-${String(idx + 1).padStart(2, '0')}`,
    specialty: CONTRIBUTION_CATEGORY_LABELS[c.category]?.label ?? c.category,
    title: c.summary,
    author: c.user.displayName,
    institution: c.user.professionalProfiles?.[0]?.institution || 'NeuroLink Registry',
    peerReviews: c.reviews.length || 1,
    cmeReward: `+${c.awardCredits || 30} CME`,
    urgency: CONTRIBUTION_STATUS_META[c.status]?.label ?? c.status,
  }));
  const liveFeedCases = (recentFeedData?.items ?? []).slice(0, 3).map((p, idx) => ({
    code: `POST-${String(idx + 1).padStart(2, '0')}`,
    specialty: 'Thảo luận Lâm sàng',
    title: p.content.slice(0, 110) + (p.content.length > 110 ? '...' : ''),
    author: p.author.displayName,
    institution: p.author.professionalProfiles?.[0]?.title || 'Cộng đồng NeuroLink',
    peerReviews: p.commentsCount,
    cmeReward: `+${p.likesCount * 10 || 20} CME`,
    urgency: 'Thảo luận mở',
  }));
  const consultationRows = [...liveCases, ...liveFeedCases, ...CLINICAL_CONSULTATION_QUEUE].slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Structured Command Header + Unified Clinical Telemetry Ledger Strip */}
      <div className="overflow-hidden rounded-md border border-slate-300/90 bg-white shadow-2xs">
        <div className="bg-[#162B47] p-6 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              Trung tâm Chuyên khoa & Nghiên cứu
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 max-w-3xl line-clamp-1">
              {verifiedProfile?.title || 'Chuyên gia Y tế & Nghiên cứu'} {user?.displayName} ·{' '}
              {verifiedProfile?.institution || 'Hội đồng Chuyên môn NeuroLink'} ·{' '}
              <strong className="text-white">{verifiedProfile?.specialty || 'Thần kinh học & BCI'}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link to="/consultations?tab=queue">
              <Button size="sm" variant="accent" icon={<Stethoscope className="size-3.5" />}>
                Đọc ca Từ xa {openQueueCount > 0 ? `(${openQueueCount})` : ''}
              </Button>
            </Link>
            <Link to="/contributions">
              <Button
                size="sm"
                variant="outline"
                className="bg-white/10 text-white border-white/25 hover:bg-white/20"
                icon={<Plus className="size-3.5" />}
              >
                Công bố Ca bệnh
              </Button>
            </Link>
            <Link to="/eeg-hub?view=workspace">
              <Button
                size="sm"
                variant="outline"
                className="bg-white/10 text-white border-white/25 hover:bg-white/20"
                icon={<Activity className="size-3.5 text-teal-300" />}
              >
                Mở EEG Workspace
              </Button>
            </Link>
          </div>
        </div>

        {/* Unified 4-Column Tabular Telemetry Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/70 text-xs tabular-nums">
          <div className="px-5 py-3.5 space-y-2">
            <div>
              <span className="block text-[11px] font-semibold text-slate-500">Số dư Credit</span>
              <span className="mt-0.5 block text-xl font-black text-slate-900">
                {loadingWallet ? '...' : balance}
              </span>
            </div>
            {!loadingWallet && wallet && balance === 0 && !hasClaimedStarterGrant && (
              <Button
                type="button"
                size="xs"
                variant="accent"
                className="w-full"
                loading={claimGrantMutation.isPending}
                onClick={() => claimGrantMutation.mutate()}
                icon={<Coins className="size-3" />}
              >
                Nhận 250 Credit Khởi đầu
              </Button>
            )}
          </div>

          <div className="px-5 py-3.5">
            <span className="block text-[11px] font-semibold text-slate-500">Hồ sơ EEG</span>
            <span className="mt-0.5 block text-xl font-black text-brand-700">
              {workspaceDatasets.length || 2}
            </span>
          </div>

          <div className="px-5 py-3.5">
            <span className="block text-[11px] font-semibold text-slate-500">Công trình</span>
            <span className="mt-0.5 block text-xl font-black text-slate-900">
              {myContributions?.contributions?.length ?? 1}
            </span>
          </div>

          <div className="px-5 py-3.5">
            <span className="block text-[11px] font-semibold text-slate-500">Ca chờ đọc</span>
            <span className="mt-0.5 block text-xl font-black text-slate-900">
              {openQueueCount}
            </span>
          </div>
        </div>
      </div>

      {grantFeedback && <Alert tone={grantFeedback.tone}>{grantFeedback.text}</Alert>}

      {/* Main Workspace Grid: Data Tables & Detailed Information Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Columns: Unified Tabbed Clinical & Research Table */}
        <div className="lg:col-span-8 space-y-6">
          <DataTableContainer
            title="Ca chờ & Công trình"
            icon={
              activeTableTab === 'cases' ? (
                <Stethoscope className="size-4 text-brand-600" />
              ) : (
                <FileSpreadsheet className="size-4 text-accent-600" />
              )
            }
            action={
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTableTab('cases')}
                    className={cn(
                      'rounded-md px-2.5 py-1 font-semibold transition-colors',
                      activeTableTab === 'cases'
                        ? 'bg-[#162B47] text-white'
                        : 'text-slate-600 hover:text-slate-900',
                    )}
                  >
                    Ca chờ & Thảo luận
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTableTab('projects')}
                    className={cn(
                      'rounded-md px-2.5 py-1 font-semibold transition-colors',
                      activeTableTab === 'projects'
                        ? 'bg-[#162B47] text-white'
                        : 'text-slate-600 hover:text-slate-900',
                    )}
                  >
                    Công trình & Đề tài
                  </button>
                </div>
                <Link to={activeTableTab === 'cases' ? '/consultations?tab=queue' : '/contributions'}>
                  <Button size="xs" variant="outline">
                    {activeTableTab === 'cases' ? 'Hàng đợi' : 'Trung tâm Nghiên cứu'}
                  </Button>
                </Link>
              </div>
            }
          >
            {activeTableTab === 'cases' ? (
              <table className="w-full text-left border-collapse text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/70 text-[10.5px] font-bold uppercase tracking-wider text-slate-600">
                    <th className="py-2.5 px-4">Mã Ca / Phân ban</th>
                    <th className="py-2.5 px-4">Tiêu đề Ca bệnh & Tác giả Chính</th>
                    <th className="py-2.5 px-3 text-center">Phản biện</th>
                    <th className="py-2.5 px-3 text-right">Định mức</th>
                    <th className="py-2.5 px-4 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80">
                  {consultationRows.map((row) => (
                    <tr key={row.code} className="hover:bg-slate-50/90 transition-colors">
                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <span className="font-mono font-bold text-brand-700 block">{row.code}</span>
                        <span className="text-[11px] text-slate-500">{row.specialty}</span>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <Link
                          to="/feed"
                          className="font-bold text-slate-900 hover:text-brand-600 leading-snug line-clamp-2"
                        >
                          {row.title}
                        </Link>
                        <span className="text-[11px] text-slate-500 mt-0.5 block">
                          Chủ trì: {row.author} ({row.institution})
                        </span>
                      </td>
                      <td className="py-3 px-3 align-top text-center font-mono font-semibold text-slate-700 whitespace-nowrap">
                        {row.peerReviews} ý kiến
                      </td>
                      <td className="py-3 px-3 align-top text-right font-mono font-bold text-accent-700 whitespace-nowrap">
                        {row.cmeReward}
                      </td>
                      <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                        <span className="inline-flex items-center rounded bg-brand-50 border border-brand-200 px-2 py-0.5 text-[10.5px] font-semibold text-brand-800">
                          {row.urgency}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/70 text-[10.5px] font-bold uppercase tracking-wider text-slate-600">
                    <th className="py-2.5 px-4">Mã Đề tài</th>
                    <th className="py-2.5 px-4">Tên Dự án & Chủ nhiệm</th>
                    <th className="py-2.5 px-3">Giai đoạn</th>
                    <th className="py-2.5 px-4">Vị trí Hợp tác Mở</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80">
                  {RESEARCH_PROJECTS_LEDGER.map((prj) => (
                    <tr key={prj.projectId} className="hover:bg-slate-50/90 transition-colors">
                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <span className="font-mono font-bold text-accent-700 block">
                          {prj.projectId}
                        </span>
                        <span className="font-mono text-[10.5px] text-slate-500">
                          {prj.sampleSize}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <span className="font-bold text-slate-900 line-clamp-2 leading-snug">
                          {prj.title}
                        </span>
                        <span className="text-[11px] text-slate-500 mt-0.5 block">
                          Chủ nhiệm: {prj.lead}
                        </span>
                      </td>
                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <span className="inline-flex rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10.5px] font-semibold text-slate-700">
                          {prj.phase}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-top text-slate-700 font-medium">
                        {prj.openRole}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </DataTableContainer>
        </div>

        {/* Right 4 Columns: Authorized EEG Queue */}
        <div className="lg:col-span-4 space-y-6">
          {/* Detailed Panel 1: Authorized EEG Datasets Queue */}
          <Card className="overflow-hidden border-slate-300/90 rounded-md shadow-2xs">
            <div className="bg-[#162B47] px-4 py-3 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-teal-300" />
                <h2 className="text-xs sm:text-sm font-bold">Hồ sơ EEG Đã Cấp Quyền</h2>
              </div>
              <span className="rounded bg-teal-500/20 border border-teal-400/40 px-2 py-0.5 text-[10px] font-mono font-bold text-teal-200">
                Chủ sở hữu chia sẻ
              </span>
            </div>

            <div className="p-6 space-y-3 divide-y divide-slate-200/80 text-xs">
              {(workspaceDatasets.length > 0
                ? workspaceDatasets
                : [
                    {
                      id: 'rec-01',
                      patientCode: 'BN-****84 (Ẩn danh)',
                      title: 'Thử nghiệm kích thích vận động tinh tay phải (Motor Imagery)',
                      samplingRate: '250 Hz',
                      channelsCount: 8,
                      ownerUsername: 'hoa_health',
                      status: 'ANALYZED',
                    },
                    {
                      id: 'rec-02',
                      patientCode: 'BN-****29 (Ẩn danh)',
                      title: 'Đánh giá hoạt động điện não giấc ngủ ban đêm & Động kinh thùy thái dương',
                      samplingRate: '500 Hz',
                      channelsCount: 16,
                      ownerUsername: 'hoa_health',
                      status: 'REVIEW_PENDING',
                    },
                  ]
              ).map((rec) => (
                <div key={rec.id} className="pt-3 first:pt-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">{rec.patientCode}</span>
                    <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                      Chủ sở hữu: @{rec.ownerUsername}
                    </span>
                  </div>
                  <p className="text-slate-700 font-medium leading-snug line-clamp-2">{rec.title}</p>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                    <span>
                      {rec.channelsCount} kênh · {rec.samplingRate}
                    </span>
                    <Link
                      to={`/eeg-hub?view=workspace&rec=${rec.id}`}
                      className="font-sans font-bold text-brand-700 hover:underline"
                    >
                      Mở đạo trình →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
