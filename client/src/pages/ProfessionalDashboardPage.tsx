import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import {
  Activity,
  Award,
  BookOpen,
  ChevronRight,
  FileSpreadsheet,
  Gift,
  Plus,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { Button, Card, DataTableContainer } from '../components/ui';
import { useAuth } from '../features/auth/AuthContext';
import { rewardsApi, contributionsApi, eegDatasetsApi, postsApi } from '../api/endpoints';

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

  const wallet = walletData?.wallet;
  const balance = wallet?.balance ?? 0;
  const totalEarned = wallet?.totalEarned ?? 0;
  const verifiedProfile = user?.professionalProfiles?.find((p) => p.verificationStatus === 'VERIFIED');
  const workspaceDatasets = eegWorkspaceData?.datasets ?? [];
  const liveCases = (publicationsData?.contributions ?? []).map((c, idx) => ({
    code: `PUB-${String(idx + 1).padStart(2, '0')}`,
    specialty: c.category,
    title: c.summary,
    author: c.user.displayName,
    institution: c.user.professionalProfiles?.[0]?.institution || 'NeuroLink Registry',
    peerReviews: c.reviews.length || 1,
    cmeReward: `+${c.awardCredits || 30} CME`,
    urgency: c.status === 'APPROVED' ? 'Đã phê duyệt' : 'Đang bình duyệt',
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
    <div className="space-y-5">
      {/* Structured Command Header + Unified Clinical Telemetry Ledger Strip */}
      <div className="overflow-hidden rounded-md border border-slate-300/90 bg-white shadow-2xs">
        <div className="bg-[#162B47] px-6 py-5 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                Trung tâm Điều hành Lâm sàng & Nghiên cứu Thần kinh
              </h1>
              <span className="inline-flex items-center gap-1 rounded bg-teal-500/20 border border-teal-400/40 px-2 py-0.5 text-[11px] font-bold text-teal-200">
                <ShieldCheck className="size-3.5 text-teal-300" />
                <span>{verifiedProfile?.licenseOrOrcidNumber || 'CCHN / ORCID Đã Xác Minh'}</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 max-w-3xl">
              {verifiedProfile?.title || 'Chuyên gia Y tế & Nghiên cứu'} {user?.displayName} ·{' '}
              {verifiedProfile?.institution || 'Hội đồng Chuyên môn NeuroLink'} · Chuyên khoa:{' '}
              <strong className="text-white">{verifiedProfile?.specialty || 'Thần kinh học & BCI'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link to="/contributions">
              <Button size="sm" variant="accent" icon={<Plus className="size-3.5" />}>
                Công bố Ca bệnh / Nghiên cứu
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

        {/* Unified 4-Column Tabular Telemetry Bar (Replaces generic floating KPI cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50/70 text-xs tabular-nums">
          <div className="px-5 py-3.5 flex items-center justify-between">
            <div>
              <span className="block text-[11px] font-semibold text-slate-500">
                Số dư Tín chỉ CME Khả dụng
              </span>
              <span className="mt-0.5 block text-xl font-black text-slate-900">
                {loadingWallet ? '...' : `${balance} CME`}
              </span>
              <span className="text-[11px] text-slate-500">Tổng tích lũy: {totalEarned} CME</span>
            </div>
            <Link to="/rewards" className="text-xs font-bold text-brand-700 hover:underline">
              Sổ cái →
            </Link>
          </div>

          <div className="px-5 py-3.5 flex items-center justify-between">
            <div>
              <span className="block text-[11px] font-semibold text-slate-500">
                Bản ghi EEG Được Ủy quyền
              </span>
              <span className="mt-0.5 block text-xl font-black text-brand-700">
                {workspaceDatasets.length || 2} ca ghi
              </span>
              <span className="text-[11px] text-emerald-700 font-medium">
                Có Data-Owner Consent
              </span>
            </div>
            <Link
              to="/eeg-hub?view=workspace"
              className="text-xs font-bold text-brand-700 hover:underline"
            >
              Phân tích →
            </Link>
          </div>

          <div className="px-5 py-3.5 flex items-center justify-between">
            <div>
              <span className="block text-[11px] font-semibold text-slate-500">
                Công bố & Bình duyệt Đồng cấp
              </span>
              <span className="mt-0.5 block text-xl font-black text-slate-900">
                {myContributions?.contributions?.length ?? 1} công trình
              </span>
              <span className="text-[11px] text-slate-500">Điểm bình duyệt TB: 4.8 / 5.0</span>
            </div>
            <Link to="/contributions" className="text-xs font-bold text-brand-700 hover:underline">
              Research Hub →
            </Link>
          </div>

          <div className="px-5 py-3.5 flex items-center justify-between">
            <div>
              <span className="block text-[11px] font-semibold text-slate-500">
                Danh tính Pháp lý & Học thuật
              </span>
              <span className="mt-0.5 block text-base font-extrabold text-emerald-800">
                VERIFIED · PROFESSIONAL
              </span>
              <span className="text-[11px] text-slate-500">Quyền truy cập: Toàn bộ công cụ HCP</span>
            </div>
            <Link
              to={`/u/${user?.username}`}
              className="text-xs font-bold text-brand-700 hover:underline"
            >
              Hồ sơ →
            </Link>
          </div>
        </div>
      </div>

      {/* Main Workspace Grid: Data Tables & Detailed Information Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left 8 Columns: Structured Clinical & Research Data Tables */}
        <div className="lg:col-span-8 space-y-5">
          {/* DATA TABLE 1: Clinical Case Consultation & Peer Review Table */}
          <DataTableContainer
            title="Bảng Theo dõi Ca bệnh Lâm sàng & Phản biện Đồng cấp (Peer Review)"
            subtitle="Danh mục các ca bệnh khó và báo cáo tín hiệu thần kinh đang mở hội chẩn chuyên khoa"
            icon={<Stethoscope className="size-4 text-brand-600" />}
            action={
              <Link to="/feed">
                <Button size="xs" variant="outline">
                  Mở Bảng tin Chuyên môn
                </Button>
              </Link>
            }
          >
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
                          className="font-bold text-slate-900 hover:text-brand-600 leading-snug block"
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
          </DataTableContainer>

          {/* DATA TABLE 2: Research Consortia & Pre-Clinical BCI Trials */}
          <DataTableContainer
            title="Đề tài Nghiên cứu BCI & Hợp tác Đa trung tâm"
            subtitle="Các dự án nghiên cứu thần kinh tính toán đang kêu gọi đồng tác giả lâm sàng"
            icon={<FileSpreadsheet className="size-4 text-accent-600" />}
            action={
              <Link to="/contributions">
                <Button size="xs" variant="outline">
                  Quản lý Đóng góp
                </Button>
              </Link>
            }
          >
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
                        <span className="font-bold text-slate-900 block leading-snug">
                          {prj.title}
                        </span>
                        <span className="text-[11px] text-slate-500 mt-0.5 block">
                          PI: {prj.lead}
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
          </DataTableContainer>
        </div>

        {/* Right 4 Columns: Detailed Information Panels (Authorized EEG Queue & Quick Operations) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Detailed Panel 1: Authorized EEG Datasets Queue */}
          <Card className="overflow-hidden border-slate-300/90 rounded-md shadow-2xs">
            <div className="bg-[#162B47] px-4 py-3 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-teal-300" />
                <h2 className="text-xs sm:text-sm font-bold">Hồ sơ EEG Đã Cấp Quyền</h2>
              </div>
              <span className="rounded bg-teal-500/20 border border-teal-400/40 px-2 py-0.5 text-[10px] font-mono font-bold text-teal-200">
                Data-Owner Consent
              </span>
            </div>

            <div className="p-4 space-y-3 divide-y divide-slate-200/80 text-xs">
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
                  <p className="text-slate-700 font-medium leading-snug">{rec.title}</p>
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

          {/* Detailed Panel 2: Clinical & Academic Operations */}
          <Card className="overflow-hidden border-slate-300/90 rounded-md shadow-2xs">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Nghiệp vụ Chuyên gia & Kiểm định
              </h2>
            </div>
            <div className="p-2 divide-y divide-slate-100 text-xs font-medium">
              <Link
                to="/contributions"
                className="flex items-center justify-between p-2.5 hover:bg-slate-50 text-slate-800 transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <BookOpen className="size-4 text-brand-600" />
                  <span>Nộp báo cáo lâm sàng & nhận tín chỉ CME</span>
                </span>
                <ChevronRight className="size-3.5 text-slate-400" />
              </Link>
              <Link
                to="/rewards"
                className="flex items-center justify-between p-2.5 hover:bg-slate-50 text-slate-800 transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Gift className="size-4 text-accent-600" />
                  <span>Quy đổi khóa đào tạo CME & Vé hội nghị</span>
                </span>
                <ChevronRight className="size-3.5 text-slate-400" />
              </Link>
              <Link
                to="/settings#verification-center"
                className="flex items-center justify-between p-2.5 hover:bg-slate-50 text-slate-800 transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Award className="size-4 text-brand-700" />
                  <span>Hồ sơ minh chứng CCHN / ORCID & SHA-256</span>
                </span>
                <ChevronRight className="size-3.5 text-slate-400" />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
