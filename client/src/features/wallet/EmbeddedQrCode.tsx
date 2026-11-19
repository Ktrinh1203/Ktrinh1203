import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCircle2, Copy, QrCode, Zap } from 'lucide-react';
import { paymentsApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type { PaymentOrderStatus } from '../../api/types';
import { Button, Card } from '../../components/ui';

function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 0x9e3779b9;
}

function buildQrMatrix(payload: string): boolean[][] {
  const size = 25;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const placeFinder = (rowOffset: number, colOffset: number) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const rr = rowOffset + r;
        const cc = colOffset + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        reserved[rr][cc] = true;
        const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const onOuterBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const inInnerCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[rr][cc] = inOuter && (onOuterBorder || inInnerCore);
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i += 1) {
    reserved[6][i] = true;
    reserved[i][6] = true;
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Alignment pattern at (16..20, 16..20)
  for (let r = 16; r <= 20; r += 1) {
    for (let c = 16; c <= 20; c += 1) {
      reserved[r][c] = true;
      const onBorder = r === 16 || r === 20 || c === 16 || c === 20;
      const isCenter = r === 18 && c === 18;
      matrix[r][c] = onBorder || isCenter;
    }
  }

  let state = hashSeed(payload || 'NEUROLINK');
  let charIdx = 0;
  const safePayload = payload || 'NEUROLINK';

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (reserved[r][c]) continue;
      state ^= safePayload.charCodeAt(charIdx % safePayload.length) + ((r * 31 + c * 17) & 0xff);
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      charIdx += 1;
      matrix[r][c] = (state & 3) === 0 || (state & 7) === 3;
    }
  }

  return matrix;
}

