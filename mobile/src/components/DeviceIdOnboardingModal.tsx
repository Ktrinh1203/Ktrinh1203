import { useEffect, useState, type FormEvent } from 'react';
import { Bluetooth, Cpu, X } from 'lucide-react';
import {
  ensureNativeBluetoothEnabled,
  getPairedDeviceId,
  normalizeDeviceId,
  setPairedDeviceId,
} from '../lib/bleProtocol';

/**
 * First-launch Device ID onboarding & automatic Bluetooth prompt on every subsequent open.
 * - First launch (no paired Device ID): prompts user once to enter unique ID (e.g. NL-205840).
 * - Subsequent launches (ID already saved): never prompts again; automatically prompts Android
 *   to enable Bluetooth if it is off so BLE auto-connects silently.
 */
export function DeviceIdOnboardingModal() {
  const [pairedId, setPairedId] = useState<string>(() => getPairedDeviceId());
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [inputVal, setInputVal] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // On subsequent launches when Device ID is already saved, immediately ensure Bluetooth is ON
  useEffect(() => {
    if (!pairedId) return;
    void ensureNativeBluetoothEnabled().catch(() => undefined);
  }, [pairedId]);

  if (pairedId || dismissed) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned = normalizeDeviceId(inputVal);
    if (cleaned.length < 4) {
      setErr('Nhập đúng mã ID thiết bị (ví dụ: NL-205840).');
      return;
    }
    setSaving(true);
    setErr(null);
    const saved = setPairedDeviceId(cleaned);
    setPairedId(saved);
    try {
      await ensureNativeBluetoothEnabled();
    } catch {
      // User can still enable Bluetooth when connecting
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Liên kết mã thiết bị NeuroLink lần đầu"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B2A1A]/55 backdrop-blur-xs px-5"
    >
      <div className="w-full max-w-[340px] rounded-3xl border border-[#DCE6DF] bg-white p-5 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-[#ECFDF3] text-[#16A34A] border border-[#BBF7D0] shrink-0">
              <Cpu className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-[#111827] leading-tight">
                Liên kết thiết bị lần đầu
              </h2>
              <p className="text-[11px] text-[#5B6860] mt-0.5">
                Mỗi thiết bị có một mã ID riêng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Bỏ qua"
            className="p-1.5 rounded-full text-[#5B6860] hover:bg-[#F5FAF7] cursor-pointer"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <p className="text-xs text-[#374151] leading-relaxed">
          Nhập mã ID hiển thị trên màn hình thiết bị (ví dụ{' '}
          <span className="font-mono font-bold text-[#15803D]">NL-205840</span>). Từ lần sau app sẽ
          tự bật Bluetooth và tự động kết nối không cần hỏi lại.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <div>
            <label
              htmlFor="onboarding-device-id"
              className="block text-[11px] font-semibold text-[#111827] mb-1"
            >
              Mã ID thiết bị
            </label>
            <input
              id="onboarding-device-id"
              type="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              value={inputVal}
              onChange={(e) => {
                setInputVal(e.target.value.toUpperCase());
                setErr(null);
              }}
              placeholder="VD: NL-205840"
              className="w-full h-11 rounded-xl border border-[#DCE6DF] bg-[#FAFDFB] px-3.5 font-mono text-sm font-semibold text-[#111827] tracking-wider placeholder:font-sans placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:border-[#16A34A]"
            />
          </div>

          {err && (
            <p className="text-[11px] text-red-700 bg-red-50 rounded-lg px-2.5 py-1.5 font-medium">
              {err}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full h-11 rounded-full bg-[#16A34A] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-[#15803D] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
          >
            <Bluetooth className="size-4" aria-hidden />
            <span>{saving ? 'Đang lưu...' : 'Lưu & Tự động kết nối'}</span>
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="w-full py-1.5 text-[11px] font-medium text-[#5B6860] hover:text-[#111827] cursor-pointer"
          >
            Để sau
          </button>
        </form>
      </div>
    </div>
  );
}
