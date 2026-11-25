import { Bluetooth, CloudUpload, Database, Radio, Wifi, WifiOff } from 'lucide-react';
import { cn } from './ui';
import type { BleLinkStatus, BleStreamMode, BleTelemetrySnapshot } from '../hooks/useBleFieldSync';
import type { NetworkSyncStatus, PendingBleBatch } from '../lib/offlineSyncQueue';

interface BleFieldSyncCardProps {
  webBluetoothAvailable: boolean;
  bleStatus: BleLinkStatus;
  bleDeviceName: string | null;
  bleTelemetry: BleTelemetrySnapshot | null;
  bleStreamMode: BleStreamMode;
  onChangeBleStreamMode: (mode: BleStreamMode) => void;
  pendingBatches: PendingBleBatch[];
  wifiOnly: boolean;
  onToggleWifiOnly: (next: boolean) => void;
  networkStatus: NetworkSyncStatus;
  syncing: boolean;
  lastSyncAt: string | null;
  statusMessage: string | null;
  onConnectBle: () => void;
  onDisconnectBle: () => void;
  onSimulateBle: (scenario: 'normal' | 'stroke_alert') => void;
  onForceSync: () => void;
}

export function BleFieldSyncCard({
  webBluetoothAvailable,
  bleStatus,
  bleDeviceName,
  bleTelemetry,
  bleStreamMode,
  onChangeBleStreamMode,
  pendingBatches,
  wifiOnly,
  onToggleWifiOnly,
  networkStatus,
  syncing,
  lastSyncAt,
  statusMessage,
  onConnectBle,
  onDisconnectBle,
  onSimulateBle,
  onForceSync,
}: BleFieldSyncCardProps) {
  const isConnected = bleStatus === 'connected';
  const totalQueuedSamples = pendingBatches.reduce((sum, b) => sum + b.samples.length, 0);

  return (
    <section
      aria-label="Chế độ đeo 24/7 qua Bluetooth BLE và đồng bộ Wi-Fi"
      className="rounded-2xl border border-[#DCE6DF] bg-white p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Bluetooth className="size-4 text-[#16A34A] shrink-0" aria-hidden />
            <h3 className="text-[14px] font-bold text-[#111827] truncate">
              BLE ngoài đường
            </h3>
          </div>
          <p className="mt-0.5 text-[11px] text-[#5B6860]">
            ESP32 gửi BLE tiết kiệm pin → lưu vào máy → tự đồng bộ khi có Wi-Fi.
          </p>
        </div>

        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
            networkStatus.wifiReady
              ? 'bg-[#ECFDF3] text-[#15803D]'
              : networkStatus.online
                ? 'bg-amber-50 text-amber-800'
                : 'bg-slate-100 text-[#5B6860]',
          )}
        >
          {networkStatus.online ? (
            <Wifi className="size-3" aria-hidden />
          ) : (
            <WifiOff className="size-3" aria-hidden />
          )}
          <span>
            {!networkStatus.online
              ? 'Ngoại tuyến'
              : networkStatus.wifiReady
                ? 'Sẵn sàng đồng bộ'
                : 'Chờ Wi-Fi'}
          </span>
        </span>
      </div>

      {/* Live BLE telemetry summary if received */}
      {bleTelemetry && (
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#F5FAF7] px-3 py-2 text-center">
          <div>
            <span className="block text-[10px] text-[#5B6860]">Pin BLE</span>
            <span className="font-mono text-xs font-bold text-[#111827]">
              {bleTelemetry.batPct ?? '--'}%
            </span>
          </div>
          <div>
            <span className="block text-[10px] text-[#5B6860]">Tần số</span>
            <span className="font-mono text-xs font-bold text-[#111827]">
              {bleTelemetry.rateSps ?? 250} Hz
            </span>
          </div>
          <div>
            <span className="block text-[10px] text-[#5B6860]">Edge AI</span>
            <span className="text-xs font-bold text-[#15803D] truncate block">
              {bleTelemetry.aiState ?? 'NORMAL'}
            </span>
          </div>
        </div>
      )}

      {/* Auto Power-Save vs Realtime Stream Switcher */}
      <div className="rounded-xl border border-[#EDF3EF] bg-[#FAFDFB] p-2.5 space-y-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onChangeBleStreamMode('auto')}
            className={cn(
              'h-8 rounded-lg text-[11px] font-semibold transition-all cursor-pointer',
              bleStreamMode === 'auto'
                ? 'bg-[#16A34A] text-white shadow-xs'
                : 'bg-white text-[#5B6860] border border-[#DCE6DF]',
            )}
          >
            Auto · Tiết kiệm pin
          </button>
          <button
            type="button"
            onClick={() => onChangeBleStreamMode('realtime')}
            className={cn(
              'h-8 rounded-lg text-[11px] font-semibold transition-all cursor-pointer',
              bleStreamMode === 'realtime'
                ? 'bg-[#111827] text-white shadow-xs'
                : 'bg-white text-[#5B6860] border border-[#DCE6DF]',
            )}
          >
            Realtime · Sóng 250Hz
          </button>
        </div>
        <p className="text-[10px] text-[#5B6860]">
          {bleStreamMode === 'auto'
            ? 'Auto: chỉ gửi gói sóng 8 giây khi Edge AI trên mạch phát hiện bất thường.'
            : 'Realtime: truyền sóng 8 kênh liên tục về điện thoại để xem trực tiếp.'}
        </p>
      </div>

      {/* Connect BLE + Simulate buttons */}
      <div className="grid grid-cols-2 gap-2">
        {isConnected ? (
          <button
            type="button"
            onClick={onDisconnectBle}
            className="inline-flex items-center justify-center gap-1.5 h-10 rounded-full border border-red-200 bg-red-50 text-xs font-semibold text-red-700 active:scale-95 transition-all cursor-pointer"
          >
            <Bluetooth className="size-3.5" aria-hidden />
            <span>Ngắt {bleDeviceName ?? 'BLE'}</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={!webBluetoothAvailable || bleStatus === 'connecting'}
            onClick={onConnectBle}
            className="inline-flex items-center justify-center gap-1.5 h-10 rounded-full bg-[#16A34A] text-xs font-semibold text-white hover:bg-[#15803D] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <Bluetooth className="size-3.5" aria-hidden />
            <span>{bleStatus === 'connecting' ? 'Đang ghép đôi...' : 'Ghép ESP32 BLE'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onSimulateBle('normal')}
          className="inline-flex items-center justify-center gap-1.5 h-10 rounded-full border border-[#DCE6DF] bg-[#F5FAF7] text-xs font-semibold text-[#111827] hover:border-[#16A34A] active:scale-95 transition-all cursor-pointer"
        >
          <Radio className="size-3.5 text-[#16A34A]" aria-hidden />
          <span>Giả lập BLE</span>
        </button>
      </div>

      {!webBluetoothAvailable && (
        <p className="text-[11px] text-amber-800 bg-amber-50 rounded-lg px-2.5 py-1.5">
          Trình duyệt này chưa bật Web Bluetooth (dùng Chrome Android hoặc APK Capacitor). Bạn vẫn có thể test bằng nút Giả lập BLE.
        </p>
      )}

      {/* Offline Queue & Wi-Fi Auto-Sync Controls */}
      <div className="rounded-xl border border-[#EDF3EF] bg-[#FAFDFB] p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#111827] min-w-0 truncate">
            <Database className="size-3.5 text-[#16A34A] shrink-0" aria-hidden />
            <span className="truncate">Bộ nhớ ngoại tuyến</span>
          </span>
          <span className="font-mono text-[11px] font-bold text-[#15803D] tabular-nums whitespace-nowrap shrink-0">
            {pendingBatches.length} gói · {totalQueuedSamples} mẫu
          </span>
        </div>

        <label className="flex items-center justify-between gap-2 text-[11px] text-[#5B6860] cursor-pointer">
          <span>Chỉ tự động đẩy lên server khi có Wi-Fi</span>
          <input
            type="checkbox"
            checked={wifiOnly}
            onChange={(e) => onToggleWifiOnly(e.target.checked)}
            className="size-4 accent-[#16A34A] rounded cursor-pointer"
          />
        </label>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="text-[10px] text-[#5B6860]">
            {lastSyncAt ? `Đồng bộ gần nhất: ${lastSyncAt}` : 'Chưa phát sinh đồng bộ mới'}
          </span>
          <button
            type="button"
            disabled={syncing || pendingBatches.length === 0 || !networkStatus.online}
            onClick={onForceSync}
            className="inline-flex items-center gap-1 rounded-full bg-[#111827] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40 cursor-pointer"
          >
            <CloudUpload className="size-3" aria-hidden />
            <span>{syncing ? 'Đang đẩy...' : 'Đồng bộ ngay'}</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <p className="text-[11px] text-[#15803D] bg-[#ECFDF3] rounded-lg px-2.5 py-1.5 font-medium">
          {statusMessage}
        </p>
      )}
    </section>
  );
}