export function DeterministicQrMatrixSvg({
  payload,
  label = 'Mã QR thanh toán',
  className = 'size-44',
}: {
  payload: string;
  label?: string;
  className?: string;
}) {
  const matrix = useMemo(() => buildQrMatrix(payload), [payload]);
  const size = matrix.length;
  const quiet = 2;
  const total = size + quiet * 2;

  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={total} height={total} fill="#FFFFFF" rx="1.2" />
      {matrix.map((row, r) =>
        row.map((dark, c) =>
          dark ? (
            <rect
              key={`${r}-${c}`}
              x={c + quiet}
              y={r + quiet}
              width={1}
              height={1}
              fill="#111827"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

export interface EmbeddedQrCodeProps {
  orderCode: string;
  amountVnd: number;
  creditsToGrant: number;
  bonusCredits?: number;
  status: PaymentOrderStatus;
  qrPayload: string;
  vietQrImageUrl?: string | null;
  bankName?: string | null;
  accountNo?: string | null;
  accountName?: string | null;
  expiresAt?: string | null;
  onPaid?: () => void;
}

export function EmbeddedQrCode({
  orderCode,
  amountVnd,
  creditsToGrant,
  bonusCredits = 0,
  status,
  qrPayload,
  vietQrImageUrl,
  bankName,
  accountNo,
  accountName,
  expiresAt,
  onPaid,
}: EmbeddedQrCodeProps) {
  const queryClient = useQueryClient();
  const [imgFailed, setImgFailed] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  useEffect(() => {
    setImgFailed(false);
  }, [vietQrImageUrl, orderCode]);

  const copyValue = (key: string, value: string) => {
    void navigator.clipboard?.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 1800);
  };

  const simulateMutation = useMutation({
    mutationFn: () => paymentsApi.simulateOrderPaid(orderCode),
    onSuccess: () => {
      setSimError(null);
      void queryClient.invalidateQueries({ queryKey: ['rewards'] });
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['my-wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
      onPaid?.();
    },
    onError: (err) => setSimError(errorMessage(err)),
  });

  const resolvedBankName = bankName || 'MB Bank';
  const resolvedAccountNo = accountNo || '0888999777';
  const resolvedAccountName = accountName || 'CONG TY NEUROLINK VIET NAM';
  const isPaid = status === 'PAID';

  return (
    <Card className="p-4 sm:p-5 border-[#BBF7D0] bg-[#F5FAF7]">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#DCE6DF]">
        <div className="flex items-center gap-2">
          <QrCode className="size-4 text-[#16A34A] shrink-0" aria-hidden />
          <span className="text-sm font-bold text-[#111827]">Mã VietQR nạp Credit</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#ECFDF3] border border-[#BBF7D0] px-2.5 py-0.5 text-xs font-bold text-[#15803D] tabular-nums">
            +{creditsToGrant} Credit{bonusCredits > 0 ? ` (Tặng +${bonusCredits})` : ''}
          </span>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
              isPaid
                ? 'bg-[#16A34A] text-white border-[#16A34A]'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {isPaid ? 'Đã thanh toán' : 'Chờ chuyển khoản'}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 items-center">
        {/* QR Display Box */}
        <div className="mx-auto flex flex-col items-center rounded-xl border border-[#DCE6DF] bg-white p-3">
          {vietQrImageUrl && !imgFailed ? (
            <img
              src={vietQrImageUrl}
              alt={`VietQR ${orderCode}`}
              onError={() => setImgFailed(true)}
              className="size-44 object-contain rounded-lg"
            />
          ) : (
            <DeterministicQrMatrixSvg
              payload={qrPayload || orderCode}
              label={`Mã QR đơn ${orderCode}`}
              className="size-44"
            />
          )}
          <span className="mt-1.5 text-[11px] font-medium text-[#6B7280]">
            Quét bằng ứng dụng Ngân hàng
          </span>
        </div>

        {/* Copyable Bank Transfer Details */}
        <div className="space-y-2.5 text-xs">
          <div className="rounded-lg border border-[#DCE6DF] bg-white px-3 py-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[11px] text-[#6B7280] block">Ngân hàng</span>
              <span className="font-semibold text-[#111827] block truncate">
                {resolvedBankName} · {resolvedAccountName}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-[#DCE6DF] bg-white px-3 py-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[11px] text-[#6B7280] block">Số tài khoản</span>
              <span className="font-mono font-bold text-sm text-[#111827] tabular-nums">
                {resolvedAccountNo}
              </span>
            </div>
            <button
              type="button"
              onClick={() => copyValue('accountNo', resolvedAccountNo)}
              className="inline-flex items-center gap-1 rounded-md border border-[#DCE6DF] bg-[#F5FAF7] px-2.5 py-1 text-[11px] font-semibold text-[#15803D] hover:bg-[#ECFDF3] transition-colors shrink-0"
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

          <div className="rounded-lg border border-[#DCE6DF] bg-white px-3 py-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[11px] text-[#6B7280] block">Số tiền (VNĐ)</span>
              <span className="font-mono font-bold text-sm text-[#111827] tabular-nums">
                {amountVnd.toLocaleString('vi-VN')} ₫
              </span>
            </div>
            <button
              type="button"
              onClick={() => copyValue('amountVnd', String(amountVnd))}
              className="inline-flex items-center gap-1 rounded-md border border-[#DCE6DF] bg-[#F5FAF7] px-2.5 py-1 text-[11px] font-semibold text-[#15803D] hover:bg-[#ECFDF3] transition-colors shrink-0"
            >
              {copiedKey === 'amountVnd' ? (
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

          <div className="rounded-lg border border-[#86EFAC] bg-[#ECFDF3] px-3 py-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-[#15803D] block">
                Nội dung chuyển khoản
              </span>
              <span className="font-mono font-bold text-sm text-[#14532D] tracking-wide select-all">
                {orderCode}
              </span>
            </div>
            <button
              type="button"
              onClick={() => copyValue('orderCode', orderCode)}
              className="inline-flex items-center gap-1 rounded-md bg-[#16A34A] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#15803D] transition-colors shrink-0"
            >
              {copiedKey === 'orderCode' ? (
                <>
                  <Check className="size-3" aria-hidden /> Đã chép
                </>
              ) : (
                <>
                  <Copy className="size-3" aria-hidden /> Sao chép mã
                </>
              )}
            </button>
          </div>

          <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
            {expiresAt && !isPaid && (
              <span className="text-[11px] text-[#6B7280] tabular-nums">
                Hết hạn lúc {new Date(expiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}

            {isPaid ? (
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#15803D]">
                <CheckCircle2 className="size-4 text-[#16A34A]" aria-hidden />
                <span>Đã cộng +{creditsToGrant} Credit vào ví</span>
              </div>
            ) : (
              <Button
                type="button"
                size="xs"
                variant="secondary"
                loading={simulateMutation.isPending}
                onClick={() => simulateMutation.mutate()}
                icon={<Zap className="size-3.5" aria-hidden />}
              >
                Xác nhận thanh toán thử (Sandbox)
              </Button>
            )}
          </div>

          {simError && <p className="text-xs text-red-600">{simError}</p>}
        </div>
      </div>
    </Card>
  );
}
