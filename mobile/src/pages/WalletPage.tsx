import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Gift,
  Loader2,
  QrCode,
  RefreshCw,
  XCircle,
  Zap,
} from 'lucide-react';
import { paymentsApi, rewardsApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type { PaymentOrderItem, TopupPackageItem } from '../api/types';
import { BottomSheet, EmptyView, Spinner, cn, relativeTime } from '../components/ui';

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
    .replace(/\bP2P\b/gi, 'Chuyển Credit')
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

const FALLBACK_PACKAGES: TopupPackageItem[] = [
  { id: 'pkg_50k', label: '50.000đ', amountVnd: 50_000, credits: 50, bonusCredits: 0 },
  { id: 'pkg_100k', label: '100.000đ', amountVnd: 100_000, credits: 105, bonusCredits: 5 },
  { id: 'pkg_200k', label: '200.000đ', amountVnd: 200_000, credits: 220, bonusCredits: 20 },
  { id: 'pkg_500k', label: '500.000đ', amountVnd: 500_000, credits: 575, bonusCredits: 75 },
];

const DEFAULT_ORDER_TTL_SECONDS = 600;
const DEFAULT_REMINDER_WINDOW_SECONDS = 60;

function getRemainingSeconds(expiresAt: string | undefined, effectiveNowMs: number): number {
  if (!expiresAt) return 0;
  const expiresMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresMs)) return 0;
  return Math.max(0, Math.ceil((expiresMs - effectiveNowMs) / 1000));
}

