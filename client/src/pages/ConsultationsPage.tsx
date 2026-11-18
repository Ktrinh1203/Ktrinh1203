import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Coins,
  Filter,
  HeartPulse,
  PhoneCall,
  Send,
  ShieldCheck,
  Star,
  Stethoscope,
  UserCheck,
} from 'lucide-react';
import {
  consultationsApi,
  eegDatasetsApi,
  neuralDbApi,
  rewardsApi,
} from '../api/endpoints';
import { errorMessage } from '../api/client';
import type {
  ClinicalCategory,
  ConsultationStatus,
  ConsultationTicketItem,
} from '../api/types';
import {
  Alert,
  Avatar,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Spinner,
  Textarea,
  cn,
} from '../components/ui';
import { useAuth } from '../features/auth/AuthContext';
import { useMode } from '../context/ModeContext';

const CLINICAL_CATEGORY_OPTIONS: {
  value: ClinicalCategory;
  label: string;
  shortLabel: string;
  badgeClass: string;
}[] = [
  {
    value: 'VASCULAR_STROKE',
    label: 'Mạch máu não & Đột quỵ cấp (Vascular / Stroke)',
    shortLabel: 'Đột quỵ & Mạch máu não',
    badgeClass: 'bg-red-50 text-red-800 border-red-200',
  },
  {
    value: 'EPILEPSY_ICU',
    label: 'Động kinh & Hồi sức Thần kinh (Epilepsy / ICU)',
    shortLabel: 'Động kinh & Hồi sức',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  {
    value: 'SLEEP_COGNITIVE',
    label: 'Giấc ngủ & Nhận thức (Sleep / Cognitive)',
    shortLabel: 'Giấc ngủ & Nhận thức',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  {
    value: 'HARDWARE_BCI',
    label: 'Phần cứng ADS1299 & Giao diện Não-Máy (Hardware / BCI)',
    shortLabel: 'Phần cứng ADS1299 & BCI',
    badgeClass: 'bg-brand-50 text-brand-800 border-brand-200',
  },
];

const CATEGORY_MAP = Object.fromEntries(
  CLINICAL_CATEGORY_OPTIONS.map((item) => [item.value, item]),
) as Record<ClinicalCategory, (typeof CLINICAL_CATEGORY_OPTIONS)[number]>;

const STATUS_META: Record<ConsultationStatus, { label: string }> = {
  OPEN: {
    label: 'Đang chờ bác sĩ nhận',
  },
  CLAIMED: {
    label: 'Bác sĩ đang đọc ca',
  },
  ANSWERED: {
    label: 'Đã có phân tích sóng não',
  },
  ACCEPTED: {
    label: 'Đã nghiệm thu',
  },
  CANCELLED: {
    label: 'Đã hủy yêu cầu',
  },
};

const BOUNTY_PRESETS = [0, 30, 50, 80, 120];

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}


export function ConsultationsPage() {
  const { user } = useAuth();
  const { isProfessional, canAccessProfessionalMode } = useMode();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab =
    searchParams.get('tab') === 'queue' && canAccessProfessionalMode
      ? 'queue'
      : searchParams.get('tab') === 'all'
        ? 'all'
        : 'mine';

  const [activeScope, setActiveScope] = useState<'mine' | 'queue' | 'all'>(initialTab);
  const [categoryFilter, setCategoryFilter] = useState<string>(
    searchParams.get('category') || 'ALL',
  );
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Create ticket form state
  const [title, setTitle] = useState('');
  const [clinicalCategory, setClinicalCategory] = useState<ClinicalCategory>(() => {
    const paramCat = searchParams.get('category');
    if (
      paramCat === 'VASCULAR_STROKE' ||
      paramCat === 'EPILEPSY_ICU' ||
      paramCat === 'SLEEP_COGNITIVE' ||
      paramCat === 'HARDWARE_BCI'
    ) {
      return paramCat;
    }
    return 'SLEEP_COGNITIVE';
  });
  const [symptomSummary, setSymptomSummary] = useState('');
  const [selectedSampleId, setSelectedSampleId] = useState<string>(
    searchParams.get('sampleId') || '',
  );
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(
    searchParams.get('datasetId') || '',
  );
  const [bountyCredits, setBountyCredits] = useState<number>(50);

  // Per-ticket reply form & rating state
  const [replyDrafts, setReplyDrafts] = useState<
    Record<
      string,
      {
        waveAnalysisText: string;
        clinicalGuidanceText: string;
        recommendedFollowUp: string;
      }
    >
  >({});
  const [replyRatings, setReplyRatings] = useState<Record<string, number>>({});

  // Feedback alerts
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(() =>
    Boolean(
      searchParams.get('ask') === '1' ||
        searchParams.get('sampleId') ||
        searchParams.get('datasetId'),
    ),
  );
  const didAutoOpenEmpty = useRef(false);

  useEffect(() => {
    const askParam = searchParams.get('ask');
    const sampleParam = searchParams.get('sampleId');
    const datasetParam = searchParams.get('datasetId');
    if (sampleParam) setSelectedSampleId(sampleParam);
    if (datasetParam) setSelectedDatasetId(datasetParam);
    if (askParam === '1' || sampleParam || datasetParam) setShowForm(true);
  }, [searchParams]);

  // Queries
  const walletQuery = useQuery({
    queryKey: ['my-wallet'],
    queryFn: () => rewardsApi.getWallet(),
    enabled: Boolean(user),
  });

  const samplesQuery = useQuery({
    queryKey: ['neural-db', 'samples-for-consultation'],
    queryFn: () => neuralDbApi.listSamples(),
    enabled: Boolean(user),
  });

  const myDatasetsQuery = useQuery({
    queryKey: ['eeg-datasets', 'my'],
    queryFn: () => eegDatasetsApi.getMyDatasets(),
    enabled: Boolean(user),
  });

  const ticketsQuery = useQuery({
    queryKey: ['consultations', activeScope, categoryFilter, statusFilter],
    queryFn: () =>
      consultationsApi.list({
        scope: activeScope,
        clinicalCategory: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      }),
    enabled: Boolean(user),
  });

  const wallet = walletQuery.data?.wallet;
  const transactions = walletQuery.data?.transactions ?? [];
  const hasClaimedStarterGrant = transactions.some((tx) => tx.type === 'STARTER_GRANT');
  const samples = samplesQuery.data?.samples ?? [];
  const myDatasets = myDatasetsQuery.data?.datasets ?? [];
  const tickets = ticketsQuery.data?.tickets ?? [];

  const selectedSample = useMemo(
    () => samples.find((s) => s.id === selectedSampleId) ?? null,
    [samples, selectedSampleId],
  );

  useEffect(() => {
    if (
      !didAutoOpenEmpty.current &&
      !isProfessional &&
      activeScope !== 'queue' &&
      !ticketsQuery.isLoading &&
      !ticketsQuery.isError &&
      tickets.length === 0
    ) {
      didAutoOpenEmpty.current = true;
      setShowForm(true);
    }
  }, [isProfessional, activeScope, ticketsQuery.isLoading, ticketsQuery.isError, tickets.length]);


  const invalidateConsultationQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ['consultations'] });
    void queryClient.invalidateQueries({ queryKey: ['my-wallet'] });
    void queryClient.invalidateQueries({ queryKey: ['rewards', 'wallet'] });
    void queryClient.invalidateQueries({ queryKey: ['community-spotlight'] });
  };

  const claimGrantMutation = useMutation({
    mutationFn: () => rewardsApi.claimOnboardingGrant(),
    onSuccess: (res) => {
      setFeedbackError(null);
      if (res.granted) {
        setFeedbackSuccess(
          `Đã nhận thành công +${res.amount} Tín chỉ Khởi đầu vào ví. Bạn có thể dùng để đặt thù lao gửi câu hỏi cho bác sĩ chuyên khoa.`,
        );
      } else {
        setFeedbackSuccess('Tài khoản của bạn đã nhận gói tín chỉ khởi đầu trước đó.');
      }
      void queryClient.invalidateQueries({ queryKey: ['my-wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['rewards', 'wallet'] });
    },
    onError: (err) => {
      setFeedbackSuccess(null);
      setFeedbackError(errorMessage(err));
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: () =>
      consultationsApi.create({
        title: title.trim(),
        symptomSummary: symptomSummary.trim(),
        clinicalCategory,
        bountyCredits,
        datasetId: selectedDatasetId || undefined,
        neuralSampleId: selectedSampleId || undefined,
      }),
    onSuccess: (res) => {
      setFeedbackError(null);
      setFeedbackSuccess(
        res.ticket.bountyCredits > 0
          ? `Đã gửi câu hỏi và tạm giữ ${res.ticket.bountyCredits} tín chỉ. Số dư ví còn lại: ${res.remainingBalance} tín chỉ.`
          : 'Đã gửi yêu cầu tư vấn vào hàng đợi bác sĩ đọc ca từ xa.',
      );
      setTitle('');
      setSymptomSummary('');
      setSelectedSampleId('');
      setSelectedDatasetId('');
      setShowForm(false);
      if (searchParams.has('sampleId') || searchParams.has('datasetId')) {
        const next = new URLSearchParams(searchParams);
        next.delete('sampleId');
        next.delete('datasetId');
        setSearchParams(next, { replace: true });
      }
      invalidateConsultationQueries();
    },
    onError: (err) => {
      setFeedbackSuccess(null);
      setFeedbackError(errorMessage(err));
    },
  });

  const claimTicketMutation = useMutation({
    mutationFn: (ticketId: string) => consultationsApi.claim(ticketId),
    onSuccess: () => {
      setFeedbackError(null);
      setFeedbackSuccess(
        'Bạn đã nhận đọc ca thành công. Hãy đối chiếu các chỉ số DAR/BSI/TAR hoặc mở Trạm qEEG để gửi phân tích sóng não cho người bệnh.',
      );
      invalidateConsultationQueries();
    },
    onError: (err) => {
      setFeedbackSuccess(null);
      setFeedbackError(errorMessage(err));
    },
  });

  const replyMutation = useMutation({
    mutationFn: (payload: {
      ticketId: string;
      waveAnalysisText: string;
      clinicalGuidanceText: string;
      recommendedFollowUp: string;
    }) =>
      consultationsApi.reply(payload.ticketId, {
        waveAnalysisText: payload.waveAnalysisText,
        clinicalGuidanceText: payload.clinicalGuidanceText,
        recommendedFollowUp: payload.recommendedFollowUp,
      }),
    onSuccess: (_res, vars) => {
      setFeedbackError(null);
      setFeedbackSuccess(
        'Đã gửi phân tích sóng não và hướng dẫn lâm sàng. Khi người đặt câu hỏi bấm Nghiệm thu, tín chỉ sẽ tự động cộng vào ví Honoraria của bạn.',
      );
      setReplyDrafts((prev) => {
        const next = { ...prev };
        delete next[vars.ticketId];
        return next;
      });
      invalidateConsultationQueries();
    },
    onError: (err) => {
      setFeedbackSuccess(null);
      setFeedbackError(errorMessage(err));
    },
  });

  const acceptReplyMutation = useMutation({
    mutationFn: (payload: { ticketId: string; replyId: string; rating: number }) =>
      consultationsApi.acceptReply(payload.ticketId, payload.replyId, payload.rating),
    onSuccess: () => {
      setFeedbackError(null);
      setFeedbackSuccess(
        'Đã nghiệm thu kết quả phân tích sóng não và giải ngân tín chỉ thù lao cho bác sĩ/chuyên gia.',
      );
      invalidateConsultationQueries();
    },
    onError: (err) => {
      setFeedbackSuccess(null);
      setFeedbackError(errorMessage(err));
    },
  });

  const handleSubmitTicket = (e: FormEvent) => {
    e.preventDefault();
    setFeedbackError(null);
    setFeedbackSuccess(null);
    if (title.trim().length < 6) {
      setFeedbackError('Vui lòng nhập tiêu đề câu hỏi rõ ràng (tối thiểu 6 ký tự).');
      return;
    }
    if (symptomSummary.trim().length < 15) {
      setFeedbackError('Vui lòng mô tả triệu chứng, bối cảnh đo EEG và câu hỏi cụ thể (tối thiểu 15 ký tự).');
      return;
    }
    if (bountyCredits > (wallet?.balance ?? 0)) {
      setFeedbackError('Số dư tín chỉ hiện tại không đủ. Hãy nhận 250 tín chỉ khởi đầu hoặc giảm mức tín chỉ đặt cọc.');
      return;
    }
    createTicketMutation.mutate();
  };

  const getDraft = (ticketId: string) =>
    replyDrafts[ticketId] ?? {
      waveAnalysisText: '',
      clinicalGuidanceText: '',
      recommendedFollowUp: '',
    };

  const updateDraft = (
    ticketId: string,
    field: 'waveAnalysisText' | 'clinicalGuidanceText' | 'recommendedFollowUp',
    value: string,
  ) => {
    setReplyDrafts((prev) => ({
      ...prev,
      [ticketId]: {
        ...getDraft(ticketId),
        [field]: value,
      },
    }));
  };

  const workstationHref = `/clinical-workstation?mode=${isProfessional ? 'professional' : 'general'}`;
  const isQueueView = activeScope === 'queue' && canAccessProfessionalMode;
  const showLeftColumn = isQueueView || (activeScope !== 'queue' && showForm);

  return (
    <div className={cn('mx-auto space-y-5', isProfessional ? 'max-w-7xl' : 'max-w-6xl')}>
      {/* Flat Page Header directly on canvas */}
      <div className="border-b border-[#DCE6DF] pb-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#141413] truncate">
            {isProfessional ? 'Phòng Đọc Ca' : 'Hỏi Bác sĩ'}
          </h1>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Wallet balance text */}
            <span className="px-2.5 py-1.5 text-xs font-mono font-semibold text-[#575652] tabular-nums">
              {walletQuery.isLoading ? '...' : `${wallet?.balance ?? 0} tín chỉ`}
            </span>
            <a
              href={workstationHref}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[#DCE6DF] bg-white px-3 py-1.5 text-xs font-medium text-[#262624] hover:bg-[#F5FAF7] transition-colors"
              aria-label="Mở Trạm qEEG Cortical"
            >
              <Activity className="size-3.5 text-[#16A34A]" aria-hidden />
              <span>Trạm qEEG</span>
            </a>
            {!isQueueView && (
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => setShowForm((v) => !v)}
                icon={<Stethoscope className="size-3.5" aria-hidden />}
              >
                {showForm ? 'Đóng' : 'Đặt câu hỏi'}
              </Button>
            )}
          </div>
        </div>

        {/* Starter Grant Banner when balance is 0 */}
        {!walletQuery.isLoading && wallet && wallet.balance === 0 && !hasClaimedStarterGrant && (
          <div className="rounded-xl bg-[#F5FAF7] border border-[#DCE6DF] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-[#262624] min-w-0">
              <Coins className="size-4 text-[#16A34A] shrink-0" aria-hidden />
              <span className="font-medium">Nhận 250 Tín chỉ Khởi đầu để đặt câu hỏi cho bác sĩ</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="primary"
              loading={claimGrantMutation.isPending}
              onClick={() => claimGrantMutation.mutate()}
              className="shrink-0 whitespace-nowrap"
            >
              Nhận ngay
            </Button>
          </div>
        )}
      </div>

      {feedbackError && <Alert tone="error">{feedbackError}</Alert>}
      {feedbackSuccess && <Alert tone="success">{feedbackSuccess}</Alert>}

      {/* Understated Inline Ask-Doctor Prompt */}
      {!showForm && !isQueueView && (
        <div className="rounded-xl border border-[#DCE6DF] bg-white px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar
              name={user?.displayName || user?.username || 'Bạn'}
              src={user?.avatarUrl}
              size="sm"
            />
            <span className="text-sm text-[#6E6D68] truncate">
              Đặt câu hỏi hoặc gửi bản ghi sóng não cho bác sĩ...
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => setShowForm(true)}
            className="shrink-0"
          >
            Đặt câu hỏi
          </Button>
        </div>
      )}

      {/* Scope Underline Tabs + Filters */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-[#DCE6DF]">
        <div className="flex items-center gap-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveScope('mine')}
            className={cn(
              'border-b-2 pb-2.5 text-sm transition-colors whitespace-nowrap shrink-0',
              activeScope === 'mine'
                ? 'border-[#16A34A] font-bold text-[#15803D]'
                : 'border-transparent font-normal text-[#6E6D68] hover:text-[#15803D]',
            )}
          >
            Của tôi
          </button>

          {canAccessProfessionalMode && (
            <button
              type="button"
              onClick={() => setActiveScope('queue')}
              className={cn(
                'border-b-2 pb-2.5 text-sm transition-colors whitespace-nowrap shrink-0',
                activeScope === 'queue'
                  ? 'border-[#16A34A] font-bold text-[#15803D]'
                  : 'border-transparent font-normal text-[#6E6D68] hover:text-[#15803D]',
              )}
            >
              Ca chờ đọc
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveScope('all')}
            className={cn(
              'border-b-2 pb-2.5 text-sm transition-colors whitespace-nowrap shrink-0',
              activeScope === 'all'
                ? 'border-[#16A34A] font-bold text-[#15803D]'
                : 'border-transparent font-normal text-[#6E6D68] hover:text-[#15803D]',
            )}
          >
            Tất cả
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs pb-2.5">
          <div className="flex items-center gap-1.5 text-[#6E6D68]">
            <Filter className="size-3.5" aria-hidden />
            <label htmlFor="consult-filter-category" className="font-medium">
              Chuyên khoa:
            </label>
          </div>
          <select
            id="consult-filter-category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-[#DCE6DF] bg-white px-2.5 py-1.5 text-xs font-medium text-[#141413] focus:border-[#16A34A] focus-visible:outline-none"
          >
            <option value="ALL">Tất cả chuyên khoa</option>
            {CLINICAL_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.shortLabel}
              </option>
            ))}
          </select>

          <label htmlFor="consult-filter-status" className="sr-only">
            Lọc trạng thái ca tư vấn
          </label>
          <select
            id="consult-filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-[#DCE6DF] bg-white px-2.5 py-1.5 text-xs font-medium text-[#141413] focus:border-[#16A34A] focus-visible:outline-none"
          >
            <option value="ALL">Mọi trạng thái</option>
            <option value="OPEN">Chờ tiếp nhận</option>
            <option value="CLAIMED">Đang đọc ca</option>
            <option value="ANSWERED">Đã phản hồi</option>
            <option value="ACCEPTED">Đã nghiệm thu</option>
          </select>
        </div>
      </div>

      {/* Main Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Ask Question Form (when toggled) OR Clinical Triage Guide (queue) */}
        {showLeftColumn && (
          <div className="lg:col-span-5 space-y-4">
          {activeScope === 'queue' && canAccessProfessionalMode ? (
            <Card className="p-5 border-[#DCE6DF] space-y-4">
              <div className="border-b border-[#DCE6DF] pb-3">
                <h2 className="text-sm font-semibold text-[#141413] flex items-center gap-2">
                  <ShieldCheck className="size-4 text-[#16A34A]" aria-hidden />
                  <span>Quy trình Đọc Ca Ngoài giờ (Remote Overtime Triage)</span>
                </h2>
                <p className="text-xs text-[#575652] mt-1 leading-relaxed">
                  Dành cho Bác sĩ Chuyên khoa, Bác sĩ Nội trú và Nhà khoa học Thần kinh đã xác minh CCHN/ORCID. Tín chỉ cảm ơn từ người đặt câu hỏi được tạm giữ an toàn và chuyển vào Ví Honoraria ngay khi người bệnh nghiệm thu kết quả.
                </p>
              </div>

              <div className="space-y-2.5 text-xs text-[#262624]">
                <div className="rounded-lg bg-[#F5FAF7] border border-[#DCE6DF] p-3 space-y-1">
                  <p className="font-semibold text-[#141413]">1. Kiểm tra Red-Flag &amp; Tỉ số qEEG</p>
                  <p className="text-[#575652]">
                    Đối chiếu DAR (Delta/Alpha), BSI (chỉ số bất đối xứng bán cầu), TAR và PRI. Nếu BSI ≥ 0.22 hoặc DAR ≥ 3.2, ưu tiên cảnh báo chuyển cấp cứu 115 trước khi tư vấn kế hoạch theo dõi.
                  </p>
                </div>
                <div className="rounded-lg bg-[#F5FAF7] border border-[#DCE6DF] p-3 space-y-1">
                  <p className="font-semibold text-[#141413]">2. Nhận đọc ca &amp; Kiểm tra trên Trạm qEEG</p>
                  <p className="text-[#575652]">
                    Bấm <strong>Nhận đọc ca</strong> để khóa quyền xử lý ca bệnh, sau đó có thể mở Trạm Điện não Cortical để xem phân bố dải tần và bản đồ vỏ não 19 kênh.
                  </p>
                </div>
                <div className="rounded-lg bg-[#F5FAF7] border border-[#DCE6DF] p-3 space-y-1">
                  <p className="font-semibold text-[#141413]">3. Trả lời 3 phần chuẩn hóa</p>
                  <p className="text-[#575652]">
                    Phân tích rõ đặc trưng sóng não, đưa ra hướng dẫn điều chỉnh sinh hoạt/nghỉ ngơi phù hợp và mốc tái khám chuyên khoa — tách biệt hoàn toàn với y lệnh điều trị nội viện.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-[#DCE6DF] flex flex-wrap gap-2">
                <a
                  href="/clinical-workstation?mode=professional"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#16A34A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#15803D] transition-colors"
                >
                  <Activity className="size-3.5" aria-hidden />
                  <span>Mở Trạm qEEG Cortical</span>
                </a>
                <Link
                  to="/rewards"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE6DF] bg-white px-3 py-1.5 text-xs font-medium text-[#262624] hover:bg-[#F5FAF7]"
                >
                  <Coins className="size-3.5 text-[#16A34A]" aria-hidden />
                  <span>Xem Ví Honoraria</span>
                </Link>
              </div>
            </Card>
          ) : (
            <Card className="p-5 border-[#DCE6DF] space-y-4">
              <div className="border-b border-[#DCE6DF] pb-2.5">
                <h2 className="text-sm sm:text-base font-semibold text-[#141413] flex items-center gap-2">
                  <HeartPulse
                    className="size-4 text-[#16A34A]"
                    aria-hidden
                  />
                  <span>Đặt câu hỏi mới</span>
                </h2>
              </div>

              <form onSubmit={handleSubmitTicket} className="space-y-3.5">
                <Field
                  label="Tiêu đề"
                  htmlFor="consult-title"
                >
                  <Input
                    id="consult-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="VD: Đánh giá chỉ số mệt mỏi TAR và sóng chậm sau mất ngủ kéo dài"
                    maxLength={200}
                    required
                  />
                </Field>

                <Field
                  label="Mảng sức khỏe"
                  htmlFor="consult-category"
                >
                  <select
                    id="consult-category"
                    value={clinicalCategory}
                    onChange={(e) => setClinicalCategory(e.target.value as ClinicalCategory)}
                    className="h-9.5 w-full rounded-lg border border-[#DCE6DF] bg-white px-3 text-xs sm:text-sm text-[#141413] focus:border-[#16A34A] focus-visible:outline-none"
                  >
                    {CLINICAL_CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {isProfessional ? opt.label : opt.shortLabel}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Triệu chứng"
                  htmlFor="consult-summary"
                  hint={isProfessional ? 'Ghi rõ thời gian xuất hiện triệu chứng, giấc ngủ gần đây, thuốc đang dùng.' : undefined}
                >
                  <Textarea
                    id="consult-summary"
                    rows={4}
                    value={symptomSummary}
                    onChange={(e) => setSymptomSummary(e.target.value)}
                    placeholder="Mô tả triệu chứng, thời điểm đo hoặc câu hỏi cần bác sĩ giải thích..."
                    maxLength={2000}
                    required
                  />
                </Field>

                {(() => {
                  const attachmentFields = (
                    <div className="space-y-3">
                      <Field
                        label="Mẫu phân tích qEEG (nếu có)"
                        htmlFor="consult-sample"
                      >
                        <select
                          id="consult-sample"
                          value={selectedSampleId}
                          onChange={(e) => setSelectedSampleId(e.target.value)}
                          className="h-9.5 w-full rounded-lg border border-[#DCE6DF] bg-white px-3 text-xs text-[#141413] focus:border-[#16A34A] focus-visible:outline-none"
                        >
                          <option value="">-- Không đính kèm (tùy chọn) --</option>
                          {samples.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.subjectCode} · {CATEGORY_MAP[s.clinicalCategory]?.shortLabel} (DAR{' '}
                              {s.dar.toFixed(2)}, BSI {s.bsi.toFixed(2)}, TAR {s.tar.toFixed(2)})
                            </option>
                          ))}
                        </select>
                      </Field>

                      {selectedSample && (
                        <div className="rounded-lg border border-[#DCE6DF] bg-white p-3 text-[11px] font-mono tabular-nums space-y-1">
                          <div className="flex items-center justify-between font-sans font-semibold text-[#141413]">
                            <span>Xem trước chỉ số: {selectedSample.subjectCode}</span>
                            {(selectedSample.bsi >= 0.22 || selectedSample.dar >= 3.2) && (
                              <span className="text-[11px] font-medium text-red-700">
                                Dấu hiệu cần khám khẩn · Gọi 115
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-[#575652] pt-1">
                            <span>DAR: {selectedSample.dar.toFixed(2)}</span>
                            <span>BSI: {selectedSample.bsi.toFixed(2)}</span>
                            <span>TAR: {selectedSample.tar.toFixed(2)}</span>
                            <span>wPLI: {selectedSample.wpli.toFixed(2)}</span>
                          </div>
                        </div>
                      )}

                      <Field
                        label="Hồ sơ EEG cá nhân (tùy chọn)"
                        htmlFor="consult-dataset"
                      >
                        <select
                          id="consult-dataset"
                          value={selectedDatasetId}
                          onChange={(e) => setSelectedDatasetId(e.target.value)}
                          className="h-9.5 w-full rounded-lg border border-[#DCE6DF] bg-white px-3 text-xs text-[#141413] focus:border-[#16A34A] focus-visible:outline-none"
                        >
                          <option value="">-- Không đính kèm --</option>
                          {myDatasets.map((ds) => (
                            <option key={ds.id} value={ds.id}>
                              {ds.patientCode} · {ds.title} ({ds.channelsCount} kênh, {ds.samplingRate})
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  );

                  if (isProfessional) return attachmentFields;

                  return (
                    <details
                      open={Boolean(selectedSampleId || selectedDatasetId)}
                      className="rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] p-3"
                    >
                      <summary className="cursor-pointer text-xs font-medium text-[#262624]">
                        Đính kèm sóng não (tùy chọn) ▾
                      </summary>
                      <div className="pt-3">{attachmentFields}</div>
                    </details>
                  );
                })()}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="consult-bounty"
                      className="block text-xs font-semibold uppercase tracking-wider text-[#6E6D68]"
                    >
                      Tín chỉ cảm ơn
                    </label>
                    <span className="text-xs font-mono font-semibold text-[#15803D] tabular-nums">
                      Ví: {wallet?.balance ?? 0}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {BOUNTY_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setBountyCredits(preset)}
                        className={cn(
                          'rounded-lg px-2.5 py-1 text-xs font-mono font-semibold border transition-colors',
                          bountyCredits === preset
                            ? 'bg-[#16A34A] text-white border-[#16A34A]'
                            : 'bg-[#EFF6F1] text-[#374151] border-[#DCE6DF] hover:bg-[#E2EFE6]',
                        )}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  {isProfessional && (
                    <Input
                      id="consult-bounty"
                      type="number"
                      min={0}
                      max={500}
                      step={5}
                      value={bountyCredits}
                      onChange={(e) => setBountyCredits(Math.max(0, Number(e.target.value) || 0))}
                    />
                  )}
                  <p className="text-[11px] text-[#6E6D68]">
                    Chỉ trừ khi nghiệm thu câu trả lời
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  variant="primary"
                  loading={createTicketMutation.isPending}
                  icon={<Send className="size-4" />}
                >
                  Gửi câu hỏi
                </Button>
              </form>

              <div className="pt-2 border-t border-[#DCE6DF] flex items-center justify-between text-xs">
                <span className="text-[#6E6D68]">Chưa có bản đo sóng não?</span>
                <Link
                  to="/eeg-hub"
                  className="font-semibold text-[#16A34A] hover:text-[#15803D] hover:underline inline-flex items-center gap-1"
                >
                  <span>Mở Đo sóng</span>
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            </Card>
          )}
          </div>
        )}

        {/* Right Column: Ticket Feed / Queue */}
        <div className={cn('space-y-4', showLeftColumn ? 'lg:col-span-7' : 'lg:col-span-12')}>
          {ticketsQuery.isLoading ? (
            <Spinner label="Đang tải danh sách ca tư vấn sóng não..." />
          ) : ticketsQuery.isError ? (
            <Alert tone="error">{errorMessage(ticketsQuery.error)}</Alert>
          ) : tickets.length === 0 ? (
            <Card className="p-6">
              <EmptyState
                icon={<Stethoscope className="size-8" />}
                title={
                  isQueueView
                    ? 'Hiện chưa có ca nào đang chờ trong hàng đợi'
                    : 'Chưa có câu hỏi tư vấn sóng não nào'
                }
                description={
                  isQueueView
                    ? 'Các ca bệnh mới từ cộng đồng kèm dữ liệu qEEG sẽ xuất hiện tại đây để bạn tiếp nhận và phân tích.'
                    : 'Nhấn "+ Đặt câu hỏi cho Bác sĩ" và đính kèm bản ghi sóng não để nhận phân tích từ bác sĩ chuyên khoa.'
                }
                action={
                  !isQueueView && !showForm ? (
                    <Button size="sm" onClick={() => setShowForm(true)}>
                      + Đặt câu hỏi cho Bác sĩ
                    </Button>
                  ) : null
                }
              />
            </Card>
          ) : (
            tickets.map((ticket: ConsultationTicketItem) => {
              const catMeta = CATEGORY_MAP[ticket.clinicalCategory];
              const statusMeta = STATUS_META[ticket.status];
              const isRequester = user?.id === ticket.requesterId;
              const isClaimedByMe = user?.id === ticket.claimedById;
              const canClaim =
                canAccessProfessionalMode &&
                ticket.status === 'OPEN' &&
                !isRequester;
              const canWriteReply =
                canAccessProfessionalMode &&
                !isRequester &&
                ticket.status !== 'ACCEPTED' &&
                ticket.status !== 'CANCELLED' &&
                (isClaimedByMe || (ticket.status === 'CLAIMED' && !ticket.claimedById));
              const draft = getDraft(ticket.id);

              return (
                <Card
                  key={ticket.id}
                  className={cn(
                    'p-5 space-y-4 transition-colors bg-white',
                    ticket.urgentRedFlag ? 'border-red-300' : 'border-[#DCE6DF]',
                  )}
                >
                  {/* Ticket Card Header */}
                  <div className="space-y-1.5 border-b border-[#DCE6DF] pb-3">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6E6D68] tabular-nums">
                      {catMeta && (
                        <>
                          <span className="font-medium text-[#262624]">{catMeta.shortLabel}</span>
                          <span aria-hidden>·</span>
                        </>
                      )}
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#575652]">
                        <span
                          className={cn(
                            'size-1.5 rounded-full shrink-0',
                            ticket.status === 'ANSWERED' || ticket.status === 'ACCEPTED'
                              ? 'bg-[#16A34A]'
                              : ticket.status === 'CANCELLED'
                                ? 'bg-[#8A8882]'
                                : 'bg-amber-500',
                          )}
                          aria-hidden
                        />
                        {statusMeta.label}
                      </span>
                      <span aria-hidden>·</span>
                      <span>
                        {ticket.bountyCredits > 0
                          ? `${ticket.bountyCredits} tín chỉ (${ticket.status === 'ACCEPTED' ? 'đã giải ngân' : 'tạm giữ'})`
                          : 'Hỏi đáp miễn phí'}
                      </span>
                      {ticket.urgentRedFlag && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="inline-flex items-center gap-1.5 font-semibold text-red-700">
                            <span className="size-1.5 rounded-full bg-red-600 shrink-0" aria-hidden />
                            Cần khám khẩn
                          </span>
                        </>
                      )}
                    </div>
                    <h3 className="text-sm sm:text-base font-semibold text-[#141413] leading-snug">
                      {ticket.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#6E6D68]">
                      <span className="font-medium text-[#262624]">
                        {ticket.requester.displayName} (@{ticket.requester.username})
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" aria-hidden />
                        {formatDateTime(ticket.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Concise 1-Line 115 Urgent Alert Badge inside Urgent Cards */}
                  {ticket.urgentRedFlag && (
                    <div
                      role="alert"
                      className="rounded-lg border border-red-200 bg-red-50/70 px-3 py-1.5 text-xs font-medium text-red-800 flex items-center gap-2"
                    >
                      <PhoneCall className="size-3.5 text-red-600 shrink-0" aria-hidden />
                      <span>
                        Dấu hiệu cần khám khẩn: Nếu có yếu tay chân hoặc nói khó, vui lòng gọi 115 ngay
                      </span>
                    </div>
                  )}

                  {/* Symptom Summary */}
                  <p
                    className={cn(
                      'text-xs sm:text-sm text-[#262624] leading-relaxed whitespace-pre-line',
                      !isProfessional && 'line-clamp-2',
                    )}
                  >
                    {ticket.symptomSummary}
                  </p>

                  {/* Attached qEEG Neural Sample Telemetry */}
                  {ticket.neuralSample && (() => {
                    const sample = ticket.neuralSample;
                    const sampleMetricsGrid = (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono tabular-nums">
                          <div className="rounded-lg bg-white border border-[#DCE6DF] px-2.5 py-1.5">
                            <span className="block text-[10px] text-[#6E6D68] font-sans">DAR (δ/α)</span>
                            <span
                              className={cn(
                                'font-semibold',
                                sample.dar >= 3.2 ? 'text-red-700' : 'text-[#141413]',
                              )}
                            >
                              {sample.dar.toFixed(2)}
                            </span>
                          </div>
                          <div className="rounded-lg bg-white border border-[#DCE6DF] px-2.5 py-1.5">
                            <span className="block text-[10px] text-[#6E6D68] font-sans">BSI (L/R)</span>
                            <span
                              className={cn(
                                'font-semibold',
                                sample.bsi >= 0.22 ? 'text-red-700' : 'text-[#141413]',
                              )}
                            >
                              {sample.bsi.toFixed(2)}
                            </span>
                          </div>
                          <div className="rounded-lg bg-white border border-[#DCE6DF] px-2.5 py-1.5">
                            <span className="block text-[10px] text-[#6E6D68] font-sans">TAR (θ/α)</span>
                            <span className="font-semibold text-[#141413]">
                              {sample.tar.toFixed(2)}
                            </span>
                          </div>
                          <div className="rounded-lg bg-white border border-[#DCE6DF] px-2.5 py-1.5">
                            <span className="block text-[10px] text-[#6E6D68] font-sans">wPLI</span>
                            <span className="font-semibold text-[#141413]">
                              {sample.wpli.toFixed(2)}
                            </span>
                          </div>
                          <div className="rounded-lg bg-white border border-[#DCE6DF] px-2.5 py-1.5">
                            <span className="block text-[10px] text-[#6E6D68] font-sans">Chất lượng</span>
                            <span className="font-semibold text-[#15803D]">
                              {Math.round(sample.signalQualityScore * 100)}%
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6E6D68] font-mono">
                          <span>
                            {sample.channelsCount} kênh · {sample.samplingRateHz} Hz · {sample.montage}
                          </span>
                          {sample.tpaLockoutTriggered && (
                            <span className="font-sans font-semibold text-red-700">
                              Cảnh báo xuất huyết / Khóa tPA
                            </span>
                          )}
                        </div>
                      </>
                    );

                    if (!isProfessional) {
                      return (
                        <details className="rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] px-3 py-2 text-xs">
                          <summary className="cursor-pointer font-medium text-[#262624]">
                            Thông số đính kèm ({sample.subjectCode}) ▾
                          </summary>
                          <div className="pt-2.5 space-y-2">
                            {sampleMetricsGrid}
                          </div>
                        </details>
                      );
                    }

                    return (
                      <div className="rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] p-3.5 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-[#141413]">
                            <Activity className="size-4 text-[#16A34A]" aria-hidden />
                            <span>
                              Bản ghi qEEG đính kèm:{' '}
                              <span className="font-mono text-[#15803D]">
                                {sample.subjectCode}
                              </span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={workstationHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-[#DCE6DF] bg-white px-2.5 py-1 text-[11px] font-medium text-[#141413] hover:bg-[#EFF6F1] transition-colors"
                            >
                              <span>Soi trên Trạm qEEG</span>
                              <ArrowUpRight className="size-3" aria-hidden />
                            </a>
                            <Link
                              to="/eeg-hub"
                              className="inline-flex items-center gap-1 rounded-lg border border-[#DCE6DF] bg-white px-2.5 py-1 text-[11px] font-medium text-[#575652] hover:text-[#15803D]"
                            >
                              <span>Mở EEG Hub</span>
                            </Link>
                          </div>
                        </div>

                        {sampleMetricsGrid}
                      </div>
                    );
                  })()}

                  {ticket.datasetId && !ticket.neuralSample && (
                    <div className="rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] px-3 py-2 text-xs text-[#262624] flex items-center justify-between">
                      <span className="font-mono">
                        Hồ sơ EEG đính kèm: <strong>{ticket.datasetId}</strong>
                      </span>
                      <Link to="/eeg-hub" className="font-semibold text-[#16A34A] hover:text-[#15803D] hover:underline">
                        Xem trong EEG Hub →
                      </Link>
                    </div>
                  )}

                  {/* Claimed Status & Professional Action Controls */}
                  {ticket.claimedBy && (
                    <div className="flex items-center gap-2 rounded-lg bg-[#F5FAF7] border border-[#DCE6DF] px-3 py-2 text-xs text-[#262624]">
                      <UserCheck className="size-4 text-[#16A34A] shrink-0" aria-hidden />
                      <span>
                        Đang được tiếp nhận đọc ca bởi{' '}
                        <strong className="text-[#141413]">{ticket.claimedBy.displayName}</strong> (@{ticket.claimedBy.username})
                      </span>
                    </div>
                  )}

                  {canClaim && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span className="text-xs text-[#6E6D68]">
                        Ca này đang mở trong hàng đợi đọc sóng não từ xa.
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        loading={claimTicketMutation.isPending}
                        onClick={() => claimTicketMutation.mutate(ticket.id)}
                        icon={<ClipboardCheck className="size-4" />}
                      >
                        Nhận đọc ca này
                      </Button>
                    </div>
                  )}

                  {/* Doctor / Scientist Reply Form (when claimed by current professional) */}
                  {canWriteReply && (
                    <div className="rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#141413]">
                          Gửi Báo cáo Phân tích Sóng não &amp; Hướng dẫn Lâm sàng
                        </h4>
                        <a
                          href="/clinical-workstation?mode=professional"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-[#16A34A] hover:text-[#15803D] hover:underline inline-flex items-center gap-1"
                        >
                          <span>Kiểm tra trên Trạm qEEG</span>
                          <ArrowUpRight className="size-3" aria-hidden />
                        </a>
                      </div>

                      <Field
                        label="1. Phân tích sóng não & Chỉ số định lượng (DAR / BSI / TAR)"
                        htmlFor={`wave-${ticket.id}`}
                      >
                        <Textarea
                          id={`wave-${ticket.id}`}
                          rows={3}
                          value={draft.waveAnalysisText}
                          onChange={(e) =>
                            updateDraft(ticket.id, 'waveAnalysisText', e.target.value)
                          }
                          placeholder="Nhận định phân bố sóng Delta, Theta, Alpha, Beta, mức độ đối xứng bán cầu (BSI) và chất lượng tín hiệu..."
                        />
                      </Field>

                      <Field
                        label="2. Hướng dẫn lâm sàng & Điều chỉnh sinh hoạt"
                        htmlFor={`guide-${ticket.id}`}
                      >
                        <Textarea
                          id={`guide-${ticket.id}`}
                          rows={3}
                          value={draft.clinicalGuidanceText}
                          onChange={(e) =>
                            updateDraft(ticket.id, 'clinicalGuidanceText', e.target.value)
                          }
                          placeholder="Giải thích nguyên nhân khả dĩ, hướng dẫn vệ sinh giấc ngủ, phân bổ nhịp làm việc hoặc lưu ý dấu hiệu cần khám..."
                        />
                      </Field>

                      <Field
                        label="3. Mốc theo dõi & Khuyến nghị tái khám"
                        htmlFor={`follow-${ticket.id}`}
                      >
                        <Input
                          id={`follow-${ticket.id}`}
                          value={draft.recommendedFollowUp}
                          onChange={(e) =>
                            updateDraft(ticket.id, 'recommendedFollowUp', e.target.value)
                          }
                          placeholder="VD: Đo kiểm tra lại sau 7 ngày hoặc khám chuyên khoa Nội Thần kinh nếu triệu chứng tăng"
                        />
                      </Field>

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          loading={replyMutation.isPending}
                          disabled={
                            draft.waveAnalysisText.trim().length < 10 ||
                            draft.clinicalGuidanceText.trim().length < 10 ||
                            draft.recommendedFollowUp.trim().length < 5
                          }
                          onClick={() =>
                            replyMutation.mutate({
                              ticketId: ticket.id,
                              waveAnalysisText: draft.waveAnalysisText.trim(),
                              clinicalGuidanceText: draft.clinicalGuidanceText.trim(),
                              recommendedFollowUp: draft.recommendedFollowUp.trim(),
                            })
                          }
                          icon={<Send className="size-3.5" />}
                        >
                          Gửi Phân tích Sóng não
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Replies List */}
                  {ticket.replies.length > 0 && (
                    <div className="space-y-3 pt-2 border-t border-[#DCE6DF]">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#6E6D68]">
                        Phản hồi chuyên môn ({ticket.replies.length})
                      </p>
                      {ticket.replies.map((reply) => {
                        const selectedRating = replyRatings[reply.id] ?? 5;
                        const canAccept =
                          isRequester &&
                          ticket.status !== 'ACCEPTED' &&
                          ticket.status !== 'CANCELLED' &&
                          !reply.isAccepted;

                        return (
                          <div
                            key={reply.id}
                            className="rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] p-3.5 space-y-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <Avatar
                                  name={reply.responder.displayName}
                                  src={reply.responder.avatarUrl}
                                  size="sm"
                                />
                                <div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-xs font-semibold text-[#141413]">
                                      {reply.responder.displayName}
                                    </span>
                                    <ShieldCheck className="size-3.5 text-[#16A34A] shrink-0" aria-hidden />
                                    <span className="text-[11px] text-[#6E6D68]">
                                      · {reply.responderTier}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-[#6E6D68]">
                                    @{reply.responder.username} · {formatDateTime(reply.createdAt)}
                                  </p>
                                </div>
                              </div>

                              {reply.isAccepted && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#15803D]">
                                  <CheckCircle2 className="size-3.5 text-[#16A34A] shrink-0" aria-hidden />
                                  Đã nghiệm thu ({reply.rating ?? 5}/5)
                                </span>
                              )}
                            </div>

                            <div className="space-y-2.5 text-xs sm:text-sm text-[#262624] leading-relaxed">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#141413]">
                                  Phân tích Sóng não &amp; Biến thiên Chỉ số
                                </p>
                                <p className="mt-0.5 whitespace-pre-line">
                                  {reply.waveAnalysisText}
                                </p>
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6D68]">
                                  Hướng dẫn Lâm sàng &amp; Điều chỉnh Sinh hoạt
                                </p>
                                <p className="mt-0.5 whitespace-pre-line">
                                  {reply.clinicalGuidanceText}
                                </p>
                              </div>
                              <div className="rounded-lg bg-white border border-[#DCE6DF] px-3 py-2 text-xs">
                                <strong className="text-[#141413]">Theo dõi tiếp theo:</strong>{' '}
                                <span className="text-[#575652]">{reply.recommendedFollowUp}</span>
                              </div>
                            </div>

                            {canAccept && (
                              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#DCE6DF]">
                                <div className="flex items-center gap-1.5 text-xs">
                                  <span className="font-medium text-[#575652]">
                                    Đánh giá chất lượng:
                                  </span>
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                      key={star}
                                      type="button"
                                      onClick={() =>
                                        setReplyRatings((prev) => ({ ...prev, [reply.id]: star }))
                                      }
                                      aria-label={`Đánh giá ${star} sao`}
                                      className="p-0.5 text-amber-500 hover:scale-110 transition-transform"
                                    >
                                      <Star
                                        className={cn(
                                          'size-4',
                                          star <= selectedRating
                                            ? 'fill-amber-400 text-amber-500'
                                            : 'text-[#C5C3BC]',
                                        )}
                                      />
                                    </button>
                                  ))}
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="primary"
                                  loading={acceptReplyMutation.isPending}
                                  onClick={() =>
                                    acceptReplyMutation.mutate({
                                      ticketId: ticket.id,
                                      replyId: reply.id,
                                      rating: selectedRating,
                                    })
                                  }
                                  icon={<CheckCircle2 className="size-4" />}
                                >
                                  Nghiệm thu &amp; Chuyển Tín chỉ ({ticket.bountyCredits} tín chỉ)
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
