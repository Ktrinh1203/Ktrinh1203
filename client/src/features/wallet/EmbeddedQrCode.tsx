import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlarmClock,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  QrCode,
  RefreshCw,
  XCircle,
  Zap,
} from 'lucide-react';
import { paymentsApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { PaymentOrderItem } from '../../api/types';
import { Button } from '../../components/ui';

/** Computes `serverNow - localNow` at the moment the timestamp is received. */
export function computeClockOffsetMs(serverNow?: string | null): number {
  if (!serverNow) return 0;
  const parsed = Date.parse(serverNow);
  if (!Number.isFinite(parsed)) return 0;
  return parsed - Date.now();
}

export function computeRemainingSeconds(expiresAt?: string | null, clockOffsetMs = 0): number {
  if (!expiresAt) return 0;
  const expiresMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresMs)) return 0;
  const estimatedServerNow = Date.now() + clockOffsetMs;
  return Math.max(0, Math.ceil((expiresMs - estimatedServerNow) / 1000));
}

export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function appendCacheBuster(url: string, nonce: number): string {
  if (nonce <= 0) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_retry=${nonce}`;
}

export interface EmbeddedQrCodeProps {
  order: PaymentOrderItem;
  serverNow?: string | null;
  orderTtlSeconds?: number;
  reminderWindowSeconds?: number;
  sandboxEnabled?: boolean;
  creatingNewOrder?: boolean;
  fallbackBankInfo?: {
    bankName?: string;
    accountNo?: string;
    accountName?: string;
  };
  onPaid?: (order: PaymentOrderItem) => void;
  onOrderUpdated?: (order: PaymentOrderItem, serverNow?: string) => void;
  onCreateNewOrder?: () => void;
  onClose?: () => void;
}

export function EmbeddedQrCode({
  order,
  serverNow,
  orderTtlSeconds,
  reminderWindowSeconds = 60,
  sandboxEnabled = false,
  creatingNewOrder = false,
  fallbackBankInfo,
  onPaid,
  onOrderUpdated,
  onCreateNewOrder,
  onClose,
}: EmbeddedQrCodeProps) {
  const queryClient = useQueryClient();

  const [syncedOrder, setSyncedOrder] = useState<PaymentOrderItem>(order);
  const [syncedServerNow, setSyncedServerNow] = useState<string | null | undefined>(serverNow);
  const [syncedReminderWindow, setSyncedReminderWindow] = useState<number | undefined>(
    reminderWindowSeconds,
  );

  const [imgFailed, setImgFailed] = useState(false);
  const [qrRetryNonce, setQrRetryNonce] = useState(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dismissedReminderOrderCode, setDismissedReminderOrderCode] = useState<string | null>(null);

  const expiredSyncOrderRef = useRef<string | null>(null);
  const paidHandledOrderRef = useRef<string | null>(null);
  const pollingInFlightRef = useRef(false);

  // Sync incoming props when parent selects or updates an order
  useEffect(() => {
    setSyncedOrder(order);
    setActionError(null);
    setImgFailed(false);
    setQrRetryNonce(0);
  }, [order.orderCode, order.status, order.expiresAt, order.paidAt]);

  useEffect(() => {
    if (serverNow) {
      setSyncedServerNow(serverNow);
    }
  }, [serverNow]);

  useEffect(() => {
    setSyncedReminderWindow(reminderWindowSeconds);
  }, [reminderWindowSeconds]);

  const clockOffsetMs = useMemo(() => computeClockOffsetMs(syncedServerNow), [syncedServerNow]);
  const effectiveReminderWindow = Math.max(1, syncedReminderWindow ?? reminderWindowSeconds ?? 60);

  const totalTtlSeconds = useMemo(() => {
    if (orderTtlSeconds && orderTtlSeconds > 0) return orderTtlSeconds;
    const createdMs = Date.parse(syncedOrder.createdAt);
    const expiresMs = Date.parse(syncedOrder.expiresAt);
    if (Number.isFinite(createdMs) && Number.isFinite(expiresMs) && expiresMs > createdMs) {
      return Math.max(60, Math.round((expiresMs - createdMs) / 1000));
    }
    return 600;
  }, [orderTtlSeconds, syncedOrder.createdAt, syncedOrder.expiresAt]);

  const [remainingSeconds, setRemainingSeconds] = useState<number>(() =>
    syncedOrder.status === 'PENDING'
      ? computeRemainingSeconds(syncedOrder.expiresAt, clockOffsetMs)
      : 0,
  );

  // Tick countdown every 1000ms synced to server clock offset
  useEffect(() => {
    if (syncedOrder.status !== 'PENDING') {
      setRemainingSeconds(0);
      return;
    }

    const updateRemaining = () => {
      setRemainingSeconds(computeRemainingSeconds(syncedOrder.expiresAt, clockOffsetMs));
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [syncedOrder.orderCode, syncedOrder.status, syncedOrder.expiresAt, clockOffsetMs]);

  const invalidateWalletCaches = () => {
    void queryClient.invalidateQueries({ queryKey: ['my-wallet'] });
    void queryClient.invalidateQueries({ queryKey: ['rewards'] });
    void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    void queryClient.invalidateQueries({ queryKey: ['payments'] });
  };

  // Poll GET /payments/topup-orders/:orderCode every 4s while PENDING
  useEffect(() => {
    if (syncedOrder.status !== 'PENDING' || remainingSeconds <= 0) {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      if (pollingInFlightRef.current || cancelled) return;
      pollingInFlightRef.current = true;
      try {
        const res = await paymentsApi.getTopupOrder(syncedOrder.orderCode);
        if (cancelled) return;
        setSyncedOrder(res.order);
        if (res.serverNow) setSyncedServerNow(res.serverNow);
        if (res.reminderWindowSeconds) setSyncedReminderWindow(res.reminderWindowSeconds);
        onOrderUpdated?.(res.order, res.serverNow);
        if (res.order.status !== 'PENDING') {
          void queryClient.invalidateQueries({ queryKey: ['payments', 'topup-orders'] });
        }
      } catch {
        // Silent retry on next 4s tick
      } finally {
        pollingInFlightRef.current = false;
      }
    };

    const interval = window.setInterval(() => {
      void poll();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [syncedOrder.orderCode, syncedOrder.status, remainingSeconds > 0, queryClient]);

  // When countdown reaches 0, sync EXPIRED state from server once
  useEffect(() => {
    if (syncedOrder.status !== 'PENDING' || remainingSeconds > 0) {
      return;
    }
    if (expiredSyncOrderRef.current === syncedOrder.orderCode) {
      return;
    }
    expiredSyncOrderRef.current = syncedOrder.orderCode;

    let cancelled = false;
    void paymentsApi
      .getTopupOrder(syncedOrder.orderCode)
      .then((res) => {
        if (cancelled) return;
        setSyncedOrder(res.order);
        if (res.serverNow) setSyncedServerNow(res.serverNow);
        onOrderUpdated?.(res.order, res.serverNow);
        void queryClient.invalidateQueries({ queryKey: ['payments', 'topup-orders'] });
      })
      .catch(() => {
        // UI still locks QR immediately on remainingSeconds === 0
      });

    return () => {
      cancelled = true;
    };
  }, [syncedOrder.orderCode, syncedOrder.status, remainingSeconds, queryClient]);

  // Handle PAID transition: refresh wallet + notify + auto-close cleanly
  useEffect(() => {
    if (syncedOrder.status !== 'PAID') return;
    if (paidHandledOrderRef.current !== syncedOrder.orderCode) {
      paidHandledOrderRef.current = syncedOrder.orderCode;
      invalidateWalletCaches();
      onPaid?.(syncedOrder);
    }
    if (!onClose) return;
    const closeTimer = window.setTimeout(() => {
      onClose();
    }, 1600);
    return () => window.clearTimeout(closeTimer);
  }, [syncedOrder.orderCode, syncedOrder.status]);

  const cancelMutation = useMutation({
    mutationFn: () => paymentsApi.cancelTopupOrder(syncedOrder.orderCode),
    onSuccess: (res) => {
      setActionError(null);
      setSyncedOrder(res.order);
      if (res.serverNow) setSyncedServerNow(res.serverNow);
      onOrderUpdated?.(res.order, res.serverNow);
      void queryClient.invalidateQueries({ queryKey: ['payments', 'topup-orders'] });
    },
    onError: (err) => {
      setActionError(errorMessage(err));
      void paymentsApi
        .getTopupOrder(syncedOrder.orderCode)
        .then((res) => {
          setSyncedOrder(res.order);
          if (res.serverNow) setSyncedServerNow(res.serverNow);
          onOrderUpdated?.(res.order, res.serverNow);
        })
        .catch(() => undefined);
    },
  });

  const simulateMutation = useMutation({
    mutationFn: () => paymentsApi.simulateOrderPaid(syncedOrder.orderCode),
    onSuccess: (res) => {
      setActionError(null);
      setSyncedOrder(res.order);
      onOrderUpdated?.(res.order);
      invalidateWalletCaches();
    },
    onError: (err) => {
      setActionError(errorMessage(err));
      void paymentsApi
        .getTopupOrder(syncedOrder.orderCode)
        .then((res) => {
          setSyncedOrder(res.order);
          if (res.serverNow) setSyncedServerNow(res.serverNow);
          onOrderUpdated?.(res.order, res.serverNow);
        })
        .catch(() => undefined);
    },
  });

  const copyValue = (key: string, value: string) => {
    void navigator.clipboard?.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 1800);
  };

  const resolvedBankName = syncedOrder.bankName || fallbackBankInfo?.bankName || 'MB Bank';
  const resolvedAccountNo = syncedOrder.accountNo || fallbackBankInfo?.accountNo || '0888999777';
  const resolvedAccountName =
    syncedOrder.accountName || fallbackBankInfo?.accountName || 'CONG TY NEUROLINK VIET NAM';

  const isPaid = syncedOrder.status === 'PAID';
  const isCancelled = syncedOrder.status === 'CANCELLED';
  const isExpired =
    syncedOrder.status === 'EXPIRED' || (syncedOrder.status === 'PENDING' && remainingSeconds <= 0);
  const isActivePending = syncedOrder.status === 'PENDING' && remainingSeconds > 0;
  const isFinalMinute = isActivePending && remainingSeconds <= effectiveReminderWindow;
  const isReminderOpen =
    isActivePending &&
    remainingSeconds > 0 &&
    remainingSeconds <= effectiveReminderWindow &&
    dismissedReminderOrderCode !== syncedOrder.orderCode;

  const progressPercent = isActivePending
    ? Math.max(0, Math.min(100, (remainingSeconds / Math.max(1, totalTtlSeconds)) * 100))
    : 0;

  const qrImageSrc = syncedOrder.vietQrImageUrl
    ? appendCacheBuster(syncedOrder.vietQrImageUrl, qrRetryNonce)
    : null;

  const statusBadge = isPaid
    ? {
        label: 'Đã thanh toán',
        className: 'bg-[#ECFDF3] text-[#15803D] border-[#86EFAC]',
      }
    : isExpired
      ? {
          label: 'Đã hết hạn',
          className: 'bg-[#F3F4F6] text-[#4B5563] border-[#D1D5DB]',
        }
      : isCancelled
        ? {
            label: 'Đơn đã hủy',
            className: 'bg-[#F3F4F6] text-[#4B5563] border-[#D1D5DB]',
          }
        : isFinalMinute
          ? {
              label: 'Sắp hết hạn',
              className: 'bg-red-50 text-red-700 border-red-200',
            }
          : {
              label: 'Chờ thanh toán',
              className: 'bg-amber-50 text-amber-800 border-amber-200',
            };

  return (
    <div className="space-y-4">
      {/* Top Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#DCE6DF]">
        <div className="flex items-center gap-2 min-w-0">
          <QrCode className="size-4 text-[#16A34A] shrink-0" aria-hidden />
          <span className="text-sm font-bold text-[#111827] truncate">
            Thanh toán VietQR · {syncedOrder.orderCode}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-full bg-[#ECFDF3] border border-[#BBF7D0] px-2.5 py-0.5 text-xs font-bold text-[#15803D] tabular-nums">
            +{syncedOrder.creditsToGrant.toLocaleString('vi-VN')} Credit
            {syncedOrder.bonusCredits > 0 ? ` (+${syncedOrder.bonusCredits} thưởng)` : ''}
          </span>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadge.className}`}
          >
            {statusBadge.label}
          </span>
        </div>
      </div>

      {/* 2-Column Clean Layout (Desktop) / Stacked (Mobile) */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5 items-start">
        {/* Left Column: QR Code + Server-Synced Countdown */}
        <div className="flex flex-col items-center space-y-3">
          <div className="relative w-full max-w-[232px] aspect-square rounded-xl border border-[#DCE6DF] bg-white p-3 flex items-center justify-center overflow-hidden">
            {qrImageSrc && !imgFailed ? (
              <img
                src={qrImageSrc}
                alt={`Mã VietQR cho đơn ${syncedOrder.orderCode}`}
                onError={() => setImgFailed(true)}
                className={`size-full object-contain rounded-lg transition-all duration-200 ${
                  isExpired || isCancelled ? 'blur-sm opacity-20 pointer-events-none select-none' : ''
                }`}
              />
            ) : (
              <div
                className={`flex flex-col items-center justify-center text-center px-2 space-y-2 ${
                  isExpired || isCancelled ? 'blur-sm opacity-20 pointer-events-none select-none' : ''
                }`}
              >
                <QrCode className="size-10 text-[#9CA3AF]" aria-hidden />
                <p className="text-xs font-semibold text-[#111827]">Không tải được ảnh QR</p>
                <p className="text-[11px] text-[#6B7280] leading-snug">
                  Vui lòng chuyển khoản thủ công bằng Số tài khoản và Nội dung bên cạnh.
                </p>
                {syncedOrder.vietQrImageUrl && !isExpired && !isCancelled && !isPaid && (
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    icon={<RefreshCw className="size-3" aria-hidden />}
                    onClick={() => {
                      setImgFailed(false);
                      setQrRetryNonce((n) => n + 1);
                    }}
                  >
                    Tải lại ảnh QR
                  </Button>
                )}
              </div>
            )}

            {(isExpired || isCancelled) && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/55 p-3">
                <span className="rounded-lg border border-[#D1D5DB] bg-[#111827]/90 px-3 py-1.5 text-center text-xs font-bold tracking-wide text-white shadow-sm">
                  {isExpired ? 'MÃ QR ĐÃ HẾT HẠN' : 'ĐƠN ĐÃ HỦY'}
                </span>
              </div>
            )}
          </div>

          {/* Countdown + Progress Bar */}
          {isActivePending ? (
            <div className="w-full max-w-[232px] space-y-1.5">
              <div className="flex items-center justify-between text-xs tabular-nums">
                <span className="inline-flex items-center gap-1 text-[#6B7280] font-medium">
                  <Clock
                    className={`size-3.5 ${isFinalMinute ? 'text-red-600' : 'text-[#16A34A]'}`}
                    aria-hidden
                  />
                  Thời gian còn lại
                </span>
                <span
                  className={`font-mono text-sm font-bold ${
                    isFinalMinute ? 'text-red-600' : 'text-[#111827]'
                  }`}
                >
                  {formatCountdown(remainingSeconds)}
                </span>
              </div>
              <div
                className="h-1.5 w-full rounded-full bg-[#E5E7EB] overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={totalTtlSeconds}
                aria-valuenow={remainingSeconds}
                aria-label="Thời gian hiệu lực mã QR còn lại"
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isFinalMinute ? 'bg-red-500' : 'bg-[#16A34A]'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-center text-[#6B7280]">
                Quét bằng ứng dụng ngân hàng bất kỳ
              </p>
            </div>
          ) : isPaid ? (
            <p className="text-xs font-medium text-[#15803D] text-center">
              Hệ thống đã ghi nhận giao dịch
            </p>
          ) : (
            <p className="text-xs text-[#6B7280] text-center">
              {isExpired
                ? 'Vui lòng tạo mã QR mới để tiếp tục nạp Credit.'
                : 'Đơn nạp này đã được hủy.'}
            </p>
          )}
        </div>

        {/* Right Column: Single Consolidated Bank Transfer Block + Actions */}
        <div className="min-w-0 space-y-3.5">
          <div className="rounded-xl border border-[#DCE6DF] bg-[#F8FBF9] divide-y divide-[#DCE6DF] text-xs sm:text-sm">
            <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
              <span className="text-[#6B7280] shrink-0">Ngân hàng</span>
              <span className="font-semibold text-[#111827] text-right truncate">
                {resolvedBankName}
              </span>
            </div>

            <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
              <span className="text-[#6B7280] shrink-0">Chủ tài khoản</span>
              <span className="font-semibold text-[#111827] text-right truncate">
                {resolvedAccountName}
              </span>
            </div>

            <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[11px] text-[#6B7280] block">Số tài khoản</span>
                <span className="font-mono font-bold text-sm text-[#111827] tabular-nums">
                  {resolvedAccountNo}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyValue('accountNo', resolvedAccountNo)}
                className="inline-flex items-center gap-1 rounded-md border border-[#DCE6DF] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#15803D] hover:bg-[#ECFDF3] transition-colors shrink-0"
              >
                {copiedKey === 'accountNo' ? (
                  <>
                    <Check className="size-3" aria-hidden /> Đã chép
                  </>
                ) : (
                  <>
                    <Copy className="size-3" aria-hidden /> Sao chép
                  </>
                )}
              </button>
            </div>

            <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
              <span className="text-[#6B7280] shrink-0">Số tiền</span>
              <span className="font-mono font-bold text-sm sm:text-base text-[#111827] tabular-nums">
                {syncedOrder.amountVnd.toLocaleString('vi-VN')} ₫
              </span>
            </div>

            <div className="px-3.5 py-2.5 flex items-center justify-between gap-3 bg-[#ECFDF3]/70">
              <div className="min-w-0">
                <span className="text-[11px] font-medium text-[#15803D] block">
                  Nội dung chuyển khoản
                </span>
                <span className="font-mono font-bold text-sm text-[#14532D] tracking-wide select-all">
                  {syncedOrder.orderCode}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyValue('orderCode', syncedOrder.orderCode)}
                className="inline-flex items-center gap-1 rounded-md bg-[#16A34A] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#15803D] transition-colors shrink-0"
              >
                {copiedKey === 'orderCode' ? (
                  <>
                    <Check className="size-3" aria-hidden /> Đã chép
                  </>
                ) : (
                  <>
                    <Copy className="size-3" aria-hidden /> Sao chép
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Terminal / Active State Actions */}
          {isPaid ? (
            <div className="rounded-xl border border-[#86EFAC] bg-[#ECFDF3] px-3.5 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#15803D]">
                <CheckCircle2 className="size-4 text-[#16A34A] shrink-0" aria-hidden />
                <span>
                  Thanh toán thành công · Đã cộng +{syncedOrder.creditsToGrant.toLocaleString('vi-VN')}{' '}
                  Credit
                </span>
              </div>
              {onClose && (
                <Button type="button" size="xs" variant="secondary" onClick={onClose}>
                  Đóng
                </Button>
              )}
            </div>
          ) : isExpired || isCancelled ? (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B7280]">
                <XCircle className="size-4 text-[#9CA3AF] shrink-0" aria-hidden />
                {isExpired ? 'Mã QR đã hết hiệu lực' : 'Đơn đã hủy'}
              </span>
              <div className="flex items-center gap-2">
                {onClose && (
                  <Button type="button" size="sm" variant="ghost" onClick={onClose}>
                    Đóng
                  </Button>
                )}
                {onCreateNewOrder && (
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    loading={creatingNewOrder}
                    icon={<RefreshCw className="size-3.5" aria-hidden />}
                    onClick={onCreateNewOrder}
                  >
                    Tạo mã QR mới
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                size="xs"
                variant="outline"
                loading={cancelMutation.isPending}
                disabled={simulateMutation.isPending}
                onClick={() => cancelMutation.mutate()}
              >
                Hủy đơn
              </Button>

              {sandboxEnabled && (
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  loading={simulateMutation.isPending}
                  disabled={cancelMutation.isPending}
                  onClick={() => simulateMutation.mutate()}
                  icon={<Zap className="size-3.5" aria-hidden />}
                >
                  Xác nhận thanh toán thử (Sandbox)
                </Button>
              )}
            </div>
          )}

          {actionError && (
            <p className="text-xs text-red-600" role="alert">
              {actionError}
            </p>
          )}
        </div>
      </div>

      {/* Final 1-Minute Payment Reminder Popup */}
      {isReminderOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 backdrop-blur-[1px] p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="qr-reminder-title"
          aria-describedby="qr-reminder-desc"
        >
          <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 border border-amber-200 text-red-600">
                <AlarmClock className="size-5" aria-hidden />
              </div>
              <div className="min-w-0 space-y-1">
                <h3 id="qr-reminder-title" className="text-base font-bold text-[#111827]">
                  Sắp hết thời gian thanh toán!
                </h3>
                <p className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 font-mono text-xs font-bold text-red-700 tabular-nums">
                  Còn {formatCountdown(remainingSeconds)}
                </p>
              </div>
            </div>

            <p id="qr-reminder-desc" className="text-xs sm:text-sm text-[#4B5563] leading-relaxed">
              Mã QR cho đơn <strong className="font-mono text-[#111827]">{syncedOrder.orderCode}</strong>{' '}
              sẽ hết hiệu lực sau chưa đầy 1 phút. Nếu bạn đang mở ứng dụng ngân hàng, hãy hoàn tất
              chuyển khoản ngay để hệ thống tự động cộng Credit.
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-[#E5E7EB]">
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={cancelMutation.isPending}
                disabled={creatingNewOrder}
                onClick={() => cancelMutation.mutate()}
              >
                Hủy đơn
              </Button>
              {onCreateNewOrder && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  loading={creatingNewOrder}
                  disabled={cancelMutation.isPending}
                  onClick={() => {
                    setDismissedReminderOrderCode(syncedOrder.orderCode);
                    onCreateNewOrder();
                  }}
                >
                  Tạo mã QR mới
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => setDismissedReminderOrderCode(syncedOrder.orderCode)}
              >
                Tiếp tục quét QR
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
