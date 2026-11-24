import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  Gift,
  Loader2,
  QrCode,
  Zap,
} from 'lucide-react';
import { paymentsApi, rewardsApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type {
  PaymentOrderItem,
  TopupPackageItem,
} from '../api/types';
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

function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 0x9e3779b9;
}

function CompactQrSvg({ payload, label }: { payload: string; label: string }) {
  const matrix = useMemo(() => {
    const size = 25;
    const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
    const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

    const placeFinder = (ro: number, co: number) => {
      for (let r = -1; r <= 7; r += 1) {
        for (let c = -1; c <= 7; c += 1) {
          const rr = ro + r;
          const cc = co + c;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
          reserved[rr]![cc] = true;
          const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
          const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          grid[rr]![cc] = inOuter && (onBorder || inCore);
        }
      }
    };

    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    for (let i = 8; i < size - 8; i += 1) {
      reserved[6]![i] = true;
      reserved[i]![6] = true;
      grid[6]![i] = i % 2 === 0;
      grid[i]![6] = i % 2 === 0;
    }

    const safe = payload || 'NEUROLINK';
    let state = hashSeed(safe);
    let idx = 0;
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (reserved[r]![c]) continue;
        state ^= safe.charCodeAt(idx % safe.length) + ((r * 31 + c * 17) & 0xff);
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        state >>>= 0;
        idx += 1;
        grid[r]![c] = (state & 3) === 0 || (state & 7) === 3;
      }
    }
    return grid;
  }, [payload]);

  const total = matrix.length + 4;

  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className="size-44"
    >
      <rect width={total} height={total} fill="#FFFFFF" rx="1.2" />
      {matrix.map((row, r) =>
        row.map((dark, c) =>
          dark ? (
            <rect key={`${r}-${c}`} x={c + 2} y={r + 2} width={1} height={1} fill="#111827" />
          ) : null,
        ),
      )}
    </svg>
  );
}

