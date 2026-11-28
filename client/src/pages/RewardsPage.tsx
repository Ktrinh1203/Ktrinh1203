import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  BookOpen,
  Building2,
  Calendar,
  Check,
  Clock,
  Coins,
  Copy,
  Gift,
  GraduationCap,
  History,
  Landmark,
  Lock,
  PlusCircle,
  QrCode,
  Send,
  Ticket,
  Users,
  X,
} from 'lucide-react';
import { paymentsApi, rewardsApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type {
  CreditTransactionType,
  PaymentOrderItem,
  PayoutRequestStatus,
  RedemptionStatus,
  RewardCatalogItem,
  RewardCategory,
  TopupPackageItem,
} from '../api/types';
import { Button, Card, EmptyState, Input, Spinner, Textarea } from '../components/ui';
import { useAuth } from '../features/auth/AuthContext';
import {
  computeClockOffsetMs,
  computeRemainingSeconds,
  EmbeddedQrCode,
  formatCountdown,
} from '../features/wallet/EmbeddedQrCode';

type WalletTab = 'topup' | 'transfer' | 'redeem' | 'history';
type HistoryFilter = 'transactions' | 'topups';
type TopupOrderInput =
  | { packageId: string; amountVnd?: never }
  | { packageId?: never; amountVnd: number };

const SUPPORTED_BANKS = [
  { bin: '970422', name: 'MB Bank' },
  { bin: '970436', name: 'Vietcombank' },
  { bin: '970407', name: 'Techcombank' },
  { bin: '970418', name: 'BIDV' },
  { bin: '970416', name: 'ACB' },
  { bin: '970432', name: 'VPBank' },
] as const;

const FALLBACK_PACKAGES: TopupPackageItem[] = [
  { id: 'pkg_50k', label: '50.000đ', amountVnd: 50_000, credits: 50, bonusCredits: 0 },
  { id: 'pkg_100k', label: '100.000đ', amountVnd: 100_000, credits: 105, bonusCredits: 5 },
  { id: 'pkg_200k', label: '200.000đ', amountVnd: 200_000, credits: 220, bonusCredits: 20 },
  { id: 'pkg_500k', label: '500.000đ', amountVnd: 500_000, credits: 575, bonusCredits: 75 },
];

const BUCKET_LABELS: Record<string, string> = {
  PURCHASED: 'Nạp',
  EARNED: 'Thưởng',
  PROMO: 'Ưu đãi',
  LOCKED: 'Tạm giữ',
  MIXED: 'Kết hợp',
};

const TRANSACTION_TYPE_LABELS: Record<CreditTransactionType, { label: string; className: string }> = {
  TOPUP_VND: { label: 'Nạp VietQR', className: 'bg-[#ECFDF3] text-[#15803D] border-[#BBF7D0]' },
  P2P_TRANSFER_IN: { label: 'Nhận Credit', className: 'bg-[#ECFDF3] text-[#15803D] border-[#BBF7D0]' },
  P2P_TRANSFER_OUT: { label: 'Chuyển Credit', className: 'bg-[#F5FAF7] text-[#111827] border-[#DCE6DF]' },
  PAYOUT_LOCK: { label: 'Chờ rút NH', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  PAYOUT_SETTLED: { label: 'Đã rút NH', className: 'bg-[#ECFDF3] text-[#15803D] border-[#BBF7D0]' },
  PAYOUT_REFUND: { label: 'Hoàn lệnh rút', className: 'bg-[#EFF6F1] text-[#15803D] border-[#DCE6DF]' },
  CONTRIBUTION_REWARD: { label: 'Thưởng CME', className: 'bg-[#EFF6F1] text-[#15803D] border-[#DCE6DF]' },
  REWARD_REDEMPTION: { label: 'Đổi ưu đãi', className: 'bg-[#F5FAF7] text-[#262624] border-[#DCE6DF]' },
  ADMIN_ADJUSTMENT: { label: 'Điều chỉnh', className: 'bg-[#F5FAF7] text-[#262624] border-[#DCE6DF]' },
  REWARD_REVERSAL: { label: 'Thu hồi', className: 'bg-red-50 text-red-700 border-red-200' },
  REFUND: { label: 'Hoàn Credit', className: 'bg-[#EFF6F1] text-[#15803D] border-[#DCE6DF]' },
  CONSULTATION_ESCROW: { label: 'Tạm giữ tư vấn', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  CONSULTATION_EARNING: { label: 'Thù lao đọc ca', className: 'bg-[#EFF6F1] text-[#15803D] border-[#DCE6DF]' },
  CONSULTATION_REFUND: { label: 'Hoàn tư vấn', className: 'bg-[#EFF6F1] text-[#15803D] border-[#DCE6DF]' },
  DATABANK_PURCHASE: { label: 'Mở dữ liệu', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  DATABANK_ROYALTY: { label: 'Bản quyền EEG', className: 'bg-[#EFF6F1] text-[#15803D] border-[#DCE6DF]' },
  STARTER_GRANT: { label: 'Quà khởi đầu', className: 'bg-[#EFF6F1] text-[#15803D] border-[#DCE6DF]' },
};

const REWARD_CATEGORY_CONFIG: Record<
  RewardCategory,
  { label: string; icon: typeof Gift; colorClass: string }
> = {
  PROFESSIONAL_COURSE: { label: 'Khóa học', icon: GraduationCap, colorClass: 'text-[#15803D] bg-[#EFF6F1]' },
  CONFERENCE_ACCESS: { label: 'Hội nghị', icon: Ticket, colorClass: 'text-[#15803D] bg-[#EFF6F1]' },
  ACADEMIC_RESOURCE: { label: 'Tài liệu', icon: BookOpen, colorClass: 'text-[#15803D] bg-[#EFF6F1]' },
  MENTORING: { label: 'Cố vấn 1:1', icon: Users, colorClass: 'text-[#15803D] bg-[#EFF6F1]' },
  PROFESSIONAL_EVENT: { label: 'Sự kiện', icon: Calendar, colorClass: 'text-[#15803D] bg-[#EFF6F1]' },
  OTHER_BENEFIT: { label: 'Ưu đãi', icon: Gift, colorClass: 'text-[#15803D] bg-[#EFF6F1]' },
  MONETARY_REWARD: { label: 'Tài trợ', icon: Coins, colorClass: 'text-[#6E6D68] bg-[#F5FAF7]' },
};

const PAYOUT_STATUS_META: Record<PayoutRequestStatus, { label: string; className: string }> = {
  PENDING: { label: 'Đang xử lý', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  PAID: { label: 'Đã chuyển khoản', className: 'bg-[#ECFDF3] text-[#15803D] border-[#86EFAC]' },
  REJECTED: { label: 'Từ chối (Đã hoàn)', className: 'bg-red-50 text-red-700 border-red-200' },
};

const REDEMPTION_STATUS_META: Record<RedemptionStatus, { label: string; className: string }> = {
  REQUESTED: { label: 'Chờ xử lý', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  UNDER_REVIEW: { label: 'Đang duyệt', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  APPROVED: { label: 'Đã duyệt', className: 'bg-[#EFF6F1] text-[#15803D] border-[#DCE6DF]' },
  PROCESSING: { label: 'Đang xử lý', className: 'bg-[#F5FAF7] text-[#262624] border-[#DCE6DF]' },
  FULFILLED: { label: 'Hoàn tất', className: 'bg-[#ECFDF3] text-[#15803D] border-[#86EFAC]' },
  REJECTED: { label: 'Từ chối (Đã hoàn)', className: 'bg-red-50 text-red-700 border-red-200' },
  CANCELLED: { label: 'Đã hủy (Đã hoàn)', className: 'bg-[#F5FAF7] text-[#6E6D68] border-[#DCE6DF]' },
  REFUNDED: { label: 'Đã hoàn Credit', className: 'bg-[#EFF6F1] text-[#15803D] border-[#DCE6DF]' },
};

function resolveTab(raw: string | null): WalletTab {
  if (raw === 'orders' || raw === 'billing' || raw === 'history' || raw === 'ledger') {
    return 'history';
  }
  if (raw === 'transfer') return 'transfer';
  if (raw === 'redeem' || raw === 'catalog') return 'redeem';
  return 'topup';
}

function formatTxDescription(description: string, type?: string): string {
  const raw = (description || '').trim();
  if (!raw) {
    if (type === 'RESEARCH_CONTRIBUTION' || type === 'CONTRIBUTION_REWARD') {
      return 'Đóng góp nghiên cứu';
    }
    if (type === 'HEALTHCARE_EDUCATION') return 'Giáo dục sức khỏe';
    if (type === 'EXPERT_QA') return 'Giải đáp chuyên môn';
    if (type === 'RESEARCH_DISCUSSION') return 'Thảo luận nghiên cứu';
    if (type === 'EDUCATIONAL_RESOURCE') return 'Tài liệu giáo dục';
    if (type === 'STARTER_GRANT') return 'Quà khởi đầu';
    if (type === 'P2P_TRANSFER_OUT' || type === 'P2P_TRANSFER_IN') return 'Chuyển Credit';
    if (type === 'TOPUP_VIETQR' || type === 'TOPUP_VND') return 'Nạp VietQR';
    if (type === 'CONSULTATION_BOUNTY' || type === 'CONSULTATION_EARNING') {
      return 'Thù lao hỏi bác sĩ';
    }
    if (type === 'DATA_ACCESS' || type === 'DATABANK_PURCHASE') return 'Mở dữ liệu';
    if (type === 'EEG_CONTRIBUTION' || type === 'DATABANK_ROYALTY') {
      return 'Đóng góp dữ liệu EEG';
    }
    return 'Giao dịch Credit';
  }
  return raw
    .replace(/\s*\(sandbox\)/gi, ' (thử nghiệm)')
    .replace(/\bsandbox\b/gi, 'thử nghiệm')
    .replace(/\bP2P\b/g, 'Chuyển Credit')
    .replace(/\bRESEARCH_CONTRIBUTION\b/g, 'Đóng góp nghiên cứu')
    .replace(/\bHEALTHCARE_EDUCATION\b/g, 'Giáo dục sức khỏe')
    .replace(/\bEXPERT_QA\b/g, 'Giải đáp chuyên môn')
    .replace(/\bRESEARCH_DISCUSSION\b/g, 'Thảo luận nghiên cứu')
    .replace(/\bEDUCATIONAL_RESOURCE\b/g, 'Tài liệu giáo dục')
    .replace(/\bSTARTER_GRANT\b/g, 'Quà khởi đầu')
    .replace(/\bTOPUP_VIETQR\b/g, 'Nạp VietQR')
    .replace(/\bCONSULTATION_BOUNTY\b/g, 'Thù lao hỏi bác sĩ')
    .replace(/\bDATA_ACCESS\b/g, 'Mở dữ liệu')
    .replace(/\bEEG_CONTRIBUTION\b/g, 'Đóng góp dữ liệu EEG')
    .replace(/\s*#[0-9a-f]{6,}\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function makeIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `nl-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatTtlDurationLabel(seconds: number): string {
  const safe = Math.max(60, Math.round(seconds));
  if (safe % 60 === 0) {
    return `${safe / 60} phút`;
  }
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins} phút ${secs} giây`;
}

export function RewardsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTabParam = searchParams.get('tab');
  const activeTab = resolveTab(rawTabParam);
  const toParam = searchParams.get('to') ?? '';

  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>(() =>
    rawTabParam === 'orders' || rawTabParam === 'billing' ? 'topups' : 'transactions',
  );

  useEffect(() => {
    if (rawTabParam === 'orders' || rawTabParam === 'billing') {
      setHistoryFilter('topups');
    }
  }, [rawTabParam]);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Top-up selection & active QR order state
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    FALLBACK_PACKAGES[0].id,
  );
  const [customVnd, setCustomVnd] = useState('');
  const [selectedOrderCode, setSelectedOrderCode] = useState<string | null>(null);
  const [latestCreatedOrder, setLatestCreatedOrder] = useState<PaymentOrderItem | null>(null);
  const [lastTopupInput, setLastTopupInput] = useState<TopupOrderInput | null>(null);
  const [qrPopupOpen, setQrPopupOpen] = useState(false);

  // Server timing synchronization state
  const [latestServerNow, setLatestServerNow] = useState<string | null>(null);
  const [latestOrderTtlSeconds, setLatestOrderTtlSeconds] = useState<number | undefined>(undefined);
  const [latestReminderWindowSeconds, setLatestReminderWindowSeconds] = useState<number | undefined>(
    undefined,
  );
  const [, setCountdownTick] = useState(0);

  // Receive & Bank link / Payout modal state
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawStep, setWithdrawStep] = useState<'bank' | 'payout'>('bank');
  const [bankBin, setBankBin] = useState<string>(SUPPORTED_BANKS[0].bin);
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');

  // P2P Transfer state
  const [recipientInput, setRecipientInput] = useState(toParam);
  const [transferAmount, setTransferAmount] = useState('25');
  const [transferNote, setTransferNote] = useState('');
  const [transferIdempKey, setTransferIdempKey] = useState(() => makeIdempotencyKey());

  // Bank Payout state
  const [payoutAmount, setPayoutAmount] = useState('50');
  const [payoutNote, setPayoutNote] = useState('');
  const [payoutIdempKey, setPayoutIdempKey] = useState(() => makeIdempotencyKey());

  // Catalog Redemption state
  const [selectedReward, setSelectedReward] = useState<RewardCatalogItem | null>(null);
  const [redeemNote, setRedeemNote] = useState('');

  useEffect(() => {
    if (toParam) {
      setRecipientInput(toParam);
    }
  }, [toParam]);

  useEffect(() => {
    if (!withdrawModalOpen && !qrPopupOpen && !selectedReward) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (withdrawModalOpen) {
        setError(null);
        setWithdrawModalOpen(false);
      } else if (selectedReward) {
        setSelectedReward(null);
      } else if (qrPopupOpen) {
        if (!document.querySelector('[role="alertdialog"]')) {
          setQrPopupOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [withdrawModalOpen, qrPopupOpen, selectedReward]);

  const selectTab = (tab: WalletTab) => {
    setError(null);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    if (tab !== 'transfer') {
      next.delete('to');
    }
    setSearchParams(next, { replace: true });
  };

  const invalidateAllWalletQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ['my-wallet'] });
    void queryClient.invalidateQueries({ queryKey: ['rewards'] });
    void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    void queryClient.invalidateQueries({ queryKey: ['payments'] });
  };

  // Queries
  const { data: walletData, isLoading: loadingWallet } = useQuery({
    queryKey: ['my-wallet'],
    queryFn: () => rewardsApi.getWallet(),
    enabled: Boolean(user),
  });

  const { data: packagesData } = useQuery({
    queryKey: ['payments', 'packages'],
    queryFn: () => paymentsApi.getPackages(),
    enabled: Boolean(user),
  });

  const hasOrderReference = Boolean(selectedOrderCode || latestCreatedOrder);

  const { data: ordersData, isLoading: loadingOrders } = useQuery({
    queryKey: ['payments', 'topup-orders'],
    queryFn: () => paymentsApi.getTopupOrders(),
    enabled: Boolean(
      user && (activeTab === 'topup' || activeTab === 'history' || hasOrderReference),
    ),
  });

  const { data: receiveData } = useQuery({
    queryKey: ['payments', 'receive-code'],
    queryFn: () => paymentsApi.getReceiveCode(),
    enabled: Boolean(user && activeTab === 'transfer'),
  });

  const { data: payoutsData } = useQuery({
    queryKey: ['payments', 'payouts'],
    queryFn: () => paymentsApi.getPayoutRequests(),
    enabled: Boolean(user && activeTab === 'transfer'),
  });

  const { data: catalogData, isLoading: loadingCatalog } = useQuery({
    queryKey: ['rewards', 'catalog'],
    queryFn: () => rewardsApi.getCatalog(),
    enabled: activeTab === 'redeem',
  });

  const { data: redemptionsData } = useQuery({
    queryKey: ['rewards', 'my-redemptions'],
    queryFn: () => rewardsApi.getMyRedemptions(),
    enabled: Boolean(user && activeTab === 'redeem'),
  });

  const wallet = walletData?.wallet;
  const transactions = walletData?.transactions ?? [];

  // Hydrate bank form once wallet or receiveData loads
  useEffect(() => {
    const existingBin = receiveData?.bankProfile?.bankBin ?? wallet?.bankBin;
    const existingAccNo = receiveData?.bankProfile?.bankAccountNo ?? wallet?.bankAccountNo;
    const existingAccName = receiveData?.bankProfile?.bankAccountName ?? wallet?.bankAccountName;
    if (existingBin) setBankBin(existingBin);
    if (existingAccNo) setBankAccountNo(existingAccNo);
    if (existingAccName) setBankAccountName(existingAccName);
  }, [
    receiveData?.bankProfile?.bankBin,
    receiveData?.bankProfile?.bankAccountNo,
    receiveData?.bankProfile?.bankAccountName,
    wallet?.bankBin,
    wallet?.bankAccountNo,
    wallet?.bankAccountName,
  ]);

  // Derived top-up config & server clock sync
  const vndPerCredit = packagesData?.vndPerCredit ?? 1000;
  const packages = packagesData?.packages?.length ? packagesData.packages : FALLBACK_PACKAGES;
  const orders = ordersData?.orders ?? [];

  const effectiveServerNow =
    latestServerNow ?? ordersData?.serverNow ?? packagesData?.serverNow ?? null;
  const orderTtlSeconds = latestOrderTtlSeconds ?? packagesData?.orderTtlSeconds ?? 600;
  const reminderWindowSeconds =
    latestReminderWindowSeconds ?? packagesData?.reminderWindowSeconds ?? 60;
  const sandboxEnabled = Boolean(packagesData?.sandboxEnabled);

  const clockOffsetMs = useMemo(
    () => computeClockOffsetMs(effectiveServerNow),
    [effectiveServerNow],
  );

  // Merge latestCreatedOrder with polled/queried orders so list & modal never drift
  const mergedOrders = useMemo(() => {
    if (!latestCreatedOrder) return orders;
    const idx = orders.findIndex((o) => o.orderCode === latestCreatedOrder.orderCode);
    if (idx === -1) return [latestCreatedOrder, ...orders];
    const next = [...orders];
    if (next[idx].status === 'PENDING' && latestCreatedOrder.status !== 'PENDING') {
      next[idx] = latestCreatedOrder;
    }
    return next;
  }, [orders, latestCreatedOrder]);

  const activePendingOrder = useMemo(
    () =>
      mergedOrders.find(
        (o) =>
          o.status === 'PENDING' && computeRemainingSeconds(o.expiresAt, clockOffsetMs) > 0,
      ) ?? null,
    [mergedOrders, clockOffsetMs],
  );

  const hasAnyPendingOrder = mergedOrders.some((o) => o.status === 'PENDING');

  // Tick every 1s when any PENDING order is displayed on Topup banner or History topups filter
  useEffect(() => {
    const needsBannerTick =
      hasAnyPendingOrder &&
      (activeTab === 'topup' || (activeTab === 'history' && historyFilter === 'topups'));
    if (!needsBannerTick) return;
    const timer = window.setInterval(() => {
      setCountdownTick((t) => t + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hasAnyPendingOrder, activeTab, historyFilter]);

  const activeOrder: PaymentOrderItem | null = useMemo(() => {
    if (selectedOrderCode) {
      return (
        mergedOrders.find((o) => o.orderCode === selectedOrderCode) ??
        (latestCreatedOrder?.orderCode === selectedOrderCode ? latestCreatedOrder : null)
      );
    }
    return latestCreatedOrder ?? activePendingOrder ?? null;
  }, [selectedOrderCode, mergedOrders, latestCreatedOrder, activePendingOrder]);

  // Mutations
  const createOrderMutation = useMutation({
    mutationFn: (body: TopupOrderInput) => paymentsApi.createTopupOrder(body),
    onSuccess: (res, variables) => {
      setError(null);
      setLastTopupInput(variables);
      setLatestCreatedOrder(res.order);
      setSelectedOrderCode(res.order.orderCode);
      if (res.serverNow) setLatestServerNow(res.serverNow);
      if (res.orderTtlSeconds) setLatestOrderTtlSeconds(res.orderTtlSeconds);
      if (res.reminderWindowSeconds) setLatestReminderWindowSeconds(res.reminderWindowSeconds);
      setQrPopupOpen(true);
      void queryClient.invalidateQueries({ queryKey: ['payments', 'topup-orders'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const cancelOrderMutation = useMutation({
    mutationFn: (orderCode: string) => paymentsApi.cancelTopupOrder(orderCode),
    onSuccess: (res) => {
      setError(null);
      if (res.serverNow) setLatestServerNow(res.serverNow);
      setLatestCreatedOrder((prev) =>
        prev?.orderCode === res.order.orderCode ? res.order : prev,
      );
      setSuccessMsg(`Đã hủy đơn nạp ${res.order.orderCode}.`);
      void queryClient.invalidateQueries({ queryKey: ['payments', 'topup-orders'] });
    },
    onError: (err) => {
      setError(errorMessage(err));
      void queryClient.invalidateQueries({ queryKey: ['payments', 'topup-orders'] });
    },
  });

  const updateBankMutation = useMutation({
    mutationFn: (body: {
      bankBin: string;
      bankName: string;
      bankAccountNo: string;
      bankAccountName: string;
    }) => paymentsApi.updateBankProfile(body),
    onSuccess: () => {
      setError(null);
      setWithdrawStep('payout');
      setSuccessMsg('Đã liên kết tài khoản ngân hàng.');
      invalidateAllWalletQueries();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const transferMutation = useMutation({
    mutationFn: (body: {
      recipientCodeOrUsername: string;
      amountCredits: number;
      note?: string;
      idempotencyKey?: string;
    }) => paymentsApi.transferCredits(body),
    onSuccess: () => {
      setError(null);
      setSuccessMsg(`Đã chuyển ${transferAmount} Credit tới ${recipientInput.trim()}.`);
      setTransferNote('');
      setTransferIdempKey(makeIdempotencyKey());
      invalidateAllWalletQueries();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const payoutMutation = useMutation({
    mutationFn: (body: { amountCredits: number; note?: string; idempotencyKey?: string }) =>
      paymentsApi.createPayoutRequest(body),
    onSuccess: (res) => {
      setError(null);
      setWithdrawModalOpen(false);
      setSuccessMsg(
        `Đã gửi lệnh rút ${res.payout.amountCredits} Credit (${res.payout.amountVnd.toLocaleString('vi-VN')} ₫).`,
      );
      setPayoutNote('');
      setPayoutIdempKey(makeIdempotencyKey());
      invalidateAllWalletQueries();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const redeemMutation = useMutation({
    mutationFn: (body: { rewardId: string; userNote?: string }) => rewardsApi.redeem(body),
    onSuccess: (res) => {
      setError(null);
      setSuccessMsg(`Đổi ưu đãi thành công · Còn ${res.remainingBalance} Credit.`);
      setSelectedReward(null);
      setRedeemNote('');
      invalidateAllWalletQueries();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const copyText = (key: string, value: string) => {
    void navigator.clipboard?.writeText(value);
    setCopiedToken(key);
    window.setTimeout(() => {
      setCopiedToken((curr) => (curr === key ? null : curr));
    }, 1800);
  };

  // Derived wallet values
  const balance = wallet?.balance ?? 0;
  const purchasedCredits = wallet?.purchasedCredits ?? 0;
  const earnedCredits = wallet?.earnedCredits ?? 0;
  const promoCredits = wallet?.promoCredits ?? 0;
  const lockedCredits = wallet?.lockedCredits ?? 0;
  const transferableCredits = purchasedCredits + earnedCredits;

  // Derived top-up selection summary
  const cleanCustomDigits = customVnd.replace(/\D/g, '');
  const hasCustomInput = cleanCustomDigits.length > 0;
  const customAmountNum = hasCustomInput ? Number.parseInt(cleanCustomDigits, 10) : 0;
  const customValidationError = hasCustomInput
    ? customAmountNum < 10_000
      ? 'Số tiền nạp tối thiểu 10.000 ₫.'
      : customAmountNum > 50_000_000
        ? 'Số tiền nạp tối đa 50.000.000 ₫ mỗi lần.'
        : customAmountNum % vndPerCredit !== 0
          ? `Số tiền phải là bội số của ${vndPerCredit.toLocaleString('vi-VN')} ₫.`
          : null
    : null;

  const selectedPackage = hasCustomInput
    ? null
    : packages.find((p) => p.id === selectedPackageId) ?? packages[0] ?? null;

  const summaryAmountVnd = hasCustomInput
    ? customAmountNum
    : selectedPackage?.amountVnd ?? 0;
  const summaryCredits = hasCustomInput
    ? customValidationError
      ? 0
      : Math.floor(customAmountNum / Math.max(1, vndPerCredit))
    : selectedPackage?.credits ?? 0;
  const summaryBonus = hasCustomInput ? 0 : selectedPackage?.bonusCredits ?? 0;

  const canCreateTopupOrder = hasCustomInput
    ? !customValidationError && customAmountNum >= 10_000
    : Boolean(selectedPackage);

  const handleCreateTopupOrder = () => {
    if (!canCreateTopupOrder || createOrderMutation.isPending) return;
    setError(null);
    if (hasCustomInput) {
      createOrderMutation.mutate({ amountVnd: customAmountNum });
      return;
    }
    if (selectedPackage) {
      createOrderMutation.mutate({ packageId: selectedPackage.id });
    }
  };

  const resolveRecreateInputForOrder = (ord: PaymentOrderItem | null): TopupOrderInput => {
    if (lastTopupInput) return lastTopupInput;
    if (ord) {
      const matchedPkg = packages.find(
        (p) => p.amountVnd === ord.amountVnd && p.credits === ord.creditsToGrant,
      );
      if (matchedPkg) return { packageId: matchedPkg.id };
      return { amountVnd: ord.amountVnd };
    }
    return { packageId: packages[0]?.id ?? 'pkg_50k' };
  };

  const receiveCode =
    receiveData?.receiveCode ||
    wallet?.receiveCode ||
    (user ? `NL-${user.username.toUpperCase()}` : 'NL-USER');

  const linkedBankBin = receiveData?.bankProfile?.bankBin || wallet?.bankBin || null;
  const linkedBankName = receiveData?.bankProfile?.bankName || wallet?.bankName || null;
  const linkedBankAccountNo =
    receiveData?.bankProfile?.bankAccountNo || wallet?.bankAccountNo || null;
  const linkedBankAccountName =
    receiveData?.bankProfile?.bankAccountName || wallet?.bankAccountName || null;
  const hasLinkedBank = Boolean(linkedBankBin && linkedBankAccountNo && linkedBankAccountName);

  const openWithdrawModal = () => {
    setError(null);
    setWithdrawStep(hasLinkedBank ? 'payout' : 'bank');
    setWithdrawModalOpen(true);
  };

  const payouts = payoutsData?.payouts ?? [];
  const catalogItems = catalogData?.items ?? [];
  const redemptions = redemptionsData?.redemptions ?? [];

  const handleSaveBankProfile = (e: FormEvent) => {
    e.preventDefault();
    const chosenBank = SUPPORTED_BANKS.find((b) => b.bin === bankBin) ?? SUPPORTED_BANKS[0];
    const cleanAccNo = bankAccountNo.trim();
    const cleanAccName = bankAccountName.trim().toUpperCase();
    if (!cleanAccNo || !cleanAccName) {
      setError('Nhập đầy đủ số tài khoản và tên chủ tài khoản.');
      return;
    }
    updateBankMutation.mutate({
      bankBin: chosenBank.bin,
      bankName: chosenBank.name,
      bankAccountNo: cleanAccNo,
      bankAccountName: cleanAccName,
    });
  };

  const handleTransferSubmit = (e: FormEvent) => {
    e.preventDefault();
    const target = recipientInput.trim().replace(/^@/, '');
    const amt = Number.parseInt(transferAmount, 10);
    if (!target) {
      setError('Nhập username hoặc mã NL-... người nhận.');
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Số Credit chuyển phải lớn hơn 0.');
      return;
    }
    transferMutation.mutate({
      recipientCodeOrUsername: target,
      amountCredits: amt,
      note: transferNote.trim() || undefined,
      idempotencyKey: transferIdempKey,
    });
  };

  const handlePayoutSubmit = (e: FormEvent) => {
    e.preventDefault();
    const amt = Number.parseInt(payoutAmount, 10);
    if (!Number.isFinite(amt) || amt < 50) {
      setError('Rút tối thiểu 50 Credit thu nhập.');
      return;
    }
    payoutMutation.mutate({
      amountCredits: amt,
      note: payoutNote.trim() || undefined,
      idempotencyKey: payoutIdempKey,
    });
  };

  const payoutCreditsPreview = Math.max(0, Number.parseInt(payoutAmount || '0', 10) || 0);
  const pendingBannerRemaining = activePendingOrder
    ? computeRemainingSeconds(activePendingOrder.expiresAt, clockOffsetMs)
    : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Compact Hero Balance Card */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4 tabular-nums">
          <div className="space-y-1">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#111827]">
              Ví Credit
            </h1>
            <span className="text-xs font-medium text-[#6B7280] block">Số dư khả dụng</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-[#16A34A]">
                {loadingWallet ? '...' : balance.toLocaleString('vi-VN')}
              </span>
              <span className="text-sm font-semibold text-[#111827]">Credit</span>
            </div>
            <p className="text-xs text-[#6B7280] pt-0.5">
              Nạp: {purchasedCredits.toLocaleString('vi-VN')} · Thu nhập:{' '}
              {earnedCredits.toLocaleString('vi-VN')} · Ưu đãi:{' '}
              {promoCredits.toLocaleString('vi-VN')}
              {lockedCredits > 0 ? ` · Tạm giữ: ${lockedCredits.toLocaleString('vi-VN')}` : ''}
            </p>
          </div>
        </div>
      </Card>

      {error && (
        <div
          role="alert"
          className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm rounded-xl flex items-center justify-between gap-2"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs font-semibold underline shrink-0"
          >
            Đóng
          </button>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="p-3.5 bg-[#ECFDF3] border border-[#BBF7D0] text-[#15803D] text-xs sm:text-sm rounded-xl flex items-center justify-between gap-2"
        >
          <span>{successMsg}</span>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-xs font-semibold underline shrink-0"
          >
            Đóng
          </button>
        </div>
      )}

      {/* 4 Clean Vietnamese Tabs */}
      <div className="flex flex-wrap items-center gap-4 sm:gap-6 border-b border-[#DCE6DF]">
        {(
          [
            { key: 'topup', label: 'Nạp Credit', icon: PlusCircle },
            { key: 'transfer', label: 'Chuyển & Nhận', icon: ArrowLeftRight },
            { key: 'redeem', label: 'Ưu đãi', icon: Gift },
            { key: 'history', label: 'Lịch sử', icon: History },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => selectTab(key)}
            className={`flex items-center gap-1.5 border-b-2 pb-2.5 text-xs sm:text-sm transition-colors whitespace-nowrap ${
              activeTab === key
                ? 'border-[#16A34A] font-bold text-[#15803D]'
                : 'border-transparent font-medium text-[#6B7280] hover:text-[#15803D]'
            }`}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: Nạp Credit */}
      {activeTab === 'topup' && (
        <div className="space-y-4">
          {activePendingOrder && pendingBannerRemaining > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-amber-900 tabular-nums">
                <Clock className="size-4 text-amber-700 shrink-0" aria-hidden />
                <span>
                  Đang chờ thanh toán đơn{' '}
                  <strong className="font-mono">#{activePendingOrder.orderCode}</strong> · Còn{' '}
                  <strong className="font-mono">{formatCountdown(pendingBannerRemaining)}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  loading={cancelOrderMutation.isPending}
                  onClick={() => cancelOrderMutation.mutate(activePendingOrder.orderCode)}
                >
                  Hủy đơn
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="primary"
                  icon={<QrCode className="size-3.5" aria-hidden />}
                  onClick={() => {
                    setSelectedOrderCode(activePendingOrder.orderCode);
                    setQrPopupOpen(true);
                  }}
                >
                  Mở mã QR
                </Button>
              </div>
            </div>
          )}

          <Card className="p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#111827]">Chọn gói nạp VietQR</h2>
              <span className="text-xs text-[#6B7280] tabular-nums">
                Tỷ giá: {vndPerCredit.toLocaleString('vi-VN')} ₫ = 1 Credit
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {packages.map((pkg) => {
                const isSelected = !hasCustomInput && selectedPackage?.id === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    disabled={createOrderMutation.isPending}
                    onClick={() => {
                      setError(null);
                      setCustomVnd('');
                      setSelectedPackageId(pkg.id);
                    }}
                    className={`rounded-xl border p-3.5 text-left transition-colors flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'border-[#16A34A] bg-[#ECFDF3] ring-2 ring-[#16A34A]/20'
                        : 'border-[#DCE6DF] bg-white hover:border-[#86EFAC] hover:bg-[#F5FAF7]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-bold text-[#111827] tabular-nums">
                        {pkg.amountVnd.toLocaleString('vi-VN')} ₫
                      </span>
                      {pkg.bonusCredits > 0 && (
                        <span className="rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[10px] font-bold text-[#15803D] tabular-nums">
                          +{pkg.bonusCredits}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-[#16A34A] tabular-nums">
                      Nhận {pkg.credits.toLocaleString('vi-VN')} Credit
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom VND amount */}
            <div className="space-y-1.5 pt-2 border-t border-[#DCE6DF]">
              <label htmlFor="custom-topup-vnd" className="block text-xs font-semibold text-[#111827]">
                Hoặc nhập số tiền tùy chọn (bội số {vndPerCredit.toLocaleString('vi-VN')} ₫)
              </label>
              <Input
                id="custom-topup-vnd"
                type="number"
                min={10000}
                max={50000000}
                step={vndPerCredit}
                value={customVnd}
                invalid={Boolean(customValidationError)}
                onChange={(e) => {
                  setError(null);
                  setCustomVnd(e.target.value);
                }}
                placeholder="Ví dụ: 150000"
                className="w-full sm:w-72 text-xs sm:text-sm tabular-nums"
              />
              {customValidationError && (
                <p className="text-xs text-red-600" role="alert">
                  {customValidationError}
                </p>
              )}
            </div>

            {/* Compact Summary Bar + Direct QR Creation Button */}
            <div className="rounded-xl border border-[#DCE6DF] bg-[#F5FAF7] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm tabular-nums">
                <div>
                  <span className="text-[#6B7280] block text-[11px]">Số tiền</span>
                  <span className="font-bold text-[#111827]">
                    {summaryAmountVnd > 0 ? `${summaryAmountVnd.toLocaleString('vi-VN')} ₫` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[#6B7280] block text-[11px]">Nhận được</span>
                  <span className="font-bold text-[#15803D]">
                    {summaryCredits > 0 ? `+${summaryCredits.toLocaleString('vi-VN')} Credit` : '—'}
                    {summaryBonus > 0 ? ` (+${summaryBonus} thưởng)` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-[#6B7280] block text-[11px]">Hiệu lực mã QR</span>
                  <span className="font-semibold text-[#111827]">
                    {formatTtlDurationLabel(orderTtlSeconds)}
                  </span>
                </div>
              </div>

              <Button
                type="button"
                size="md"
                variant="primary"
                loading={createOrderMutation.isPending}
                disabled={!canCreateTopupOrder}
                icon={<QrCode className="size-4" aria-hidden />}
                onClick={handleCreateTopupOrder}
              >
                Tạo mã QR thanh toán
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Clean VietQR Payment Modal */}
      {qrPopupOpen && activeOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Thanh toán VietQR đơn ${activeOrder.orderCode}`}
          onClick={() => {
            if (!document.querySelector('[role="alertdialog"]')) {
              setQrPopupOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-3xl max-h-[92vh] overflow-y-auto overflow-x-hidden rounded-2xl border border-[#DCE6DF] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#DCE6DF] bg-white px-5 py-3.5">
              <span className="text-sm font-bold text-[#111827]">Thanh toán nạp Credit</span>
              <button
                type="button"
                aria-label="Đóng cửa sổ thanh toán"
                onClick={() => setQrPopupOpen(false)}
                className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] transition-colors"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="p-5 sm:p-6">
              <EmbeddedQrCode
                order={activeOrder}
                serverNow={effectiveServerNow}
                orderTtlSeconds={orderTtlSeconds}
                reminderWindowSeconds={reminderWindowSeconds}
                sandboxEnabled={sandboxEnabled}
                creatingNewOrder={createOrderMutation.isPending}
                fallbackBankInfo={packagesData?.bankInfo}
                onOrderUpdated={(updatedOrder, nextServerNow) => {
                  if (nextServerNow) setLatestServerNow(nextServerNow);
                  setLatestCreatedOrder((prev) =>
                    prev?.orderCode === updatedOrder.orderCode ? updatedOrder : prev,
                  );
                }}
                onPaid={(paidOrder) => {
                  setSuccessMsg(
                    `Thanh toán thành công đơn ${paidOrder.orderCode} · Đã cộng +${paidOrder.creditsToGrant.toLocaleString('vi-VN')} Credit.`,
                  );
                  invalidateAllWalletQueries();
                }}
                onCreateNewOrder={() => {
                  const recreateInput = resolveRecreateInputForOrder(activeOrder);
                  createOrderMutation.mutate(recreateInput);
                }}
                onClose={() => setQrPopupOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Chuyển & Nhận */}
      {activeTab === 'transfer' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Block 1: Chuyển Credit nhanh */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-[#DCE6DF] pb-3">
              <div className="flex items-center gap-2">
                <Send className="size-4 text-[#16A34A]" aria-hidden />
                <h2 className="text-sm font-bold text-[#111827]">Chuyển Credit nhanh</h2>
              </div>
              <span className="text-xs font-semibold text-[#15803D] tabular-nums">
                Khả dụng: {transferableCredits.toLocaleString('vi-VN')} Credit
              </span>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="transfer-recipient"
                  className="block text-xs font-semibold text-[#111827] mb-1"
                >
                  Người nhận (username hoặc mã NL-...)
                </label>
                <Input
                  id="transfer-recipient"
                  value={recipientInput}
                  onChange={(e) => {
                    setRecipientInput(e.target.value);
                    setTransferIdempKey(makeIdempotencyKey());
                  }}
                  placeholder="bs.minh hoặc NL-..."
                  className="text-xs sm:text-sm"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="transfer-amount" className="text-xs font-semibold text-[#111827]">
                    Số Credit chuyển
                  </label>
                  <div className="flex items-center gap-1">
                    {[10, 25, 50, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setTransferAmount(String(preset));
                          setTransferIdempKey(makeIdempotencyKey());
                        }}
                        className="rounded border border-[#DCE6DF] bg-[#F5FAF7] px-2 py-0.5 text-[11px] font-semibold text-[#15803D] hover:bg-[#ECFDF3]"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <Input
                  id="transfer-amount"
                  type="number"
                  min={1}
                  value={transferAmount}
                  onChange={(e) => {
                    setTransferAmount(e.target.value);
                    setTransferIdempKey(makeIdempotencyKey());
                  }}
                  className="text-xs sm:text-sm tabular-nums"
                />
              </div>

              <div>
                <label
                  htmlFor="transfer-note"
                  className="block text-xs font-semibold text-[#111827] mb-1"
                >
                  Lời nhắn ngắn
                </label>
                <Input
                  id="transfer-note"
                  maxLength={140}
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="Cảm ơn bác sĩ tư vấn ca EEG..."
                  className="text-xs sm:text-sm"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-[#6B7280]">
                  Trừ từ Credit nạp &amp; thu nhập
                </span>
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  loading={transferMutation.isPending}
                  icon={<Send className="size-3.5" aria-hidden />}
                >
                  Chuyển ngay
                </Button>
              </div>
            </form>
          </Card>

          {/* Block 2: Nhận & Rút tiền */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#DCE6DF] pb-3">
              <Landmark className="size-4 text-[#16A34A]" aria-hidden />
              <h2 className="text-sm font-bold text-[#111827]">Nhận &amp; Rút tiền</h2>
            </div>

            {/* Mã nhận Credit duy nhất + 1 nút Sao chép */}
            <div className="rounded-xl border border-[#DCE6DF] bg-[#F5FAF7] p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs text-[#6B7280] block">Mã nhận Credit của bạn</span>
                <span className="mt-0.5 font-mono text-base font-bold text-[#111827] select-all block truncate">
                  {receiveCode}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => copyText('receiveCode', receiveCode)}
                icon={
                  copiedToken === 'receiveCode' ? (
                    <Check className="size-3.5" aria-hidden />
                  ) : (
                    <Copy className="size-3.5" aria-hidden />
                  )
                }
                className="shrink-0"
              >
                {copiedToken === 'receiveCode' ? 'Đã chép' : 'Sao chép'}
              </Button>
            </div>

            {/* Số dư thu nhập rút được + 1 nút mở modal tuần tự */}
            <div className="rounded-xl border border-[#DCE6DF] bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs text-[#6B7280] block">Thu nhập rút được</span>
                  <span className="text-lg font-bold text-[#15803D] tabular-nums">
                    {earnedCredits.toLocaleString('vi-VN')} Credit
                  </span>
                </div>
                <span className="text-xs text-[#6B7280] text-right">
                  {hasLinkedBank ? `${linkedBankName} · ${linkedBankAccountNo}` : 'Chưa liên kết TK'}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#DCE6DF]">
                <span className="text-[11px] text-[#6B7280]">
                  {earnedCredits < 50
                    ? 'Cần tối thiểu 50 Credit thu nhập để rút VNĐ'
                    : `Quy đổi ${(earnedCredits * vndPerCredit).toLocaleString('vi-VN')} ₫`}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={openWithdrawModal}
                  icon={<Building2 className="size-3.5" aria-hidden />}
                >
                  Rút về ngân hàng / Liên kết TK
                </Button>
              </div>
            </div>

            {payouts.length > 0 && (
              <div className="pt-2 border-t border-[#DCE6DF] space-y-2">
                <span className="text-xs font-semibold text-[#111827] block">
                  Lịch sử rút tiền ({payouts.length})
                </span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {payouts.map((p) => {
                    const meta = PAYOUT_STATUS_META[p.status] ?? PAYOUT_STATUS_META.PENDING;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] px-3 py-2 text-xs tabular-nums"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-[#111827]">
                            {p.amountCredits} Credit → {p.amountVnd.toLocaleString('vi-VN')} ₫
                          </span>
                          <span className="block text-[11px] text-[#6B7280] truncate">
                            {p.bankName} · {p.bankAccountNo}
                          </span>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0 ${meta.className}`}
                        >
                          {meta.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          {/* Sequential Bank Link -> Withdraw Pop-up Modal */}
          {withdrawModalOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Rút tiền về ngân hàng"
              onClick={() => {
                setError(null);
                setWithdrawModalOpen(false);
              }}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-[#DCE6DF] bg-white shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3 border-b border-[#DCE6DF] px-5 py-3.5">
                  <div>
                    <h3 className="text-sm font-bold text-[#111827]">
                      {withdrawStep === 'bank'
                        ? 'Bước 1/2 · Liên kết ngân hàng'
                        : 'Bước 2/2 · Rút về ngân hàng'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    aria-label="Đóng cửa sổ rút tiền"
                    onClick={() => {
                      setError(null);
                      setWithdrawModalOpen(false);
                    }}
                    className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] transition-colors"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  {/* Step indicator */}
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`flex-1 rounded-lg border px-2.5 py-1.5 text-center font-semibold ${
                        withdrawStep === 'bank'
                          ? 'border-[#16A34A] bg-[#ECFDF3] text-[#15803D]'
                          : 'border-[#DCE6DF] bg-[#F5FAF7] text-[#6B7280]'
                      }`}
                    >
                      1. Tài khoản NH
                    </span>
                    <span
                      className={`flex-1 rounded-lg border px-2.5 py-1.5 text-center font-semibold ${
                        withdrawStep === 'payout'
                          ? 'border-[#16A34A] bg-[#ECFDF3] text-[#15803D]'
                          : 'border-[#DCE6DF] bg-[#F5FAF7] text-[#6B7280]'
                      }`}
                    >
                      2. Nhập số tiền rút
                    </span>
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
                    >
                      {error}
                    </div>
                  )}

                  {withdrawStep === 'bank' ? (
                    <form onSubmit={handleSaveBankProfile} className="space-y-3">
                      <div>
                        <label
                          htmlFor="bank-bin-select"
                          className="block text-xs font-semibold text-[#111827] mb-1"
                        >
                          Ngân hàng
                        </label>
                        <select
                          id="bank-bin-select"
                          value={bankBin}
                          onChange={(e) => setBankBin(e.target.value)}
                          className="w-full h-9.5 rounded-lg border border-[#DCE6DF] bg-white px-3 text-xs sm:text-sm text-[#111827] focus:border-[#16A34A] focus:outline-none"
                        >
                          {SUPPORTED_BANKS.map((b) => (
                            <option key={b.bin} value={b.bin}>
                              {b.name} (BIN {b.bin})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="bank-acc-no"
                          className="block text-xs font-semibold text-[#111827] mb-1"
                        >
                          Số tài khoản
                        </label>
                        <Input
                          id="bank-acc-no"
                          value={bankAccountNo}
                          onChange={(e) => setBankAccountNo(e.target.value)}
                          placeholder="0888999777"
                          className="text-xs sm:text-sm"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="bank-acc-name"
                          className="block text-xs font-semibold text-[#111827] mb-1"
                        >
                          Tên chủ tài khoản
                        </label>
                        <Input
                          id="bank-acc-name"
                          value={bankAccountName}
                          onChange={(e) => setBankAccountName(e.target.value.toUpperCase())}
                          placeholder="NGUYEN VAN A"
                          className="text-xs sm:text-sm uppercase"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DCE6DF]">
                        {hasLinkedBank && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setError(null);
                              setWithdrawStep('payout');
                            }}
                          >
                            Sang bước 2
                          </Button>
                        )}
                        <Button
                          type="submit"
                          size="sm"
                          variant="primary"
                          loading={updateBankMutation.isPending}
                        >
                          Lưu &amp; Tiếp tục
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handlePayoutSubmit} className="space-y-3">
                      <div className="rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] px-3 py-2.5 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <span className="font-semibold text-[#111827] block truncate">
                            {linkedBankName} · {linkedBankAccountNo}
                          </span>
                          <span className="text-[11px] text-[#6B7280] truncate block">
                            {linkedBankAccountName}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setWithdrawStep('bank');
                          }}
                          className="text-xs font-semibold text-[#16A34A] hover:underline shrink-0"
                        >
                          Đổi TK
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label
                            htmlFor="payout-amount"
                            className="block text-xs font-semibold text-[#111827] mb-1"
                          >
                            Số Credit rút (tối thiểu 50)
                          </label>
                          <Input
                            id="payout-amount"
                            type="number"
                            min={50}
                            value={payoutAmount}
                            onChange={(e) => {
                              setPayoutAmount(e.target.value);
                              setPayoutIdempKey(makeIdempotencyKey());
                            }}
                            className="text-xs sm:text-sm tabular-nums"
                          />
                        </div>
                        <div className="rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] px-3 py-2 flex flex-col justify-center">
                          <span className="text-[11px] text-[#6B7280]">Quy đổi nhận về</span>
                          <span className="font-mono text-sm font-bold text-[#15803D] tabular-nums">
                            {(payoutCreditsPreview * vndPerCredit).toLocaleString('vi-VN')} ₫
                          </span>
                        </div>
                      </div>

                      <Input
                        value={payoutNote}
                        onChange={(e) => {
                          setPayoutNote(e.target.value);
                          setPayoutIdempKey(makeIdempotencyKey());
                        }}
                        maxLength={140}
                        placeholder="Ghi chú đối soát (tùy chọn)..."
                        aria-label="Ghi chú rút tiền"
                        className="text-xs"
                      />

                      {earnedCredits < 50 && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          Số dư thu nhập hiện có ({earnedCredits} Credit) chưa đạt mức tối thiểu 50 Credit để rút.
                        </p>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DCE6DF]">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setError(null);
                            setWithdrawModalOpen(false);
                          }}
                        >
                          Đóng
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          variant="primary"
                          loading={payoutMutation.isPending}
                          disabled={earnedCredits < 50}
                        >
                          Gửi lệnh rút
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Ưu đãi */}
      {activeTab === 'redeem' && (
        <div className="space-y-5">
          {loadingCatalog ? (
            <Spinner label="Đang tải danh mục ưu đãi..." />
          ) : catalogItems.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Gift className="size-7 text-[#16A34A]" />}
                title="Chưa có ưu đãi nào"
                description="Danh mục ưu đãi sẽ sớm được cập nhật."
              />
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {catalogItems.map((item) => {
                const catConfig = REWARD_CATEGORY_CONFIG[item.category];
                const IconComponent = catConfig?.icon ?? Gift;
                const canAfford = balance >= item.creditCost;
                const isOutOfStock =
                  item.stockQuantity !== null && item.redeemedCount >= item.stockQuantity;
                const isLockedMonetary = item.isMonetary && !item.payoutEnabled;

                return (
                  <Card
                    key={item.id}
                    className="p-5 flex flex-col justify-between space-y-4 hover:border-[#86EFAC] transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#15803D]">
                          <IconComponent className="size-3.5" aria-hidden /> {catConfig?.label}
                        </span>
                        <span className="font-bold text-xs text-[#15803D] tabular-nums shrink-0">
                          {item.creditCost} Credit
                        </span>
                      </div>

                      <div>
                        <h3 className="font-semibold text-sm text-[#111827] leading-snug">
                          {item.name}
                        </h3>
                        <p className="text-xs text-[#6B7280] mt-1 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#DCE6DF] flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[#6B7280] tabular-nums">
                        {item.stockQuantity === null
                          ? 'Không giới hạn'
                          : `Còn ${Math.max(0, item.stockQuantity - item.redeemedCount)}/${item.stockQuantity} suất`}
                      </span>

                      {isLockedMonetary ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6B7280]">
                          <Lock className="size-3" aria-hidden /> Dùng mục Rút về ngân hàng
                        </span>
                      ) : isOutOfStock ? (
                        <span className="text-[11px] font-semibold text-red-700">Hết suất</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={!canAfford}
                          onClick={() => {
                            setError(null);
                            setSelectedReward(item);
                          }}
                        >
                          {canAfford ? 'Đổi ngay' : 'Chưa đủ Credit'}
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {redemptions.length > 0 && (
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold text-sm text-[#111827]">
                Ưu đãi đã đổi ({redemptions.length})
              </h3>
              <div className="space-y-2">
                {redemptions.map((redemption) => {
                  const statusMeta = REDEMPTION_STATUS_META[redemption.status];
                  return (
                    <div
                      key={redemption.id}
                      className="rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] p-3 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <p className="font-semibold text-xs sm:text-sm text-[#111827]">
                          {redemption.reward.name}
                        </p>
                        <p className="text-[11px] text-[#6B7280] tabular-nums">
                          {new Date(redemption.createdAt).toLocaleString('vi-VN')} ·{' '}
                          {redemption.creditCost} Credit
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusMeta.className}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {selectedReward && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              role="dialog"
              aria-modal="true"
              aria-label={`Xác nhận đổi ${selectedReward.name}`}
              onClick={() => setSelectedReward(null)}
            >
              <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <Card className="w-full p-5 space-y-4 shadow-xl">
                <div className="flex items-start justify-between gap-3 border-b border-[#DCE6DF] pb-3">
                  <h3 className="font-bold text-base text-[#111827]">Xác nhận đổi ưu đãi</h3>
                  <span className="font-bold text-xs text-[#15803D] bg-[#EFF6F1] border border-[#DCE6DF] px-2.5 py-0.5 rounded-full tabular-nums">
                    -{selectedReward.creditCost} Credit
                  </span>
                </div>

                <div className="space-y-1.5 text-xs bg-[#F5FAF7] p-3.5 rounded-xl border border-[#DCE6DF]">
                  <p className="font-semibold text-[#111827]">{selectedReward.name}</p>
                  <p className="text-[#6B7280] line-clamp-2">{selectedReward.description}</p>
                  <div className="flex justify-between pt-2 border-t border-[#DCE6DF] text-[#6B7280] text-[11px] tabular-nums">
                    <span>Hiện có: {balance} Credit</span>
                    <span className="font-semibold text-[#15803D]">
                      Còn lại: {balance - selectedReward.creditCost} Credit
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="reward-redeem-note"
                    className="text-xs font-semibold text-[#111827] block"
                  >
                    Thông tin nhận ưu đãi
                  </label>
                  <Textarea
                    id="reward-redeem-note"
                    rows={3}
                    value={redeemNote}
                    onChange={(e) => setRedeemNote(e.target.value)}
                    placeholder="Email hoặc ghi chú nhận mã ưu đãi..."
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DCE6DF]">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedReward(null)}>
                    Hủy
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    loading={redeemMutation.isPending}
                    onClick={() =>
                      redeemMutation.mutate({
                        rewardId: selectedReward.id,
                        userNote: redeemNote.trim() || undefined,
                      })
                    }
                    icon={<Gift className="size-4" aria-hidden />}
                  >
                    Đổi ngay
                  </Button>
                </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Lịch sử */}
      {activeTab === 'history' && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-[#DCE6DF] bg-[#F5FAF7] flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold text-xs sm:text-sm text-[#111827]">Lịch sử hoạt động ví</h2>

            <div
              className="inline-flex rounded-lg border border-[#DCE6DF] bg-white p-0.5 text-xs"
              role="tablist"
              aria-label="Bộ lọc lịch sử"
            >
              <button
                type="button"
                role="tab"
                aria-selected={historyFilter === 'transactions'}
                onClick={() => setHistoryFilter('transactions')}
                className={`rounded-md px-3 py-1 font-semibold transition-colors ${
                  historyFilter === 'transactions'
                    ? 'bg-[#16A34A] text-white'
                    : 'text-[#6B7280] hover:text-[#111827]'
                }`}
              >
                Giao dịch ví
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={historyFilter === 'topups'}
                onClick={() => setHistoryFilter('topups')}
                className={`rounded-md px-3 py-1 font-semibold transition-colors ${
                  historyFilter === 'topups'
                    ? 'bg-[#16A34A] text-white'
                    : 'text-[#6B7280] hover:text-[#111827]'
                }`}
              >
                Đơn nạp QR
              </button>
            </div>
          </div>

          {historyFilter === 'transactions' ? (
            loadingWallet ? (
              <Spinner label="Đang tải giao dịch ví..." />
            ) : transactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#6B7280]">Chưa có giao dịch nào.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs tabular-nums">
                  <thead className="bg-[#F5FAF7] text-[#6B7280] border-b border-[#DCE6DF]">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Loại</th>
                      <th className="py-2.5 px-4 font-semibold">Nội dung</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Biến động</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Số dư sau</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE6DF]">
                    {transactions.map((tx) => {
                      const isPositive = tx.amount > 0;
                      const typeMeta = TRANSACTION_TYPE_LABELS[tx.type] ?? {
                        label: tx.type,
                        className: 'bg-[#F5FAF7] text-[#262624] border-[#DCE6DF]',
                      };
                      const bucketLabel = tx.bucket ? (BUCKET_LABELS[tx.bucket] ?? null) : null;

                      return (
                        <tr key={tx.id} className="hover:bg-[#F5FAF7]/60">
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${typeMeta.className}`}
                            >
                              {typeMeta.label}
                            </span>
                            <span className="block text-[10px] text-[#6B7280] mt-0.5">
                              {new Date(tx.createdAt).toLocaleString('vi-VN')}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-[#111827] font-medium">
                            {formatTxDescription(tx.description, tx.type)}
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap font-mono font-bold">
                            <span className={isPositive ? 'text-[#16A34A]' : 'text-red-600'}>
                              {isPositive ? `+${tx.amount}` : tx.amount} Credit
                            </span>
                            {bucketLabel && (
                              <span className="block text-[10px] font-sans font-normal text-[#6B7280]">
                                {bucketLabel}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap font-mono font-semibold text-[#111827]">
                            {tx.balanceAfter !== undefined && tx.balanceAfter !== null
                              ? `${tx.balanceAfter} Credit`
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : loadingOrders ? (
            <Spinner label="Đang tải danh sách đơn nạp QR..." />
          ) : mergedOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#6B7280] space-y-2">
              <p>Chưa có đơn nạp QR nào.</p>
              <Button type="button" size="xs" variant="secondary" onClick={() => selectTab('topup')}>
                Nạp Credit ngay
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs tabular-nums">
                <thead className="border-b border-[#DCE6DF] bg-[#F5FAF7] text-[#6B7280]">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Mã đơn</th>
                    <th className="py-2.5 px-4 font-semibold">Số tiền</th>
                    <th className="py-2.5 px-4 font-semibold">Credit</th>
                    <th className="py-2.5 px-4 font-semibold">Trạng thái</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE6DF]">
                  {mergedOrders.map((ord) => {
                    const remaining =
                      ord.status === 'PENDING'
                        ? computeRemainingSeconds(ord.expiresAt, clockOffsetMs)
                        : 0;
                    const effectiveStatus =
                      ord.status === 'PENDING' && remaining <= 0 ? 'EXPIRED' : ord.status;

                    const statusBadge =
                      effectiveStatus === 'PAID'
                        ? {
                            label: 'Đã thanh toán',
                            className: 'bg-[#ECFDF3] text-[#15803D] border-[#86EFAC]',
                          }
                        : effectiveStatus === 'PENDING'
                          ? {
                              label: `Chờ thanh toán · ${formatCountdown(remaining)}`,
                              className: 'bg-amber-50 text-amber-800 border-amber-200',
                            }
                          : effectiveStatus === 'EXPIRED'
                            ? {
                                label: 'Hết hạn',
                                className: 'bg-[#F3F4F6] text-[#6B7280] border-[#D1D5DB]',
                              }
                            : {
                                label: 'Đã hủy',
                                className: 'bg-[#F3F4F6] text-[#6B7280] border-[#D1D5DB]',
                              };

                    return (
                      <tr key={ord.id} className="hover:bg-[#F5FAF7]/60">
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span className="font-mono font-semibold text-[#111827] block">
                            {ord.orderCode}
                          </span>
                          <span className="text-[10px] text-[#6B7280]">
                            {new Date(ord.createdAt).toLocaleString('vi-VN')}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-[#111827] whitespace-nowrap">
                          {ord.amountVnd.toLocaleString('vi-VN')} ₫
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-[#15803D] whitespace-nowrap">
                          +{ord.creditsToGrant.toLocaleString('vi-VN')} Credit
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadge.className}`}
                          >
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          {effectiveStatus === 'PENDING' ? (
                            <div className="inline-flex items-center gap-2.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedOrderCode(ord.orderCode);
                                  setQrPopupOpen(true);
                                }}
                                className="text-xs font-semibold text-[#16A34A] hover:text-[#15803D] hover:underline"
                              >
                                Mở lại QR
                              </button>
                              <button
                                type="button"
                                disabled={cancelOrderMutation.isPending}
                                onClick={() => cancelOrderMutation.mutate(ord.orderCode)}
                                className="text-xs font-medium text-[#6B7280] hover:text-[#111827] hover:underline disabled:opacity-50"
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOrderCode(ord.orderCode);
                                setQrPopupOpen(true);
                              }}
                              className="text-xs font-medium text-[#6B7280] hover:text-[#111827] hover:underline"
                            >
                              Chi tiết
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