function formatMmSs(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(clamped / 60)).padStart(2, '0');
  const ss = String(clamped % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function appendCacheBust(url: string, nonce: number): string {
  if (nonce <= 0) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}retry=${nonce}`;
}

export function WalletPage() {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [sheetOrder, setSheetOrder] = useState<PaymentOrderItem | null>(null);
  const [creatingPkgId, setCreatingPkgId] = useState<string | null>(null);
  const [qrImgErr, setQrImgErr] = useState(false);
  const [qrReloadNonce, setQrReloadNonce] = useState(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [sheetErr, setSheetErr] = useState<string | null>(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [reminderOrderCode, setReminderOrderCode] = useState<string | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const remindedCodesRef = useRef<Set<string>>(new Set());
  const zeroSyncedCodesRef = useRef<Set<string>>(new Set());
  const prevSheetOrderStatusRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const syncServerClock = useCallback((serverNow?: string) => {
    if (!serverNow) return;
    const parsed = Date.parse(serverNow);
    if (Number.isFinite(parsed)) {
      setServerOffsetMs(parsed - Date.now());
    }
  }, []);

  const showToast = useCallback((kind: 'ok' | 'err', text: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ kind, text });
    if (kind === 'ok') {
      toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
    }
  }, []);

  const copyField = (key: string, value: string) => {
    void navigator.clipboard?.writeText(value);
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    setCopiedKey(key);
    copyTimerRef.current = window.setTimeout(() => setCopiedKey(null), 1600);
  };

  const walletQuery = useQuery({
    queryKey: ['my-wallet'],
    queryFn: () => rewardsApi.getWallet(),
  });

  const packagesQuery = useQuery({
    queryKey: ['payments', 'packages'],
    queryFn: async () => {
      const res = await paymentsApi.getPackages();
      syncServerClock(res.serverNow);
      return res;
    },
    staleTime: 60_000,
  });

  const ordersQuery = useQuery({
    queryKey: ['payments', 'topup-orders'],
    queryFn: async () => {
      const res = await paymentsApi.getTopupOrders();
      syncServerClock(res.serverNow);
      return res;
    },
  });

  const sheetOrderCode = sheetOrder?.orderCode ?? null;

  const orderDetailQuery = useQuery({
    queryKey: ['payments', 'topup-order', sheetOrderCode],
    queryFn: async () => {
      const res = await paymentsApi.getTopupOrder(sheetOrderCode!);
      syncServerClock(res.serverNow);
      return res;
    },
    enabled: Boolean(sheetOrderCode),
    refetchInterval: (query) => {
      const latestStatus = query.state.data?.order?.status ?? sheetOrder?.status;
      return latestStatus === 'PENDING' ? 4000 : false;
    },
  });

  const claimMut = useMutation({
    mutationFn: () => rewardsApi.claimOnboardingGrant(),
    onSuccess: (res) => {
      showToast('ok', res.granted ? `+${res.amount} Credit` : 'Đã nhận trước đó');
      void queryClient.invalidateQueries({ queryKey: ['my-wallet'] });
    },
    onError: (e) => showToast('err', errorMessage(e)),
  });

  const createOrderMut = useMutation({
    mutationFn: (body: { packageId?: string; amountVnd?: number }) =>
      paymentsApi.createTopupOrder(body),
    onMutate: (body) => {
      setSheetErr(null);
      setCreatingPkgId(body.packageId ?? null);
    },
    onSuccess: (res) => {
      syncServerClock(res.serverNow);
      setCreatingPkgId(null);
      setQrImgErr(false);
      setQrReloadNonce(0);
      setReminderOrderCode(null);
      setSheetOrder(res.order);
      void queryClient.invalidateQueries({ queryKey: ['payments', 'topup-orders'] });
    },
    onError: (e) => {
      setCreatingPkgId(null);
      showToast('err', errorMessage(e));
    },
  });

  const cancelMut = useMutation({
    mutationFn: (orderCode: string) => paymentsApi.cancelTopupOrder(orderCode),
    onSuccess: (res) => {
      syncServerClock(res.serverNow);
      setSheetErr(null);
      setReminderOrderCode((prev) => (prev === res.order.orderCode ? null : prev));
      if (sheetOrder?.orderCode === res.order.orderCode) {
        setSheetOrder(res.order);
      }
      showToast('ok', 'Đã hủy đơn nạp');
      void queryClient.invalidateQueries({ queryKey: ['payments', 'topup-orders'] });
      void queryClient.invalidateQueries({
        queryKey: ['payments', 'topup-order', res.order.orderCode],
      });
    },
    onError: (e) => {
      const msg = errorMessage(e);
      if (sheetOrder) {
        setSheetErr(msg);
      } else {
        showToast('err', msg);
      }
    },
  });

  const simulateMut = useMutation({
    mutationFn: (orderCode: string) => paymentsApi.simulateOrderPaid(orderCode),
    onSuccess: (res) => {
      setSheetErr(null);
      setReminderOrderCode((prev) => (prev === res.order.orderCode ? null : prev));
      setSheetOrder(res.order);
      showToast('ok', `+${res.order.creditsToGrant} Credit`);
      void queryClient.invalidateQueries({ queryKey: ['my-wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['payments', 'topup-orders'] });
      void queryClient.invalidateQueries({
        queryKey: ['payments', 'topup-order', res.order.orderCode],
      });
    },
    onError: (e) => {
      setSheetErr(errorMessage(e));
      if (sheetOrderCode) {
        void queryClient.invalidateQueries({
          queryKey: ['payments', 'topup-order', sheetOrderCode],
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['payments', 'topup-orders'] });
    },
  });

  const orders = ordersQuery.data?.orders ?? [];
  const activeOrder = useMemo(() => {
    if (!sheetOrder) return null;
    const polled = orderDetailQuery.data?.order;
    if (polled && polled.orderCode === sheetOrder.orderCode) return polled;
    return orders.find((o) => o.orderCode === sheetOrder.orderCode) ?? sheetOrder;
  }, [orderDetailQuery.data?.order, orders, sheetOrder]);

  const effectiveNowMs = nowMs + serverOffsetMs;
  const orderTtlSeconds = packagesQuery.data?.orderTtlSeconds ?? DEFAULT_ORDER_TTL_SECONDS;
  const reminderWindowSeconds =
    orderDetailQuery.data?.reminderWindowSeconds ??
    packagesQuery.data?.reminderWindowSeconds ??
    DEFAULT_REMINDER_WINDOW_SECONDS;
  const sandboxEnabled = packagesQuery.data?.sandboxEnabled === true;

  const latestPendingOrder = useMemo(() => {
    return (
      orders.find(
        (o) => o.status === 'PENDING' && getRemainingSeconds(o.expiresAt, effectiveNowMs) > 0,
      ) ?? null
    );
  }, [orders, effectiveNowMs]);

  const hasTickingOrder = Boolean(
    latestPendingOrder || (activeOrder && activeOrder.status === 'PENDING'),
  );

  useEffect(() => {
    if (!hasTickingOrder) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [hasTickingOrder]);

  const activeRemainingSec = activeOrder
    ? activeOrder.status === 'PENDING'
      ? getRemainingSeconds(activeOrder.expiresAt, effectiveNowMs)
      : 0
    : 0;

  const bannerRemainingSec = latestPendingOrder
    ? getRemainingSeconds(latestPendingOrder.expiresAt, effectiveNowMs)
    : 0;

  useEffect(() => {
    setQrImgErr(false);
    setQrReloadNonce(0);
    setSheetErr(null);
    prevSheetOrderStatusRef.current = activeOrder?.status ?? null;
  }, [activeOrder?.orderCode]);

  // Sync wallet + orders when polled order transitions out of PENDING
  useEffect(() => {
    if (!activeOrder) return;
    const prev = prevSheetOrderStatusRef.current;
    if (prev && prev !== activeOrder.status) {
      if (activeOrder.status === 'PAID') {
        showToast('ok', `+${activeOrder.creditsToGrant} Credit`);
        void queryClient.invalidateQueries({ queryKey: ['my-wallet'] });
      }
      void queryClient.invalidateQueries({ queryKey: ['payments', 'topup-orders'] });
    }
    prevSheetOrderStatusRef.current = activeOrder.status;
  }, [activeOrder, queryClient, showToast]);

  // Immediately sync with server when activeOrder countdown reaches 00:00
  useEffect(() => {
    if (!activeOrder || activeOrder.status !== 'PENDING') return;
    if (activeRemainingSec > 0) return;
    if (zeroSyncedCodesRef.current.has(activeOrder.orderCode)) return;
    zeroSyncedCodesRef.current.add(activeOrder.orderCode);
    void orderDetailQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: ['payments', 'topup-orders'] });
  }, [activeOrder, activeRemainingSec, orderDetailQuery, queryClient]);

  // Trigger 1-minute final reminder popup once per orderCode
  useEffect(() => {
    const candidate = activeOrder?.status === 'PENDING' ? activeOrder : latestPendingOrder;
    if (!candidate || candidate.status !== 'PENDING') return;
    const rem = getRemainingSeconds(candidate.expiresAt, effectiveNowMs);
    if (rem > 0 && rem <= reminderWindowSeconds && !remindedCodesRef.current.has(candidate.orderCode)) {
      remindedCodesRef.current.add(candidate.orderCode);
      setReminderOrderCode(candidate.orderCode);
    }
  }, [activeOrder, latestPendingOrder, effectiveNowMs, reminderWindowSeconds]);

  // Auto-dismiss reminder popup if the order is no longer PENDING or has expired
  const reminderOrder = useMemo(() => {
    if (!reminderOrderCode) return null;
    if (activeOrder?.orderCode === reminderOrderCode) return activeOrder;
    return orders.find((o) => o.orderCode === reminderOrderCode) ?? null;
  }, [reminderOrderCode, activeOrder, orders]);

  const reminderRemainingSec = reminderOrder
    ? getRemainingSeconds(reminderOrder.expiresAt, effectiveNowMs)
    : 0;

  useEffect(() => {
    if (!reminderOrderCode) return;
    if (!reminderOrder || reminderOrder.status !== 'PENDING' || reminderRemainingSec <= 0) {
      setReminderOrderCode(null);
    }
  }, [reminderOrderCode, reminderOrder, reminderRemainingSec]);

  const packages = packagesQuery.data?.packages?.length
    ? packagesQuery.data.packages
    : FALLBACK_PACKAGES;

  const recreateOrder = (order: PaymentOrderItem) => {
    if (createOrderMut.isPending) return;
    const matchedPkg = packages.find(
      (p) => p.amountVnd === order.amountVnd && p.credits === order.creditsToGrant,
    );
    if (matchedPkg) {
      createOrderMut.mutate({ packageId: matchedPkg.id });
    } else {
      createOrderMut.mutate({ amountVnd: order.amountVnd });
    }
  };

  if (walletQuery.isLoading) return <Spinner />;

  const wallet = walletQuery.data?.wallet;
  const txs = walletQuery.data?.transactions ?? [];
  const hasGrant = txs.some((t) => t.type === 'STARTER_GRANT');
  const vndPerCredit = packagesQuery.data?.vndPerCredit ?? 1000;
  const bankInfo = packagesQuery.data?.bankInfo;

  const resolvedBankName = activeOrder?.bankName ?? bankInfo?.bankName ?? 'MB Bank';
  const resolvedAccountNo = activeOrder?.accountNo ?? bankInfo?.accountNo ?? '0888999777';
  const resolvedAccountName =
    activeOrder?.accountName ?? bankInfo?.accountName ?? 'CONG TY NEUROLINK VIET NAM';

  const isOrderPaid = activeOrder?.status === 'PAID';
  const isOrderCancelled = activeOrder?.status === 'CANCELLED';
  const isOrderExpired =
    activeOrder?.status === 'EXPIRED' ||
    (activeOrder?.status === 'PENDING' && activeRemainingSec === 0);
  const isOrderPendingActive = activeOrder?.status === 'PENDING' && activeRemainingSec > 0;
  const isUrgentCountdown = isOrderPendingActive && activeRemainingSec <= reminderWindowSeconds;

  const orderDurationSec = activeOrder
    ? Math.max(
        1,
        Math.round((Date.parse(activeOrder.expiresAt) - Date.parse(activeOrder.createdAt)) / 1000) ||
          orderTtlSeconds,
      )
    : orderTtlSeconds;
  const progressPct = Math.max(0, Math.min(100, (activeRemainingSec / orderDurationSec) * 100));

  const qrImageSrc = activeOrder?.vietQrImageUrl
    ? appendCacheBust(activeOrder.vietQrImageUrl, qrReloadNonce)
    : '';

  return (
    <div className="px-3.5 pt-3.5 space-y-4">
      {/* Crisp Balance Hero */}
      <section className="rounded-[24px] bg-[#14532D] text-white p-5 space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-200/85">
            <Coins className="size-4 text-emerald-300" aria-hidden />
            <span>Số dư Credit</span>
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <p className="font-mono text-3xl font-bold tracking-tight tabular-nums">
            {(wallet?.balance ?? 0).toLocaleString('vi-VN')}
          </p>
          {toast && (
            <span
              role={toast.kind === 'err' ? 'alert' : 'status'}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold max-w-[60%] truncate',
                toast.kind === 'err' ? 'bg-red-500/25 text-red-100' : 'bg-white/15 text-white',
              )}
            >
              {toast.kind === 'ok' && <Check className="size-3 shrink-0" aria-hidden />}
              <span className="truncate">{toast.text}</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/15 text-xs tabular-nums">
          <div>
            <span className="text-emerald-200/75">Đã nhận</span>
            <p className="font-mono font-semibold text-sm">
              +{(wallet?.totalEarned ?? 0).toLocaleString('vi-VN')}
            </p>
          </div>
          <div>
            <span className="text-emerald-200/75">Đã dùng</span>
            <p className="font-mono font-semibold text-sm">
              -{(wallet?.totalSpent ?? 0).toLocaleString('vi-VN')}
            </p>
          </div>
        </div>

        {!hasGrant && (
          <button
            type="button"
            disabled={claimMut.isPending}
            onClick={() => claimMut.mutate()}
            className="flex w-full items-center justify-center gap-2 h-10 rounded-full bg-white text-[#14532D] text-xs font-bold active:scale-95 transition-transform cursor-pointer disabled:opacity-50"
          >
            <Gift className="size-4" aria-hidden />
            <span>Nhận Credit khởi đầu</span>
          </button>
        )}
      </section>

      {/* Compact VietQR Top-Up Package Grid (1-tap direct VietQR) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-1.5 text-sm font-bold text-[#111827]">
            <QrCode className="size-4 text-[#16A34A]" aria-hidden />
            <span>Nạp VietQR</span>
          </h2>
          <span className="text-[11px] font-medium text-[#5B6860] tabular-nums">
            {vndPerCredit.toLocaleString('vi-VN')}đ / Credit
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {packages.map((pkg) => {
            const isCreatingThis = createOrderMut.isPending && creatingPkgId === pkg.id;
            return (
              <button
                key={pkg.id}
                type="button"
                disabled={createOrderMut.isPending}
                onClick={() => createOrderMut.mutate({ packageId: pkg.id })}
                className={cn(
                  'flex flex-col items-start justify-between gap-1.5 rounded-2xl border border-[#DCE6DF] bg-white p-3.5 text-left hover:border-[#16A34A] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60',
                  isCreatingThis && 'border-[#16A34A] bg-[#ECFDF3]',
                )}
              >
                <div className="flex w-full items-center justify-between gap-1">
                  <span className="font-mono text-sm font-bold text-[#111827] tabular-nums">
                    {pkg.label}
                  </span>
                  {isCreatingThis ? (
                    <Loader2 className="size-3.5 animate-spin text-[#16A34A]" aria-hidden />
                  ) : (
                    pkg.bonusCredits > 0 && (
                      <span className="rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[10px] font-bold text-[#15803D] tabular-nums">
                        +{pkg.bonusCredits}
                      </span>
                    )
                  )}
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#16A34A] tabular-nums">
                  <span>+{pkg.credits} Credit</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Compact Pending Order Banner */}
        {latestPendingOrder && bannerRemainingSec > 0 && (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 px-3.5 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-amber-900 truncate">
                  Đơn chờ · <span className="font-mono">{latestPendingOrder.orderCode}</span>
                </p>
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-amber-900/80 tabular-nums truncate">
                <span
                  className={cn(
                    'font-mono font-bold',
                    bannerRemainingSec <= reminderWindowSeconds
                      ? 'text-red-700'
                      : 'text-amber-900',
                  )}
                >
                  Còn {formatMmSs(bannerRemainingSec)}
                </span>
                <span aria-hidden>·</span>
                <span className="truncate">
                  {latestPendingOrder.amountVnd.toLocaleString('vi-VN')}đ
                </span>
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setSheetOrder(latestPendingOrder)}
                className="h-9 rounded-full bg-white border border-amber-300 px-3 text-[11px] font-semibold text-amber-950 active:scale-95 transition-transform cursor-pointer"
              >
                Mở QR
              </button>
              <button
                type="button"
                disabled={cancelMut.isPending}
                onClick={() => cancelMut.mutate(latestPendingOrder.orderCode)}
                className="h-9 rounded-full border border-amber-200/90 bg-amber-100/70 px-2.5 text-[11px] font-semibold text-amber-900 active:scale-95 transition-transform cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Transaction History */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-[#111827]">Lịch sử</h2>
        {txs.length === 0 ? (
          <EmptyView title="Chưa có giao dịch" />
        ) : (
          <div className="divide-y divide-[#EDF3EF] rounded-2xl border border-[#DCE6DF] bg-white overflow-hidden">
            {txs.slice(0, 15).map((tx) => {
              const positive = tx.amount >= 0;
              return (
                <div key={tx.id} className="flex items-center gap-3 px-3.5 py-3">
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-full',
                      positive ? 'bg-[#ECFDF3] text-[#15803D]' : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {positive ? (
                      <ArrowDownLeft className="size-4" aria-hidden />
                    ) : (
                      <ArrowUpRight className="size-4" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#111827] truncate">
                      {formatTxDescription(tx.description, tx.type)}
                    </p>
                    <p className="text-[11px] text-[#7A8880] truncate">
                      {relativeTime(tx.createdAt)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'font-mono text-sm font-bold tabular-nums shrink-0',
                      positive ? 'text-[#15803D]' : 'text-[#374151]',
                    )}
                  >
                    {positive ? `+${tx.amount}` : tx.amount}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Direct VietQR Payment Bottom Sheet */}
      <BottomSheet
        open={Boolean(activeOrder)}
        onClose={() => setSheetOrder(null)}
        title="Thanh toán VietQR"
        headerRight={
          activeOrder && (
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                isOrderPaid
                  ? 'border-[#86EFAC] bg-[#ECFDF3] text-[#15803D]'
                  : isOrderExpired
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : isOrderCancelled
                      ? 'border-slate-200 bg-slate-100 text-slate-600'
                      : 'border-amber-200 bg-amber-50 text-amber-800',
              )}
            >
              {isOrderPaid
                ? 'Đã nạp'
                : isOrderExpired
                  ? 'Hết hạn'
                  : isOrderCancelled
                    ? 'Đã hủy'
                    : 'Chờ CK'}
            </span>
          )
        }
      >
        {activeOrder && (
          <div className="space-y-3.5">
            {/* Live Server-Synced Countdown Bar (PENDING & active) */}
            {isOrderPendingActive && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 font-semibold tabular-nums',
                      isUrgentCountdown ? 'text-red-600' : 'text-[#15803D]',
                    )}
                  >
                    <Clock className="size-3.5 shrink-0" aria-hidden />
                    <span>
                      Còn lại:{' '}
                      <span className="font-mono font-bold">{formatMmSs(activeRemainingSec)}</span>
                    </span>
                  </span>
                  <span className="text-[11px] text-[#5B6860] font-mono tabular-nums">
                    {activeOrder.orderCode}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#E5EFE8] overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width] duration-700',
                      isUrgentCountdown ? 'bg-red-500' : 'bg-[#16A34A]',
                    )}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Centered Amount + QR Box */}
            <div className="flex flex-col items-center rounded-2xl border border-[#DCE6DF] bg-[#F5FAF7] p-4 text-center">
              <p className="font-mono text-xl font-bold text-[#111827] tabular-nums">
                {activeOrder.amountVnd.toLocaleString('vi-VN')} ₫
              </p>
              <p className="mt-0.5 text-xs font-semibold text-[#15803D] tabular-nums">
                +{activeOrder.creditsToGrant} Credit
                {activeOrder.bonusCredits > 0 ? ` (Tặng +${activeOrder.bonusCredits})` : ''}
              </p>

              <div className="relative mt-3 rounded-2xl border border-[#DCE6DF] bg-white p-2.5 overflow-hidden">
                {qrImageSrc && !qrImgErr ? (
                  <img
                    src={qrImageSrc}
                    alt={`VietQR ${activeOrder.orderCode}`}
                    onError={() => setQrImgErr(true)}
                    className={cn(
                      'size-44 object-contain rounded-lg transition-opacity',
                      (isOrderExpired || isOrderCancelled) && 'opacity-20 grayscale',
                    )}
                  />
                ) : (
                  <div
                    className={cn(
                      'size-44 flex flex-col items-center justify-center gap-2 rounded-lg bg-[#F5FAF7] px-3 text-center',
                      (isOrderExpired || isOrderCancelled) && 'opacity-30',
                    )}
                  >
                    <QrCode className="size-7 text-[#5B6860]" aria-hidden />
                    <p className="text-[11px] font-semibold text-[#111827]">
                      Không tải được ảnh QR
                    </p>
                    <p className="text-[10px] text-[#5B6860]">
                      Hãy chuyển khoản theo thông tin bên dưới
                    </p>
                    {isOrderPendingActive && (
                      <button
                        type="button"
                        onClick={() => {
                          setQrImgErr(false);
                          setQrReloadNonce((n) => n + 1);
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-[#DCE6DF] bg-white px-3 h-7 text-[11px] font-semibold text-[#15803D] cursor-pointer active:scale-95"
                      >
                        <RefreshCw className="size-3" aria-hidden />
                        <span>Tải lại QR</span>
                      </button>
                    )}
                  </div>
                )}

                {(isOrderExpired || isOrderCancelled) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/55 backdrop-blur-[1px] p-2">
                    <span
                      className={cn(
                        'rounded-full px-3 py-1.5 text-[11px] font-bold tracking-wide shadow-sm',
                        isOrderExpired
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-800 text-white',
                      )}
                    >
                      {isOrderExpired ? 'MÃ QR ĐÃ HẾT HẠN' : 'ĐƠN ĐÃ HỦY'}
                    </span>
                  </div>
                )}
              </div>

              <p className="mt-2 text-[11px] text-[#5B6860]">
                {isOrderPaid
                  ? 'Thanh toán đã hoàn tất'
                  : isOrderExpired
                    ? 'Vui lòng tạo mã QR mới để tiếp tục nạp'
                    : isOrderCancelled
                      ? 'Đơn nạp này đã được hủy'
                      : 'Quét bằng ứng dụng ngân hàng để nhận Credit tự động'}
              </p>
            </div>

            {/* Single Consolidated Bank Account + Transfer Code Card */}
            <div className="rounded-2xl border border-[#DCE6DF] bg-white divide-y divide-[#EDF3EF] text-xs">
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <span className="block text-[11px] text-[#5B6860] truncate">
                    {resolvedBankName} · {resolvedAccountName}
                  </span>
                  <span className="font-mono text-sm font-bold text-[#111827] tabular-nums">
                    {resolvedAccountNo}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyField('acc', resolvedAccountNo)}
                  className="inline-flex items-center gap-1 rounded-full border border-[#DCE6DF] bg-[#F5FAF7] px-3 h-8 text-[11px] font-semibold text-[#15803D] shrink-0 cursor-pointer active:scale-95"
                >
                  {copiedKey === 'acc' ? (
                    <>
                      <Check className="size-3" aria-hidden /> Đã chép
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" aria-hidden /> Chép STK
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 bg-[#ECFDF3]/60 px-3.5 py-2.5 rounded-b-2xl">
                <div className="min-w-0 flex-1">
                  <span className="block text-[11px] font-medium text-[#15803D]">
                    Nội dung chuyển khoản
                  </span>
                  <span className="font-mono text-sm font-bold text-[#14532D] tracking-wide select-all">
                    {activeOrder.orderCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyField('code', activeOrder.orderCode)}
                  className="inline-flex items-center gap-1 rounded-full bg-[#16A34A] px-3 h-8 text-[11px] font-semibold text-white shrink-0 cursor-pointer active:scale-95"
                >
                  {copiedKey === 'code' ? (
                    <>
                      <Check className="size-3" aria-hidden /> Đã chép
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" aria-hidden /> Chép nội dung
                    </>
                  )}
                </button>
              </div>
            </div>

            {sheetErr && (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                {sheetErr}
              </p>
            )}

            {/* Status-Specific Actions */}
            {isOrderPaid ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-center gap-1.5 rounded-2xl border border-[#BBF7D0] bg-[#ECFDF3] py-2.5 text-xs font-bold text-[#15803D]">
                  <CheckCircle2 className="size-4 text-[#16A34A]" aria-hidden />
                  <span>Đã cộng +{activeOrder.creditsToGrant} Credit</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSheetOrder(null)}
                  className="w-full h-11 rounded-full bg-[#14532D] text-sm font-semibold text-white cursor-pointer active:scale-[0.98]"
                >
                  Xong
                </button>
              </div>
            ) : isOrderExpired || isOrderCancelled ? (
              <div className="space-y-2">
                {isOrderCancelled && (
                  <div className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 py-2 text-xs font-semibold text-slate-700">
                    <XCircle className="size-4 text-slate-500" aria-hidden />
                    <span>Đơn đã hủy</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSheetOrder(null)}
                    className="h-11 px-5 rounded-full border border-[#DCE6DF] bg-white text-xs font-semibold text-[#111827] cursor-pointer active:scale-[0.98]"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    disabled={createOrderMut.isPending}
                    onClick={() => recreateOrder(activeOrder)}
                    className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-full bg-[#16A34A] hover:bg-[#15803D] text-xs font-semibold text-white cursor-pointer active:scale-[0.98] disabled:opacity-50"
                  >
                    {createOrderMut.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <RefreshCw className="size-4" aria-hidden />
                    )}
                    <span>Tạo mã QR mới</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={cancelMut.isPending || simulateMut.isPending}
                  onClick={() => cancelMut.mutate(activeOrder.orderCode)}
                  className={cn(
                    'h-11 rounded-full border border-[#DCE6DF] bg-white text-xs font-semibold text-[#374151] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50',
                    sandboxEnabled ? 'px-4 shrink-0' : 'w-full',
                  )}
                >
                  {cancelMut.isPending ? 'Đang hủy...' : 'Hủy đơn'}
                </button>
                {sandboxEnabled && (
                  <button
                    type="button"
                    disabled={simulateMut.isPending || cancelMut.isPending}
                    onClick={() => simulateMut.mutate(activeOrder.orderCode)}
                    className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-full bg-[#16A34A] hover:bg-[#15803D] text-xs font-semibold text-white active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {simulateMut.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Zap className="size-4" aria-hidden />
                    )}
                    <span>Xác nhận thử (Sandbox)</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      {/* Final 1-Minute Auto Reminder Dialog */}
      {reminderOrder && reminderOrder.status === 'PENDING' && reminderRemainingSec > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div
            className="fixed inset-0 bg-[#052E16]/45 backdrop-blur-[2px]"
            onClick={() => setReminderOrderCode(null)}
            aria-hidden="true"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="payment-reminder-title"
            aria-describedby="payment-reminder-desc"
            className="relative z-10 w-full max-w-[343px] rounded-[24px] border border-amber-200 bg-white p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <AlertTriangle className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h3
                  id="payment-reminder-title"
                  className="text-[15px] font-bold text-[#111827]"
                >
                  Sắp hết giờ thanh toán!
                </h3>
                <p className="mt-0.5 font-mono text-sm font-bold text-red-600 tabular-nums">
                  Còn {formatMmSs(reminderRemainingSec)}
                </p>
              </div>
            </div>

            <p id="payment-reminder-desc" className="text-xs leading-relaxed text-[#4B5563]">
              Mã QR đơn <span className="font-mono font-bold text-[#111827]">{reminderOrder.orderCode}</span> sắp hết hạn. Vui lòng hoàn tất chuyển khoản ngay để nhận Credit tự động.
            </p>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setSheetOrder(reminderOrder);
                  setReminderOrderCode(null);
                }}
                className="w-full h-11 rounded-full bg-[#16A34A] hover:bg-[#15803D] text-xs font-semibold text-white active:scale-[0.98] transition-transform cursor-pointer"
              >
                Tiếp tục quét QR
              </button>
              <button
                type="button"
                disabled={createOrderMut.isPending}
                onClick={() => {
                  setReminderOrderCode(null);
                  recreateOrder(reminderOrder);
                }}
                className="w-full h-11 rounded-full border border-[#DCE6DF] bg-[#F5FAF7] text-xs font-semibold text-[#15803D] active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-50"
              >
                Tạo mã QR mới
              </button>
              <button
                type="button"
                disabled={cancelMut.isPending}
                onClick={() => {
                  setReminderOrderCode(null);
                  cancelMut.mutate(reminderOrder.orderCode);
                }}
                className="w-full h-11 rounded-full border border-red-200 bg-red-50 text-xs font-semibold text-red-700 active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-50"
              >
                Hủy đơn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
