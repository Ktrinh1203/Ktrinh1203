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
  Paperclip,
  PhoneCall,
  Plus,
  Send,
  ShieldCheck,
  Star,
  Stethoscope,
  UserCheck,
  X,
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
    label: 'Phần cứng đo sóng não & Giao diện Não-Máy (BCI)',
    shortLabel: 'Phần cứng & BCI',
    badgeClass: 'bg-[#EFF6F1] text-[#15803D] border-[#DCE6DF]',
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

  const tabParam = searchParams.get('tab');
  const [activeScope, setActiveScope] = useState<'mine' | 'queue' | 'all'>(() => {
    if (tabParam === 'queue' && canAccessProfessionalMode) return 'queue';
    if (tabParam === 'all') return 'all';
    if (tabParam === 'mine') return 'mine';
    return isProfessional && canAccessProfessionalMode ? 'queue' : 'mine';
  });

  const [categoryFilter, setCategoryFilter] = useState<string>(
    searchParams.get('category') || 'ALL',
  );
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Create ticket modal state
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

  // Modal states (sequential UX)
  const [showAskModal, setShowAskModal] = useState(() =>
    Boolean(
      searchParams.get('ask') === '1' ||
        searchParams.get('sampleId') ||
        searchParams.get('datasetId'),
    ),
  );
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

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

  const prevRoleModeRef = useRef({ isProfessional, canAccessProfessionalMode });
  useEffect(() => {
    const prev = prevRoleModeRef.current;
    prevRoleModeRef.current = { isProfessional, canAccessProfessionalMode };
    const enteredPro =
      isProfessional &&
      canAccessProfessionalMode &&
      (!prev.isProfessional || !prev.canAccessProfessionalMode);
    const leftPro = !isProfessional && prev.isProfessional;

    if (enteredPro && !searchParams.get('tab')) {
      setActiveScope('queue');
    } else if (leftPro) {
      setActiveScope((curr) => (curr === 'queue' ? 'mine' : curr));
    }
  }, [isProfessional, canAccessProfessionalMode, searchParams]);

  useEffect(() => {
    const askParam = searchParams.get('ask');
    const sampleParam = searchParams.get('sampleId');
    const datasetParam = searchParams.get('datasetId');
    if (sampleParam) setSelectedSampleId(sampleParam);
    if (datasetParam) setSelectedDatasetId(datasetParam);
    if (askParam === '1' || sampleParam || datasetParam) setShowAskModal(true);
  }, [searchParams]);

  const closeAskModal = () => {
    setShowAskModal(false);
    if (
      searchParams.has('ask') ||
      searchParams.has('sampleId') ||
      searchParams.has('datasetId')
    ) {
      const next = new URLSearchParams(searchParams);
      next.delete('ask');
      next.delete('sampleId');
      next.delete('datasetId');
      setSearchParams(next, { replace: true });
    }
  };

  useEffect(() => {
    if (!showAskModal && !selectedTicketId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedTicketId) setSelectedTicketId(null);
        else if (showAskModal) {
          setShowAskModal(false);
          if (
            searchParams.has('ask') ||
            searchParams.has('sampleId') ||
            searchParams.has('datasetId')
          ) {
            const next = new URLSearchParams(searchParams);
            next.delete('ask');
            next.delete('sampleId');
            next.delete('datasetId');
            setSearchParams(next, { replace: true });
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showAskModal, selectedTicketId, searchParams, setSearchParams]);

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
  const latestDataset = myDatasets[0] ?? null;

  const selectedSample = useMemo(
    () => samples.find((s) => s.id === selectedSampleId) ?? null,
    [samples, selectedSampleId],
  );

  const selectedTicket = useMemo(
    () => tickets.find((t) => t.id === selectedTicketId) ?? null,
    [tickets, selectedTicketId],
  );

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
        setFeedbackSuccess(`Đã nhận +${res.amount} Credit miễn phí vào ví.`);
      } else {
        setFeedbackSuccess('Tài khoản đã nhận gói khởi đầu trước đó.');
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
          ? `Đã gửi câu hỏi (tạm giữ ${res.ticket.bountyCredits} Credit). Còn lại: ${res.remainingBalance} Credit.`
          : 'Đã gửi câu hỏi tới bác sĩ.',
      );
      setTitle('');
      setSymptomSummary('');
      setSelectedSampleId('');
      setSelectedDatasetId('');
      closeAskModal();
      invalidateConsultationQueries();
    },
    onError: (err) => {
      setFeedbackSuccess(null);
      setFeedbackError(errorMessage(err));
    },
  });

  const claimTicketMutation = useMutation({
    mutationFn: (ticketId: string) => consultationsApi.claim(ticketId),
    onSuccess: (_res, ticketId) => {
      setFeedbackError(null);
      setFeedbackSuccess('Đã nhận đọc ca. Hãy đối chiếu chỉ số hoặc viết phân tích.');
      setSelectedTicketId(ticketId);
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
      setFeedbackSuccess('Đã gửi phân tích sóng não cho người bệnh.');
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
      setFeedbackSuccess('Đã nghiệm thu và chuyển Credit cho bác sĩ.');
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
      setFeedbackError('Số dư Credit không đủ. Hãy nhận 250 Credit miễn phí hoặc giảm mức Credit.');
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

  return (
    <div className={cn('mx-auto space-y-5', isProfessional ? 'max-w-7xl' : 'max-w-5xl')}>
      {/* Clean Page Header */}
      <div className="border-b border-[#DCE6DF] pb-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#141413] truncate">
            {isProfessional ? 'Phòng đọc ca' : 'Hỏi bác sĩ'}
          </h1>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isProfessional ? (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => setShowAskModal(true)}
                icon={<Plus className="size-3.5" aria-hidden />}
              >
                Đặt câu hỏi
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => setShowAskModal(true)}
                icon={<Plus className="size-4" aria-hidden />}
              >
                Đặt câu hỏi cho bác sĩ
              </Button>
            )}
          </div>
        </div>

        {/* Starter Grant Banner when balance is 0 */}
        {!walletQuery.isLoading && wallet && wallet.balance === 0 && !hasClaimedStarterGrant && (
          <div className="rounded-xl bg-[#F5FAF7] border border-[#DCE6DF] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-[#262624] min-w-0">
              <Coins className="size-4 text-[#16A34A] shrink-0" aria-hidden />
              <span className="font-medium">Nhận 250 Credit miễn phí để hỏi bác sĩ</span>
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

      {/* Scope Underline Tabs + Filters */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-[#DCE6DF]">
        <div className="flex items-center gap-6 overflow-x-auto">
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

      {/* Concise 1-line clinical triage safety alert for Queue tab (SAFETY INVARIANT) */}
      {isQueueView && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/80 px-3.5 py-2 text-xs font-semibold text-red-900">
          <ShieldCheck className="size-4 text-red-700 shrink-0" aria-hidden />
          <span>
            Cảnh báo quy trình: Ghi nhận triệu chứng cấp hoặc bất thường sóng chậm — Cần bác sĩ đánh giá khẩn (115 / CT sọ não theo chỉ định lâm sàng)
          </span>
        </div>
      )}

      {/* Full-width Clean Ticket List */}
      <div className="space-y-3">
        {ticketsQuery.isLoading ? (
          <Spinner label="Đang tải danh sách ca tư vấn sóng não..." />
        ) : ticketsQuery.isError ? (
          <Alert tone="error">{errorMessage(ticketsQuery.error)}</Alert>
        ) : tickets.length === 0 ? (
          <Card className="p-6">
            <EmptyState
              icon={<Stethoscope className="size-8" />}
              title={isQueueView ? 'Chưa có ca chờ đọc' : 'Chưa có câu hỏi nào'}
              description={
                isQueueView
                  ? 'Các ca mới sẽ hiển thị tại đây để bác sĩ tiếp nhận.'
                  : 'Gửi triệu chứng và bản ghi sóng não để bác sĩ giải đáp.'
              }
              action={
                !isProfessional ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={() => setShowAskModal(true)}
                    icon={<Plus className="size-4" aria-hidden />}
                  >
                    Đặt câu hỏi cho bác sĩ
                  </Button>
                ) : undefined
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
            const latestReply = ticket.replies[ticket.replies.length - 1] ?? null;

            return (
              <Card
                key={ticket.id}
                className={cn(
                  'p-4 sm:p-5 space-y-2.5 transition-colors bg-white',
                  ticket.urgentRedFlag ? 'border-red-300' : 'border-[#DCE6DF]',
                )}
              >
                {/* Compact Header Meta Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6E6D68] tabular-nums">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#262624]">
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
                    {catMeta && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{catMeta.shortLabel}</span>
                      </>
                    )}
                    {ticket.urgentRedFlag && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                          <span className="size-1.5 rounded-full bg-red-600 shrink-0" aria-hidden />
                          Cần khám khẩn
                        </span>
                      </>
                    )}
                    <span aria-hidden>·</span>
                    <span>
                      {ticket.bountyCredits > 0 ? `${ticket.bountyCredits} Credit` : 'Miễn phí'}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px]">
                    <Clock className="size-3" aria-hidden />
                    {formatDateTime(ticket.createdAt)}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-sm sm:text-base font-semibold text-[#141413] leading-snug">
                  {ticket.title}
                </h3>

                {/* Concise 1-Line 115 Urgent Alert Badge inside Urgent Cards (SAFETY INVARIANT) */}
                {ticket.urgentRedFlag && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50/70 px-3 py-1.5 text-xs font-medium text-red-800 flex items-center gap-2"
                  >
                    <PhoneCall className="size-3.5 text-red-600 shrink-0" aria-hidden />
                    <span>Cảnh báo khẩn: Yếu tay chân / nói khó → Gọi 115 ngay</span>
                  </div>
                )}

                {/* 2-line Symptom Summary */}
                <p className="text-xs sm:text-sm text-[#575652] leading-relaxed line-clamp-2">
                  {ticket.symptomSummary}
                </p>

                {/* Single-line EEG Summary (if attached) */}
                {ticket.neuralSample ? (
                  <p className="text-xs font-mono text-[#575652] tabular-nums truncate">
                    <Activity className="inline size-3.5 text-[#16A34A] mr-1.5 -mt-0.5" aria-hidden />
                    {ticket.neuralSample.subjectCode} ·{' '}
                    {isProfessional
                      ? `DAR ${ticket.neuralSample.dar.toFixed(2)} · BSI ${ticket.neuralSample.bsi.toFixed(2)} · TAR ${ticket.neuralSample.tar.toFixed(2)}`
                      : `Sóng chậm ${ticket.neuralSample.dar.toFixed(2)} · Cân bằng ${ticket.neuralSample.bsi.toFixed(2)} · Mệt mỏi ${ticket.neuralSample.tar.toFixed(2)}`}
                  </p>
                ) : ticket.datasetId ? (
                  <p className="text-xs font-mono text-[#575652] truncate">
                    <Paperclip className="inline size-3.5 text-[#16A34A] mr-1.5 -mt-0.5" aria-hidden />
                    Hồ sơ EEG: {ticket.datasetId}
                  </p>
                ) : null}

                {/* Footer Row: Doctor/Reply Status + Action Button */}
                <div className="pt-2 border-t border-[#DCE6DF]/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2 text-[#6E6D68]">
                    {latestReply ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#15803D]">
                        <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
                        BS. {latestReply.responder.displayName} đã phản hồi
                        {ticket.replies.length > 1 ? ` (${ticket.replies.length})` : ''}
                      </span>
                    ) : ticket.claimedBy ? (
                      <span className="inline-flex items-center gap-1.5 text-[#262624]">
                        <UserCheck className="size-3.5 text-[#16A34A] shrink-0" aria-hidden />
                        BS. {ticket.claimedBy.displayName} đang đọc ca
                      </span>
                    ) : (
                      <span>
                        Người hỏi: <strong className="font-medium text-[#262624]">{ticket.requester.displayName}</strong>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {canClaim && (
                      <Button
                        type="button"
                        size="xs"
                        variant="primary"
                        loading={claimTicketMutation.isPending}
                        onClick={() => claimTicketMutation.mutate(ticket.id)}
                        icon={<ClipboardCheck className="size-3.5" aria-hidden />}
                      >
                        Nhận đọc ca
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="xs"
                      variant={canWriteReply ? 'primary' : 'outline'}
                      onClick={() => setSelectedTicketId(ticket.id)}
                    >
                      {canWriteReply ? 'Viết phân tích ca bệnh' : 'Xem chi tiết ca'}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Sequential Ask Question Modal */}
      {showAskModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-4"
          onClick={closeAskModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ask-modal-title"
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-[#DCE6DF] bg-white shadow-xl text-[#141413]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#DCE6DF] bg-white px-5 py-3.5">
              <h2 id="ask-modal-title" className="text-base font-semibold text-[#141413] flex items-center gap-2">
                <HeartPulse className="size-4 text-[#16A34A]" aria-hidden />
                <span>Đặt câu hỏi cho bác sĩ</span>
              </h2>
              <button
                type="button"
                onClick={closeAskModal}
                aria-label="Đóng cửa sổ đặt câu hỏi"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-[#6E6D68] hover:bg-[#EFF6F1] hover:text-[#141413] transition-colors"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <form onSubmit={handleSubmitTicket} className="p-5 space-y-4">
              {/* Quick Category Pills */}
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Chọn nhanh chuyên khoa
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CLINICAL_CATEGORY_OPTIONS.map((opt) => {
                    const active = clinicalCategory === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setClinicalCategory(opt.value)}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors',
                          active
                            ? 'border-[#16A34A] bg-[#EFF6F1] text-[#15803D] font-semibold'
                            : 'border-[#DCE6DF] bg-white text-[#262624] hover:bg-[#F5FAF7]',
                        )}
                      >
                        {opt.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Field label="Tiêu đề câu hỏi" htmlFor="consult-title">
                <Input
                  id="consult-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Hay tỉnh giấc lúc 3h sáng, sóng chậm hơi cao..."
                  maxLength={200}
                  required
                />
              </Field>

              <Field label="Triệu chứng & câu hỏi cụ thể" htmlFor="consult-summary">
                <Textarea
                  id="consult-summary"
                  rows={4}
                  value={symptomSummary}
                  onChange={(e) => setSymptomSummary(e.target.value)}
                  placeholder="Mô tả triệu chứng, thời gian xuất hiện và điều bạn muốn bác sĩ tư vấn..."
                  maxLength={2000}
                  required
                />
              </Field>

              {/* 1-Tap Attach Latest EEG Record + Optional Selectors */}
              <div className="rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#141413] flex items-center gap-1.5">
                    <Paperclip className="size-3.5 text-[#16A34A]" aria-hidden />
                    Đính kèm bản ghi sóng não (tùy chọn)
                  </span>
                  {latestDataset && (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedDatasetId((prev) =>
                          prev === latestDataset.id ? '' : latestDataset.id,
                        )
                      }
                      className={cn(
                        'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                        selectedDatasetId === latestDataset.id
                          ? 'border-[#16A34A] bg-[#16A34A] text-white'
                          : 'border-[#DCE6DF] bg-white text-[#15803D] hover:bg-[#EFF6F1]',
                      )}
                    >
                      {selectedDatasetId === latestDataset.id
                        ? `✓ Đã chọn: ${latestDataset.patientCode}`
                        : `Đính kèm bản ghi gần nhất (${latestDataset.patientCode})`}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Hồ sơ EEG của tôi" htmlFor="consult-dataset">
                    <select
                      id="consult-dataset"
                      value={selectedDatasetId}
                      onChange={(e) => setSelectedDatasetId(e.target.value)}
                      className="h-9.5 w-full rounded-lg border border-[#DCE6DF] bg-white px-3 text-xs text-[#141413] focus:border-[#16A34A] focus-visible:outline-none"
                    >
                      <option value="">-- Không đính kèm --</option>
                      {myDatasets.map((ds) => (
                        <option key={ds.id} value={ds.id}>
                          {ds.patientCode} · {ds.title} ({ds.channelsCount} kênh)
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Mẫu qEEG tham khảo" htmlFor="consult-sample">
                    <select
                      id="consult-sample"
                      value={selectedSampleId}
                      onChange={(e) => setSelectedSampleId(e.target.value)}
                      className="h-9.5 w-full rounded-lg border border-[#DCE6DF] bg-white px-3 text-xs text-[#141413] focus:border-[#16A34A] focus-visible:outline-none"
                    >
                      <option value="">-- Không đính kèm --</option>
                      {samples.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.subjectCode} · {CATEGORY_MAP[s.clinicalCategory]?.shortLabel ?? s.clinicalCategory}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                {selectedSample && (
                  <div className="rounded-lg border border-[#DCE6DF] bg-white p-2.5 text-[11px] font-mono tabular-nums flex flex-wrap items-center justify-between gap-2 text-[#575652]">
                    <span>
                      {selectedSample.subjectCode}: DAR {selectedSample.dar.toFixed(2)} · BSI {selectedSample.bsi.toFixed(2)} · TAR {selectedSample.tar.toFixed(2)}
                    </span>
                    {(selectedSample.bsi >= 0.22 || selectedSample.dar >= 3.2) && (
                      <span className="font-sans font-semibold text-red-700">
                        Bất thường sóng chậm/bất đối xứng — Nếu có triệu chứng cấp, gọi 115
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Bounty Credits */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="consult-bounty"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#6E6D68]"
                  >
                    Credit cảm ơn
                  </label>
                  <span className="text-xs font-mono font-semibold text-[#15803D] tabular-nums">
                    Ví: {wallet?.balance ?? 0} Credit
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
                <p className="text-[11px] text-[#6E6D68]">
                  Chỉ trừ Credit khi bạn bấm nghiệm thu câu trả lời của bác sĩ.
                </p>
              </div>

              <div className="pt-2 border-t border-[#DCE6DF] flex flex-wrap items-center justify-between gap-3">
                <Link
                  to="/eeg-hub"
                  className="text-xs font-semibold text-[#16A34A] hover:text-[#15803D] hover:underline inline-flex items-center gap-1"
                >
                  <span>Chưa có bản đo? Mở Đo sóng</span>
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={closeAskModal}>
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    variant="primary"
                    loading={createTicketMutation.isPending}
                    icon={<Send className="size-4" aria-hidden />}
                  >
                    Gửi câu hỏi
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sequential Case Detail Modal */}
      {selectedTicket && (() => {
        const ticket = selectedTicket;
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
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-4"
            onClick={() => setSelectedTicketId(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="ticket-detail-title"
              className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-[#DCE6DF] bg-white shadow-xl text-[#141413]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#DCE6DF] bg-white px-5 py-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6E6D68] tabular-nums">
                    {catMeta && (
                      <>
                        <span className="font-medium text-[#262624]">{catMeta.shortLabel}</span>
                        <span aria-hidden>·</span>
                      </>
                    )}
                    <span className="font-medium text-[#575652]">{statusMeta.label}</span>
                    <span aria-hidden>·</span>
                    <span>
                      {ticket.bountyCredits > 0
                        ? `${ticket.bountyCredits} Credit (${ticket.status === 'ACCEPTED' ? 'đã chuyển' : 'tạm giữ'})`
                        : 'Miễn phí'}
                    </span>
                  </div>
                  <h2 id="ticket-detail-title" className="text-base sm:text-lg font-bold text-[#141413] leading-snug">
                    {ticket.title}
                  </h2>
                  <p className="text-xs text-[#6E6D68]">
                    <span className="font-medium text-[#262624]">
                      {ticket.requester.displayName} (@{ticket.requester.username})
                    </span>{' '}
                    · {formatDateTime(ticket.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTicketId(null)}
                  aria-label="Đóng chi tiết ca bệnh"
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-[#6E6D68] hover:bg-[#EFF6F1] hover:text-[#141413] transition-colors"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Safety Alert inside Detail Modal */}
                {ticket.urgentRedFlag && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50/80 px-3.5 py-2 text-xs font-semibold text-red-800 flex items-center gap-2"
                  >
                    <PhoneCall className="size-4 text-red-600 shrink-0" aria-hidden />
                    <span>Cảnh báo khẩn: Yếu tay chân / nói khó → Gọi 115 ngay</span>
                  </div>
                )}

                {/* Full Symptom Description */}
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6E6D68]">
                    Mô tả triệu chứng & câu hỏi
                  </h3>
                  <p className="text-sm text-[#262624] leading-relaxed whitespace-pre-line">
                    {ticket.symptomSummary}
                  </p>
                </div>

                {/* Full 5-Metric qEEG Table */}
                {ticket.neuralSample && (
                  <div className="rounded-xl border border-[#DCE6DF] bg-[#F5FAF7] p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#141413]">
                        <Activity className="size-4 text-[#16A34A]" aria-hidden />
                        <span>
                          Bản ghi qEEG đính kèm:{' '}
                          <span className="font-mono text-[#15803D]">
                            {ticket.neuralSample.subjectCode}
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

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono tabular-nums">
                      <div className="rounded-lg bg-white border border-[#DCE6DF] px-2.5 py-1.5">
                        <span className="block text-[10px] text-[#6E6D68] font-sans">
                          {isProfessional ? 'DAR (δ/α)' : 'Sóng chậm'}
                        </span>
                        <span
                          className={cn(
                            'font-semibold',
                            ticket.neuralSample.dar >= 3.2 ? 'text-red-700' : 'text-[#141413]',
                          )}
                        >
                          {ticket.neuralSample.dar.toFixed(2)}
                        </span>
                      </div>
                      <div className="rounded-lg bg-white border border-[#DCE6DF] px-2.5 py-1.5">
                        <span className="block text-[10px] text-[#6E6D68] font-sans">
                          {isProfessional ? 'BSI (L/R)' : 'Cân bằng 2 bên'}
                        </span>
                        <span
                          className={cn(
                            'font-semibold',
                            ticket.neuralSample.bsi >= 0.22 ? 'text-red-700' : 'text-[#141413]',
                          )}
                        >
                          {ticket.neuralSample.bsi.toFixed(2)}
                        </span>
                      </div>
                      <div className="rounded-lg bg-white border border-[#DCE6DF] px-2.5 py-1.5">
                        <span className="block text-[10px] text-[#6E6D68] font-sans">
                          {isProfessional ? 'TAR (θ/α)' : 'Mệt mỏi'}
                        </span>
                        <span className="font-semibold text-[#141413]">
                          {ticket.neuralSample.tar.toFixed(2)}
                        </span>
                      </div>
                      <div className="rounded-lg bg-white border border-[#DCE6DF] px-2.5 py-1.5">
                        <span className="block text-[10px] text-[#6E6D68] font-sans">
                          {isProfessional ? 'wPLI' : 'Liên kết vùng não'}
                        </span>
                        <span className="font-semibold text-[#141413]">
                          {ticket.neuralSample.wpli.toFixed(2)}
                        </span>
                      </div>
                      <div className="rounded-lg bg-white border border-[#DCE6DF] px-2.5 py-1.5">
                        <span className="block text-[10px] text-[#6E6D68] font-sans">Chất lượng</span>
                        <span className="font-semibold text-[#15803D]">
                          {Math.round(ticket.neuralSample.signalQualityScore * 100)}%
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6E6D68] font-mono">
                      <span>
                        {ticket.neuralSample.channelsCount} kênh · {ticket.neuralSample.samplingRateHz} Hz · {ticket.neuralSample.montage}
                      </span>
                      {ticket.neuralSample.tpaLockoutTriggered && (
                        <span className="font-sans font-semibold text-red-700">
                          Cảnh báo xuất huyết / Khóa tPA
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {ticket.datasetId && !ticket.neuralSample && (
                  <div className="rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] px-3.5 py-2.5 text-xs text-[#262624] flex items-center justify-between">
                    <span className="font-mono">
                      Hồ sơ EEG đính kèm: <strong>{ticket.datasetId}</strong>
                    </span>
                    <Link to="/eeg-hub" className="font-semibold text-[#16A34A] hover:text-[#15803D] hover:underline">
                      Xem trong EEG Hub →
                    </Link>
                  </div>
                )}

                {/* Claimed Info & Claim Action */}
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
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      loading={claimTicketMutation.isPending}
                      onClick={() => claimTicketMutation.mutate(ticket.id)}
                      icon={<ClipboardCheck className="size-4" aria-hidden />}
                    >
                      Nhận đọc ca này
                    </Button>
                  </div>
                )}

                {/* Doctor Reply Form */}
                {canWriteReply && (
                  <div className="rounded-xl border border-[#DCE6DF] bg-[#F5FAF7] p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#141413]">
                        Gửi phân tích cho người bệnh
                      </h3>
                      {!ticket.neuralSample && (
                        <a
                          href={workstationHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-[#16A34A] hover:text-[#15803D] hover:underline inline-flex items-center gap-1"
                        >
                          <span>Soi trên Trạm qEEG</span>
                          <ArrowUpRight className="size-3" aria-hidden />
                        </a>
                      )}
                    </div>

                    <Field label="1. Phân tích sóng não" htmlFor={`wave-${ticket.id}`}>
                      <Textarea
                        id={`wave-${ticket.id}`}
                        rows={3}
                        value={draft.waveAnalysisText}
                        onChange={(e) =>
                          updateDraft(ticket.id, 'waveAnalysisText', e.target.value)
                        }
                        placeholder="Nhận xét các dải sóng và chất lượng tín hiệu..."
                      />
                    </Field>

                    <Field label="2. Hướng dẫn sinh hoạt" htmlFor={`guide-${ticket.id}`}>
                      <Textarea
                        id={`guide-${ticket.id}`}
                        rows={3}
                        value={draft.clinicalGuidanceText}
                        onChange={(e) =>
                          updateDraft(ticket.id, 'clinicalGuidanceText', e.target.value)
                        }
                        placeholder="Hướng dẫn nghỉ ngơi, giấc ngủ và lưu ý..."
                      />
                    </Field>

                    <Field label="3. Theo dõi tiếp theo" htmlFor={`follow-${ticket.id}`}>
                      <Input
                        id={`follow-${ticket.id}`}
                        value={draft.recommendedFollowUp}
                        onChange={(e) =>
                          updateDraft(ticket.id, 'recommendedFollowUp', e.target.value)
                        }
                        placeholder="Lịch đo lại hoặc tái khám..."
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
                        icon={<Send className="size-3.5" aria-hidden />}
                      >
                        Gửi Phân tích Sóng não
                      </Button>
                    </div>
                  </div>
                )}

                {/* Replies List */}
                {ticket.replies.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-[#DCE6DF]">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6E6D68]">
                      Phản hồi chuyên môn ({ticket.replies.length})
                    </h3>
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
                          className="rounded-xl border border-[#DCE6DF] bg-[#F5FAF7] p-4 space-y-3"
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
                                Phân tích sóng não
                              </p>
                              <p className="mt-0.5 whitespace-pre-line">
                                {reply.waveAnalysisText}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6D68]">
                                Hướng dẫn sinh hoạt
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
                                icon={<CheckCircle2 className="size-4" aria-hidden />}
                              >
                                Nghiệm thu ({ticket.bountyCredits} Credit)
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