export function WalletPage() {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [sheetOrder, setSheetOrder] = useState<PaymentOrderItem | null>(null);
  const [creatingPkgId, setCreatingPkgId] = useState<string | null>(null);
  const [qrImgErr, setQrImgErr] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [sheetErr, setSheetErr] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const showToast = (kind: 'ok' | 'err', text: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ kind, text });
    if (kind === 'ok') {
      toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
    }
  };

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
    queryFn: () => paymentsApi.getPackages(),
    staleTime: 60_000,
  });

  const ordersQuery = useQuery({
    queryKey: ['payments', 'topup-orders'],
    queryFn: () => paymentsApi.getTopupOrders(),
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
    mutationFn: (pkgId: string) => paymentsApi.createTopupOrder({ packageId: pkgId }),
    onMutate: (pkgId) => {
      setCreatingPkgId(pkgId);
      setSheetErr(null);
    },
    onSuccess: (res) => {
      setQrImgErr(false);
      setSheetOrder(res.order);
      void queryClient.invalidateQueries({ queryKey: ['payments', 'topup-orders'] });
    },
    onError: (e) => showToast('err', errorMessage(e)),
    onSettled: () => setCreatingPkgId(null),
  });

  const simulateMut = useMutation({
    mutationFn: (orderCode: string) => paymentsApi.simulateOrderPaid(orderCode),
    onSuccess: (res) => {
      setSheetErr(null);
      setSheetOrder(res.order);
      showToast('ok', `+${res.order.creditsToGrant} Credit`);
      void queryClient.invalidateQueries({ queryKey: ['my-wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['payments', 'topup-orders'] });
    },
    onError: (e) => setSheetErr(errorMessage(e)),
  });

  const orders = ordersQuery.data?.orders ?? [];
  const activeOrder = useMemo(() => {
    if (!sheetOrder) return null;
    return orders.find((o) => o.orderCode === sheetOrder.orderCode) ?? sheetOrder;
  }, [orders, sheetOrder]);

  useEffect(() => {
    setQrImgErr(false);
    setSheetErr(null);
  }, [activeOrder?.orderCode]);

  if (walletQuery.isLoading) return <Spinner />;

  const wallet = walletQuery.data?.wallet;
  const txs = walletQuery.data?.transactions ?? [];
  const hasGrant = txs.some((t) => t.type === 'STARTER_GRANT');
  const packages = packagesQuery.data?.packages?.length
    ? packagesQuery.data.packages
    : FALLBACK_PACKAGES;
  const vndPerCredit = packagesQuery.data?.vndPerCredit ?? 1000;
  const bankInfo = packagesQuery.data?.bankInfo;
  const latestPendingOrder = orders.find((o) => o.status === 'PENDING') ?? null;

  const resolvedBankName = activeOrder?.bankName ?? bankInfo?.bankName ?? 'MB Bank';
  const resolvedAccountNo = activeOrder?.accountNo ?? bankInfo?.accountNo ?? '0888999777';
  const resolvedAccountName =
    activeOrder?.accountName ?? bankInfo?.accountName ?? 'CONG TY NEUROLINK VIET NAM';
  const isOrderPaid = activeOrder?.status === 'PAID';

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

      {/* Compact VietQR Top-Up Package Pills */}
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
            const busy = creatingPkgId === pkg.id && createOrderMut.isPending;
            return (
              <button
                key={pkg.id}
                type="button"
                disabled={createOrderMut.isPending}
                onClick={() => createOrderMut.mutate(pkg.id)}
                className="flex flex-col items-start justify-between gap-1.5 rounded-2xl border border-[#DCE6DF] bg-white p-3.5 text-left hover:border-[#16A34A] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
              >
                <div className="flex w-full items-center justify-between gap-1">
                  <span className="font-mono text-sm font-bold text-[#111827] tabular-nums">
                    {pkg.label}
                  </span>
                  {pkg.bonusCredits > 0 && (
                    <span className="rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[10px] font-bold text-[#15803D] tabular-nums">
                      +{pkg.bonusCredits}
                    </span>
                  )}
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#16A34A] tabular-nums">
                  {busy && <Loader2 className="size-3 animate-spin" aria-hidden />}
                  <span>+{pkg.credits} Credit</span>
                </span>
              </button>
            );
          })}
        </div>

        {latestPendingOrder && (
          <button
            type="button"
            onClick={() => setSheetOrder(latestPendingOrder)}
            className="flex w-full items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 px-3.5 py-2.5 text-left active:scale-[0.99] transition-transform cursor-pointer"
          >
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-900 truncate">
                Đơn chờ · <span className="font-mono">{latestPendingOrder.orderCode}</span>
              </p>
              <p className="text-[11px] text-amber-800/80 tabular-nums">
                {latestPendingOrder.amountVnd.toLocaleString('vi-VN')}đ · +{latestPendingOrder.creditsToGrant} Credit
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white border border-amber-200 px-3 py-1 text-[11px] font-semibold text-amber-900">
              Mở QR
            </span>
          </button>
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

      {/* Compact VietQR Bottom Sheet */}
      <BottomSheet
        open={Boolean(activeOrder)}
        onClose={() => setSheetOrder(null)}
        title="Mã VietQR"
        headerRight={
          activeOrder && (
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                isOrderPaid
                  ? 'border-[#86EFAC] bg-[#ECFDF3] text-[#15803D]'
                  : 'border-amber-200 bg-amber-50 text-amber-800',
              )}
            >
              {isOrderPaid ? 'Đã nạp' : 'Chờ CK'}
            </span>
          )
        }
      >
        {activeOrder && (
          <div className="space-y-4">
            {/* Centered Amount + QR Box */}
            <div className="flex flex-col items-center rounded-2xl border border-[#DCE6DF] bg-[#F5FAF7] p-4 text-center">
              <p className="font-mono text-xl font-bold text-[#111827] tabular-nums">
                {activeOrder.amountVnd.toLocaleString('vi-VN')} ₫
              </p>
              <p className="mt-0.5 text-xs font-semibold text-[#15803D] tabular-nums">
                +{activeOrder.creditsToGrant} Credit
                {activeOrder.bonusCredits > 0 ? ` (Tặng +${activeOrder.bonusCredits})` : ''}
              </p>

              <div className="mt-3 rounded-2xl border border-[#DCE6DF] bg-white p-2.5">
                {activeOrder.vietQrImageUrl && !qrImgErr ? (
                  <img
                    src={activeOrder.vietQrImageUrl}
                    alt={`VietQR ${activeOrder.orderCode}`}
                    onError={() => setQrImgErr(true)}
                    className="size-44 object-contain rounded-lg"
                  />
                ) : (
                  <CompactQrSvg
                    payload={activeOrder.qrPayload || activeOrder.orderCode}
                    label={`Mã VietQR ${activeOrder.orderCode}`}
                  />
                )}
              </div>
              <p className="mt-2 text-[11px] text-[#5B6860]">
                Quét bằng ứng dụng ngân hàng
                {!isOrderPaid && activeOrder.expiresAt
                  ? ` · Hết hạn ${new Date(activeOrder.expiresAt).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : ''}
              </p>
            </div>

            {/* Copyable Bank + Order Code Rows */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#DCE6DF] bg-white px-3.5 py-2.5">
                <div className="min-w-0">
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
                  className="inline-flex items-center gap-1 rounded-full border border-[#DCE6DF] bg-[#F5FAF7] px-3 h-8 text-[11px] font-semibold text-[#15803D] shrink-0 cursor-pointer"
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

              <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#86EFAC] bg-[#ECFDF3] px-3.5 py-2.5">
                <div className="min-w-0">
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
                  className="inline-flex items-center gap-1 rounded-full bg-[#16A34A] px-3 h-8 text-[11px] font-semibold text-white shrink-0 cursor-pointer"
                >
                  {copiedKey === 'code' ? (
                    <>
                      <Check className="size-3" aria-hidden /> Đã chép
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" aria-hidden /> Chép mã
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

            {isOrderPaid ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-center gap-1.5 rounded-2xl border border-[#BBF7D0] bg-[#ECFDF3] py-2.5 text-xs font-bold text-[#15803D]">
                  <CheckCircle2 className="size-4 text-[#16A34A]" aria-hidden />
                  <span>Đã cộng +{activeOrder.creditsToGrant} Credit vào ví</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSheetOrder(null)}
                  className="w-full h-11 rounded-full bg-[#14532D] text-sm font-semibold text-white cursor-pointer"
                >
                  Xong
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={simulateMut.isPending}
                onClick={() => simulateMut.mutate(activeOrder.orderCode)}
                className="flex w-full items-center justify-center gap-1.5 h-11 rounded-full bg-[#16A34A] hover:bg-[#15803D] text-xs font-semibold text-white active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {simulateMut.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Zap className="size-4" aria-hidden />
                )}
                <span>Xác nhận nạp thử nghiệm</span>
              </button>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
