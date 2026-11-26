import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  ArrowRight,
  BookOpen,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
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
  PaymentOrderStatus,
  PayoutRequestStatus,
  RedemptionStatus,
  RewardCatalogItem,
  RewardCategory,
  TopupPackageItem,
} from '../api/types';
import { Button, Card, EmptyState, Input, Spinner, Textarea } from '../components/ui';
import { useAuth } from '../features/auth/AuthContext';
import { DeterministicQrMatrixSvg, EmbeddedQrCode } from '../features/wallet/EmbeddedQrCode';
import { assetUrl } from '../lib/assets';

type WalletTab = 'topup' | 'orders' | 'transfer' | 'catalog' | 'ledger';

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

const ORDER_STATUS_META: Record<PaymentOrderStatus, { label: string; className: string }> = {
  PENDING: { label: 'Chờ thanh toán', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  PAID: { label: 'Đã thanh toán', className: 'bg-[#ECFDF3] text-[#15803D] border-[#86EFAC]' },
  EXPIRED: { label: 'Hết hạn', className: 'bg-[#F5FAF7] text-[#6B7280] border-[#DCE6DF]' },
  CANCELLED: { label: 'Đã hủy', className: 'bg-red-50 text-red-700 border-red-200' },
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
  if (raw === 'orders' || raw === 'billing') return 'orders';
  if (raw === 'transfer') return 'transfer';
  if (raw === 'catalog') return 'catalog';
  if (raw === 'ledger' || raw === 'history') return 'ledger';
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

export function RewardsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = resolveTab(searchParams.get('tab'));
  const toParam = searchParams.get('to') ?? '';

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Top-up state
  const [selectedOrderCode, setSelectedOrderCode] = useState<string | null>(null);
  const [latestCreatedOrder, setLatestCreatedOrder] = useState<PaymentOrderItem | null>(null);
  const [qrPopupOpen, setQrPopupOpen] = useState(false);
  const [customVnd, setCustomVnd] = useState('');
  const [draftTopup, setDraftTopup] = useState<{
    packageId?: string;
    label: string;
    amountVnd: number;
    credits: number;
    bonusCredits: number;
  } | null>(null);

  // Receive & Bank link state
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankBin, setBankBin] = useState<string>(SUPPORTED_BANKS[0].bin);
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [vietQrReceiveImgFailed, setVietQrReceiveImgFailed] = useState(false);

  // P2P Transfer state
  const [recipientInput, setRecipientInput] = useState(toParam);
  const [transferAmount, setTransferAmount] = useState('25');
  const [transferNote, setTransferNote] = useState('');
  const [transferIdempKey, setTransferIdempKey] = useState(() => makeIdempotencyKey());

  // Bank Payout state
  const [payoutAmount, setPayoutAmount] = useState('50');
  const [payoutNote, setPayoutNote] = useState('');

  // Catalog Redemption state
  const [selectedReward, setSelectedReward] = useState<RewardCatalogItem | null>(null);
  const [redeemNote, setRedeemNote] = useState('');

  useEffect(() => {
    if (toParam) {
      setRecipientInput(toParam);
    }
  }, [toParam]);

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

  const { data: ordersData, isLoading: loadingOrders } = useQuery({
    queryKey: ['payments', 'topup-orders'],
    queryFn: () => paymentsApi.getTopupOrders(),
    enabled: Boolean(user && activeTab === 'topup'),
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
    enabled: activeTab === 'catalog',
  });

  const { data: redemptionsData } = useQuery({
    queryKey: ['rewards', 'my-redemptions'],
    queryFn: () => rewardsApi.getMyRedemptions(),
    enabled: Boolean(user && activeTab === 'catalog'),
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

  // Mutations
  const createOrderMutation = useMutation({
    mutationFn: (body: { packageId?: string; amountVnd?: number }) =>
      paymentsApi.createTopupOrder(body),
    onSuccess: (res) => {
      setError(null);
      setDraftTopup(null);
      setLatestCreatedOrder(res.order);
      setSelectedOrderCode(res.order.orderCode);
      setQrPopupOpen(true);
      void queryClient.invalidateQueries({ queryKey: ['payments', 'topup-orders'] });
    },
    onError: (err) => setError(errorMessage(err)),
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
      setVietQrReceiveImgFailed(false);
      setShowBankForm(false);
      setSuccessMsg('Đã liên kết tài khoản nhận VietQR.');
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
    mutationFn: (body: { amountCredits: number; note?: string }) => paymentsApi.requestPayout(body),
    onSuccess: (res) => {
      setError(null);
      setSuccessMsg(
        `Đã gửi lệnh rút ${res.payout.amountCredits} Credit (${res.payout.amountVnd.toLocaleString('vi-VN')} ₫).`,
      );
      setPayoutNote('');
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

  // Derived values with 100% resilient fallbacks
  const balance = wallet?.balance ?? 0;
  const purchasedCredits = wallet?.purchasedCredits ?? 0;
  const earnedCredits = wallet?.earnedCredits ?? 0;
  const promoCredits = wallet?.promoCredits ?? 0;
  const lockedCredits = wallet?.lockedCredits ?? 0;
  const transferableCredits = purchasedCredits + earnedCredits;

  const vndPerCredit = packagesData?.vndPerCredit ?? 1000;
  const packages = packagesData?.packages?.length ? packagesData.packages : FALLBACK_PACKAGES;
  const orders = ordersData?.orders ?? [];

  const activeOrder: PaymentOrderItem | null =
    (selectedOrderCode
      ? orders.find((o) => o.orderCode === selectedOrderCode) ??
        (latestCreatedOrder?.orderCode === selectedOrderCode ? latestCreatedOrder : null)
      : latestCreatedOrder ?? orders.find((o) => o.status === 'PENDING') ?? null) ?? null;

  const receiveCode =
    receiveData?.receiveCode ||
    wallet?.receiveCode ||
    (user ? `NL-${user.username.toUpperCase()}` : 'NL-USER');
  const receiveQrPayload = receiveData?.qrPayload || `NEUROLINK_PAY:${receiveCode}`;

  const linkedBankBin = receiveData?.bankProfile?.bankBin || wallet?.bankBin || null;
  const linkedBankName = receiveData?.bankProfile?.bankName || wallet?.bankName || null;
  const linkedBankAccountNo =
    receiveData?.bankProfile?.bankAccountNo || wallet?.bankAccountNo || null;
  const linkedBankAccountName =
    receiveData?.bankProfile?.bankAccountName || wallet?.bankAccountName || null;
  const hasLinkedBank = Boolean(linkedBankBin && linkedBankAccountNo && linkedBankAccountName);

  const vietQrReceiveUrl =
    receiveData?.vietQrReceiveUrl ||
    (hasLinkedBank
      ? `https://img.vietqr.io/image/${linkedBankBin}-${linkedBankAccountNo}-compact2.png?addInfo=${encodeURIComponent(
          receiveCode,
        )}&accountName=${encodeURIComponent(linkedBankAccountName ?? '')}`
      : null);

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
    });
  };

  const handleCustomTopup = (e: FormEvent) => {
    e.preventDefault();
    const vnd = Number.parseInt(customVnd.replace(/\D/g, ''), 10);
    if (!Number.isFinite(vnd) || vnd < 10_000) {
      setError('Số tiền nạp tối thiểu 10.000 ₫.');
      return;
    }
    setError(null);
    const baseCredits = Math.max(1, Math.floor(vnd / Math.max(1, vndPerCredit)));
    setDraftTopup({
      label: `Nạp tùy chọn (${vnd.toLocaleString('vi-VN')} ₫)`,
      amountVnd: vnd,
      credits: baseCredits,
      bonusCredits: 0,
    });
  };

  const payoutCreditsPreview = Math.max(0, Number.parseInt(payoutAmount || '0', 10) || 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Top Wallet Summary Card */}
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#111827]">
              Ví Credit & Thanh toán
            </h1>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Nạp · Chuyển Credit · Lịch sử
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-[#DCE6DF] pt-4 tabular-nums">
          <div>
            <span className="text-xs font-medium text-[#6B7280] block">Tổng số dư ví</span>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-bold text-[#16A34A]">
                {loadingWallet ? '...' : balance.toLocaleString('vi-VN')}
              </span>
              <span className="text-sm font-semibold text-[#111827]">Credit</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] px-2.5 py-1 font-medium text-[#111827]">
              Nạp: <strong className="text-[#15803D]">{purchasedCredits.toLocaleString('vi-VN')}</strong>
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] px-2.5 py-1 font-medium text-[#111827]">
              Thu nhập: <strong className="text-[#15803D]">{earnedCredits.toLocaleString('vi-VN')}</strong>
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] px-2.5 py-1 font-medium text-[#111827]">
              Khuyến mãi: <strong>{promoCredits.toLocaleString('vi-VN')}</strong>
            </span>
            {lockedCredits > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-800">
                Tạm giữ: <strong>{lockedCredits.toLocaleString('vi-VN')}</strong>
              </span>
            )}
          </div>
        </div>
      </Card>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm rounded-xl flex items-center justify-between gap-2">
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
        <div className="p-3.5 bg-[#ECFDF3] border border-[#BBF7D0] text-[#15803D] text-xs sm:text-sm rounded-xl flex items-center justify-between gap-2">
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

      {/* 5 Clean Tabs — Only ONE view shown at a time */}
      <div className="flex flex-wrap items-center gap-4 sm:gap-6 border-b border-[#DCE6DF]">
        {(
          [
            { key: 'topup', label: 'Nạp Credit', icon: PlusCircle },
            { key: 'orders', label: 'Đơn nạp (Billing)', icon: QrCode },
            { key: 'transfer', label: 'Nhận & Chuyển', icon: ArrowLeftRight },
            { key: 'catalog', label: 'Đổi ưu đãi', icon: Gift },
            { key: 'ledger', label: 'Lịch sử giao dịch', icon: History },
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
        <div className="space-y-5">
          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#111827]">Chọn gói nạp VietQR</h2>
              <span className="text-xs text-[#6B7280] tabular-nums">
                Tỷ giá chuẩn: {vndPerCredit.toLocaleString('vi-VN')} ₫ / 1 Credit
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {packages.map((pkg) => {
                const isDraftSelected = draftTopup?.packageId === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    disabled={createOrderMutation.isPending}
                    onClick={() => {
                      setError(null);
                      setQrPopupOpen(false);
                      setDraftTopup({
                        packageId: pkg.id,
                        label: `Gói ${pkg.amountVnd.toLocaleString('vi-VN')}đ`,
                        amountVnd: pkg.amountVnd,
                        credits: pkg.credits,
                        bonusCredits: pkg.bonusCredits,
                      });
                    }}
                    className={`rounded-xl border p-3.5 text-left transition-colors flex flex-col justify-between gap-2 ${
                      isDraftSelected
                        ? 'border-[#16A34A] bg-[#ECFDF3] ring-2 ring-[#16A34A]/20'
                        : 'border-[#DCE6DF] bg-white hover:border-[#86EFAC] hover:bg-[#F5FAF7]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-bold text-[#111827] tabular-nums">
                        {pkg.amountVnd.toLocaleString('vi-VN')}đ
                      </span>
                      {pkg.bonusCredits > 0 && (
                        <span className="rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[10px] font-bold text-[#15803D] tabular-nums">
                          +{pkg.bonusCredits}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-[#16A34A] tabular-nums">
                      Nhận {pkg.credits} Credit
                    </div>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleCustomTopup} className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#DCE6DF]">
              <Input
                type="number"
                min={10000}
                step={1000}
                value={customVnd}
                onChange={(e) => setCustomVnd(e.target.value)}
                placeholder="Số tiền khác (từ 10.000đ)..."
                aria-label="Số tiền nạp tùy chọn"
                className="w-full sm:w-60 text-xs"
              />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={createOrderMutation.isPending}
                icon={<ArrowRight className="size-3.5" aria-hidden />}
              >
                Tiếp tục
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* Popup Wizard: Step 2 (Billing Confirm) -> Step 3 (VietQR) — Only ONE step visible at a time */}
          {(draftTopup || (qrPopupOpen && activeOrder)) && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
              role="dialog"
              aria-modal="true"
            >
              <div
                className={`w-full ${
                  draftTopup ? 'max-w-lg' : 'max-w-2xl'
                } max-h-[92vh] overflow-y-auto overflow-x-hidden rounded-2xl border border-[#DCE6DF] bg-white shadow-2xl`}
              >
                {/* Popup Header + Stepper */}
                <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#DCE6DF] bg-white px-5 py-3.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        draftTopup ? 'text-[#15803D]' : 'text-[#6B7280]'
                      }`}
                    >
                      <span
                        className={`inline-flex size-5 items-center justify-center rounded-full text-[11px] font-bold ${
                          draftTopup ? 'bg-[#16A34A] text-white' : 'bg-[#ECFDF3] text-[#15803D]'
                        }`}
                      >
                        1
                      </span>
                      Xác nhận Billing
                    </span>
                    <span className="text-[#9CA3AF]">→</span>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        !draftTopup && qrPopupOpen ? 'text-[#15803D]' : 'text-[#6B7280]'
                      }`}
                    >
                      <span
                        className={`inline-flex size-5 items-center justify-center rounded-full text-[11px] font-bold ${
                          !draftTopup && qrPopupOpen
                            ? 'bg-[#16A34A] text-white'
                            : 'bg-[#F3F4F6] text-[#6B7280]'
                        }`}
                      >
                        2
                      </span>
                      Thanh toán QR
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="Đóng cửa sổ nạp Credit"
                    disabled={createOrderMutation.isPending}
                    onClick={() => {
                      setDraftTopup(null);
                      setQrPopupOpen(false);
                    }}
                    className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] transition-colors"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>

                {/* Step 2: Billing Confirmation (Hides Step 1 background & Step 3) */}
                {draftTopup ? (
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-flex items-center rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-[11px] font-bold text-[#15803D]">
                          Hóa đơn chờ xác nhận
                        </span>
                        <h3 className="mt-1.5 text-base font-bold text-[#111827]">
                          Kiểm tra thông tin thanh toán
                        </h3>
                      </div>
                      <span className="font-mono text-lg font-bold text-[#111827] tabular-nums">
                        {draftTopup.amountVnd.toLocaleString('vi-VN')} ₫
                      </span>
                    </div>

                    <div className="rounded-xl border border-[#DCE6DF] bg-[#F5FAF7] p-4 space-y-2.5 text-xs sm:text-sm tabular-nums">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#6B7280]">Gói nạp đã chọn</span>
                        <span className="font-semibold text-[#111827]">{draftTopup.label}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#6B7280]">Credit cơ bản</span>
                        <span className="font-semibold text-[#111827]">
                          +{(draftTopup.credits - draftTopup.bonusCredits).toLocaleString('vi-VN')} Credit
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#6B7280]">Credit thưởng thêm</span>
                        <span className="font-semibold text-[#15803D]">
                          +{draftTopup.bonusCredits.toLocaleString('vi-VN')} Credit
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#6B7280]">Phương thức</span>
                        <span className="font-medium text-[#111827]">Chuyển khoản VietQR 24/7</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#6B7280]">Tài khoản thụ hưởng</span>
                        <span className="font-medium text-[#111827] text-right">
                          {packagesData?.bankInfo?.bankName ?? 'MB Bank'} ·{' '}
                          <span className="font-mono">
                            {packagesData?.bankInfo?.accountNo ?? '0888999777'}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-[#DCE6DF] pt-2.5">
                        <span className="font-bold text-[#111827]">Tổng Credit thực nhận</span>
                        <span className="font-mono text-base font-bold text-[#16A34A]">
                          +{draftTopup.credits.toLocaleString('vi-VN')} Credit
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-[#6B7280]">
                      Đơn nạp chỉ được tạo vào mục Đơn của tôi sau khi bạn bấm nút xác nhận bên dưới.
                    </p>

                    <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={createOrderMutation.isPending}
                        onClick={() => setDraftTopup(null)}
                      >
                        Chọn lại gói
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        loading={createOrderMutation.isPending}
                        icon={<QrCode className="size-4" aria-hidden />}
                        onClick={() =>
                          createOrderMutation.mutate(
                            draftTopup.packageId
                              ? { packageId: draftTopup.packageId }
                              : { amountVnd: draftTopup.amountVnd },
                          )
                        }
                      >
                        Xác nhận tạo đơn & lấy mã QR
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Step 3: VietQR Payment (Step 2 hidden) */
                  activeOrder && (
                    <div className="p-4">
                      <EmbeddedQrCode
                        orderCode={activeOrder.orderCode}
                        amountVnd={activeOrder.amountVnd}
                        creditsToGrant={activeOrder.creditsToGrant}
                        bonusCredits={activeOrder.bonusCredits}
                        status={activeOrder.status}
                        qrPayload={activeOrder.qrPayload}
                        vietQrImageUrl={activeOrder.vietQrImageUrl}
                        bankName={activeOrder.bankName ?? packagesData?.bankInfo?.bankName}
                        accountNo={activeOrder.accountNo ?? packagesData?.bankInfo?.accountNo}
                        accountName={activeOrder.accountName ?? packagesData?.bankInfo?.accountName}
                        expiresAt={activeOrder.expiresAt}
                        onPaid={() =>
                          setSuccessMsg(`Đã xác nhận thanh toán đơn ${activeOrder.orderCode} thành công!`)
                        }
                      />
                    </div>
                  )
                )}
              </div>
            </div>
          )}

      {/* TAB 2: Đơn nạp (Billing) */}
      {activeTab === 'orders' && (
        <div className="space-y-5">
          {/* Recent Top-Up Orders */}
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[#DCE6DF] bg-[#F5FAF7] flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold text-[#111827]">Đơn nạp gần đây</h3>
              <span className="text-[11px] text-[#6B7280] tabular-nums">{orders.length} đơn</span>
            </div>

            {loadingOrders ? (
              <Spinner label="Đang tải đơn nạp..." />
            ) : orders.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#6B7280]">
                Chọn mệnh giá bên trên để tạo mã VietQR nạp Credit.
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
                    {orders.map((ord) => {
                      const st = ORDER_STATUS_META[ord.status] ?? ORDER_STATUS_META.PENDING;
                      return (
                        <tr key={ord.id} className="hover:bg-[#F5FAF7]/60">
                          <td className="py-2.5 px-4 font-mono font-semibold text-[#111827]">
                            {ord.orderCode}
                          </td>
                          <td className="py-2.5 px-4 text-[#111827]">
                            {ord.amountVnd.toLocaleString('vi-VN')} ₫
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-[#15803D]">
                            +{ord.creditsToGrant} Credit
                          </td>
                          <td className="py-2.5 px-4">
                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${st.className}`}>
                              {st.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setDraftTopup(null);
                                setSelectedOrderCode(ord.orderCode);
                                setQrPopupOpen(true);
                              }}
                              className="text-xs font-semibold text-[#16A34A] hover:text-[#15803D] hover:underline"
                            >
                              Xem QR
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 2: Nhận & Chuyển */}
      {activeTab === 'transfer' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Left Column: Mã nhận tiền của tôi + VietQR cá nhân */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-[#DCE6DF] pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="size-4 text-[#16A34A]" aria-hidden />
                <h2 className="text-sm font-bold text-[#111827]">Mã nhận tiền của tôi</h2>
              </div>
              <span className="font-mono text-xs font-bold text-[#15803D] bg-[#ECFDF3] border border-[#BBF7D0] px-2.5 py-0.5 rounded-full">
                {receiveCode}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-[#DCE6DF] bg-[#F5FAF7] p-4">
              <div className="rounded-xl border border-[#DCE6DF] bg-white p-2.5 shrink-0">
                <DeterministicQrMatrixSvg
                  payload={receiveQrPayload}
                  label={`Mã QR nhận Credit ${receiveCode}`}
                  className="size-36"
                />
              </div>
              <div className="space-y-2.5 text-xs w-full min-w-0">
                <div>
                  <span className="text-[#6B7280] block">Mã định danh nhận Credit</span>
                  <span className="font-mono text-sm font-bold text-[#111827] select-all">
                    {receiveCode}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyText('receiveCode', receiveCode)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#16A34A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#15803D] transition-colors"
                  >
                    {copiedToken === 'receiveCode' ? (
                      <>
                        <Check className="size-3.5" aria-hidden /> Đã chép mã
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" aria-hidden /> Sao chép mã
                      </>
                    )}
                  </button>
                  {user?.username && (
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          'receiveLink',
                          `${window.location.origin}${assetUrl(`rewards?tab=transfer&to=${encodeURIComponent(user.username)}`)}`,
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-[#DCE6DF] bg-white px-3 py-1.5 text-xs font-semibold text-[#111827] hover:bg-[#ECFDF3] transition-colors"
                    >
                      {copiedToken === 'receiveLink' ? 'Đã chép link' : 'Chép link nhận'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Linked Personal Real-Money VietQR */}
            <div className="border-t border-[#DCE6DF] pt-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Building2 className="size-4 text-[#16A34A]" aria-hidden />
                  <h3 className="text-xs sm:text-sm font-bold text-[#111827]">
                    Liên kết ngân hàng VietQR
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBankForm((v) => !v)}
                  className="text-xs font-semibold text-[#16A34A] hover:text-[#15803D]"
                >
                  {showBankForm ? 'Thu gọn' : hasLinkedBank ? 'Cập nhật TK' : 'Liên kết ngay'}
                </button>
              </div>

              {hasLinkedBank && !showBankForm && (
                <div className="rounded-xl border border-[#BBF7D0] bg-[#ECFDF3]/60 p-3.5 flex flex-col sm:flex-row items-center gap-3.5">
                  <div className="rounded-lg border border-[#DCE6DF] bg-white p-2 shrink-0">
                    {vietQrReceiveUrl && !vietQrReceiveImgFailed ? (
                      <img
                        src={vietQrReceiveUrl}
                        alt={`VietQR ${linkedBankAccountNo}`}
                        onError={() => setVietQrReceiveImgFailed(true)}
                        className="size-32 object-contain"
                      />
                    ) : (
                      <DeterministicQrMatrixSvg
                        payload={`${linkedBankBin}|${linkedBankAccountNo}|${receiveCode}`}
                        label="VietQR cá nhân"
                        className="size-32"
                      />
                    )}
                  </div>
                  <div className="text-xs space-y-1 min-w-0 w-full">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#15803D]">
                      <CheckCircle2 className="size-3.5 text-[#16A34A]" aria-hidden /> VietQR cá nhân đang bật
                    </span>
                    <p className="font-bold text-[#111827]">{linkedBankName}</p>
                    <p className="font-mono font-semibold text-[#111827] tabular-nums">
                      {linkedBankAccountNo}
                    </p>
                    <p className="text-[#4B5563] truncate">{linkedBankAccountName}</p>
                  </div>
                </div>
              )}

              {(showBankForm || !hasLinkedBank) && (
                <form onSubmit={handleSaveBankProfile} className="space-y-3 rounded-xl border border-[#DCE6DF] bg-[#F5FAF7] p-3.5">
                  <div>
                    <label htmlFor="bank-bin-select" className="block text-xs font-semibold text-[#111827] mb-1">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label htmlFor="bank-acc-no" className="block text-xs font-semibold text-[#111827] mb-1">
                        Số tài khoản
                      </label>
                      <Input
                        id="bank-acc-no"
                        value={bankAccountNo}
                        onChange={(e) => setBankAccountNo(e.target.value)}
                        placeholder="0888999777"
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <label htmlFor="bank-acc-name" className="block text-xs font-semibold text-[#111827] mb-1">
                        Tên chủ tài khoản
                      </label>
                      <Input
                        id="bank-acc-name"
                        value={bankAccountName}
                        onChange={(e) => setBankAccountName(e.target.value.toUpperCase())}
                        placeholder="NGUYEN VAN A"
                        className="text-xs uppercase"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    variant="primary"
                    loading={updateBankMutation.isPending}
                  >
                    Lưu mã VietQR cá nhân
                  </Button>
                </form>
              )}
            </div>
          </Card>

          {/* Right Column: Chuyển Credit nhanh + Rút về ngân hàng */}
          <div className="space-y-5">
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
                  <label htmlFor="transfer-recipient" className="block text-xs font-semibold text-[#111827] mb-1">
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
                  <label htmlFor="transfer-note" className="block text-xs font-semibold text-[#111827] mb-1">
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
                    Trừ từ Credit nạp & thu nhập
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

            {/* Rút về ngân hàng */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-[#DCE6DF] pb-3">
                <div className="flex items-center gap-2">
                  <Landmark className="size-4 text-[#16A34A]" aria-hidden />
                  <h2 className="text-sm font-bold text-[#111827]">Rút về ngân hàng</h2>
                </div>
                <span className="text-xs font-semibold text-[#15803D] tabular-nums">
                  Thu nhập: {earnedCredits.toLocaleString('vi-VN')} Credit
                </span>
              </div>

              {!hasLinkedBank ? (
                <p className="rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] p-3 text-xs text-[#4B5563]">
                  Liên kết tài khoản ngân hàng ở cột bên trái trước khi gửi yêu cầu rút VNĐ.
                </p>
              ) : (
                <form onSubmit={handlePayoutSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label htmlFor="payout-amount" className="block text-xs font-semibold text-[#111827] mb-1">
                        Số Credit rút (tối thiểu 50)
                      </label>
                      <Input
                        id="payout-amount"
                        type="number"
                        min={50}
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
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
                    onChange={(e) => setPayoutNote(e.target.value)}
                    maxLength={140}
                    placeholder="Ghi chú đối soát (tùy chọn)..."
                    aria-label="Ghi chú rút tiền"
                    className="text-xs"
                  />

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[#6B7280] truncate">
                      Nhận qua {linkedBankName} · {linkedBankAccountNo}
                    </span>
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      loading={payoutMutation.isPending}
                      disabled={earnedCredits < 50}
                    >
                      Gửi lệnh rút
                    </Button>
                  </div>
                </form>
              )}

              {payouts.length > 0 && (
                <div className="pt-3 border-t border-[#DCE6DF] space-y-2">
                  <span className="text-xs font-semibold text-[#111827] block">
                    Lịch sử rút tiền ({payouts.length})
                  </span>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
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
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0 ${meta.className}`}>
                            {meta.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* TAB 3: Đổi ưu đãi */}
      {activeTab === 'catalog' && (
        <div className="space-y-5">
          {loadingCatalog ? (
            <Spinner label="Đang tải ưu đãi..." />
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
                          <Lock className="size-3" aria-hidden /> Dùng mục Rút tiền
                        </span>
                      ) : isOutOfStock ? (
                        <span className="text-[11px] font-semibold text-red-700">
                          Hết suất
                        </span>
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
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <Card className="w-full max-w-md p-5 space-y-4 shadow-xl">
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
          )}
        </div>
      )}

      {/* TAB 4: Lịch sử giao dịch */}
      {activeTab === 'ledger' && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-[#DCE6DF] bg-[#F5FAF7] flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-bold text-xs sm:text-sm text-[#111827]">
                Lịch sử giao dịch
              </h2>
            </div>
          </div>

          {loadingWallet ? (
            <Spinner label="Đang tải lịch sử giao dịch..." />
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
          )}
        </Card>
      )}
    </div>
  );
}
