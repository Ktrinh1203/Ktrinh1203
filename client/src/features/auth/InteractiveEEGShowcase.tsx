import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Cpu, Database, ShieldCheck, SlidersHorizontal, Waves } from 'lucide-react';

type BrainPresetId = 'alpha' | 'theta' | 'stroke' | 'bci';

interface BrainPreset {
  id: BrainPresetId;
  shortLabel: string;
  freqLabel: string;
  freq: number;
  amp: number;
  bsi: string;
  dar: string;
  badgeTone: 'emerald' | 'amber';
  note: string;
}

const BRAIN_PRESETS: BrainPreset[] = [
  {
    id: 'alpha',
    shortLabel: 'Tập trung · Alpha 10 Hz',
    freqLabel: '10 Hz · 32 µV',
    freq: 10,
    amp: 32,
    bsi: '0.08 · Cân bằng',
    dar: '1.2 · Bình thường',
    badgeTone: 'emerald',
    note: 'Nhịp Alpha 10 Hz ưu thế vùng chẩm O1/O2 khi thư thái tỉnh táo.',
  },
  {
    id: 'theta',
    shortLabel: 'Thư giãn · Theta 6 Hz',
    freqLabel: '6 Hz · 45 µV',
    freq: 6,
    amp: 45,
    bsi: '0.11 · Ổn định',
    dar: '1.6 · Nghỉ ngơi',
    badgeTone: 'emerald',
    note: 'Sóng Theta 6 Hz xuất hiện vùng trán-trung tâm khi thiền hoặc chợp mắt.',
  },
  {
    id: 'stroke',
    shortLabel: 'Cảnh báo Đột quỵ · Delta 2.5 Hz',
    freqLabel: '2.5 Hz · 85 µV',
    freq: 2.5,
    amp: 85,
    bsi: '0.42 · Lệch bán cầu trái',
    dar: '4.8 · Cảnh báo sóng chậm',
    badgeTone: 'amber',
    note: 'Sóng chậm Delta khu trú F3/C3 bán cầu trái — dấu hiệu sớm thiếu máu não.',
  },
  {
    id: 'bci',
    shortLabel: 'Điều khiển BCI · Mu 12 Hz',
    freqLabel: '12 Hz · 26 µV',
    freq: 12,
    amp: 26,
    bsi: '0.19 · ERD vận động C3',
    dar: '0.9 · Hoạt hóa vỏ não',
    badgeTone: 'emerald',
    note: 'Khử đồng bộ nhịp Mu 12 Hz tại C3 khi tưởng tượng cử động bàn tay phải.',
  },
];

interface ElectrodeNode {
  id: 'F3' | 'F4' | 'C3' | 'C4' | 'T3' | 'T4' | 'O1' | 'O2';
  x: number;
  y: number;
  region: string;
}

const ELECTRODES: ElectrodeNode[] = [
  { id: 'F3', x: 62, y: 52, region: 'Thùy trán trái' },
  { id: 'F4', x: 118, y: 52, region: 'Thùy trán phải' },
  { id: 'C3', x: 58, y: 90, region: 'Vận động trái' },
  { id: 'C4', x: 122, y: 90, region: 'Vận động phải' },
  { id: 'T3', x: 32, y: 90, region: 'Thái dương trái' },
  { id: 'T4', x: 148, y: 90, region: 'Thái dương phải' },
  { id: 'O1', x: 68, y: 134, region: 'Thùy chẩm trái' },
  { id: 'O2', x: 112, y: 134, region: 'Thùy chẩm phải' },
];

const FEATURE_PILLS = [
  {
    icon: Cpu,
    title: '8 kênh 250 SPS',
    desc: 'Chuẩn phần cứng ESP32 & ADS1299',
  },
  {
    icon: ShieldCheck,
    title: 'Bác sĩ xác thực CCHN',
    desc: 'Hội chẩn và đọc ca từ xa',
  },
  {
    icon: Database,
    title: 'Data Bank & Credit',
    desc: 'Sổ cái HMAC-SHA256 minh bạch',
  },
];

/** Compute synthesized microvolt value for a channel at time t in seconds. */
function computeSampleUv(
  chId: ElectrodeNode['id'],
  chIdx: number,
  t: number,
  preset: BrainPreset,
  notchEnabled: boolean,
): number {
  const phase = chIdx * 0.65;
  let freq = preset.freq;
  let amp = preset.amp;

  if (preset.id === 'stroke') {
    if (chId === 'F3' || chId === 'C3') {
      freq = 2.5;
      amp = 85;
    } else {
      freq = 9.5;
      amp = 24;
    }
  } else if (preset.id === 'alpha' && (chId === 'O1' || chId === 'O2')) {
    amp = 42;
  } else if (preset.id === 'bci' && chId === 'C3') {
    // Event-related desynchronization (ERD) modulation on left sensorimotor C3
    const erdMod = 0.45 + 0.35 * Math.sin(t * 1.4);
    amp = preset.amp * erdMod;
  }

  const fundamental = Math.sin(2 * Math.PI * freq * t + phase) * amp;
  const harmonic = Math.sin(2 * Math.PI * (freq * 1.85) * t + phase * 1.7) * (amp * 0.24);
  const drift = Math.sin(2 * Math.PI * 0.45 * t + chIdx) * (amp * 0.14);
  const ripple = Math.sin(2 * Math.PI * 19.3 * t + chIdx * 2.1) * 3.5;

  let val = fundamental + harmonic + drift + ripple;

  if (!notchEnabled) {
    // 50 Hz mains powerline hum (visually apparent when un-notched)
    val += Math.sin(2 * Math.PI * 50 * t + chIdx * 0.4) * 36;
  }

  return val;
}

export function InteractiveEEGShowcase() {
  const [presetId, setPresetId] = useState<BrainPresetId>('alpha');
  const [notchEnabled, setNotchEnabled] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<ElectrodeNode['id'] | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ presetId, notchEnabled, selectedChannel });

  useEffect(() => {
    stateRef.current = { presetId, notchEnabled, selectedChannel };
  }, [presetId, notchEnabled, selectedChannel]);

  const activePreset = useMemo(
    () => BRAIN_PRESETS.find((p) => p.id === presetId) ?? BRAIN_PRESETS[0],
    [presetId],
  );

  const activeElectrode = useMemo(
    () => (selectedChannel ? ELECTRODES.find((e) => e.id === selectedChannel) ?? null : null),
    [selectedChannel],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let cssWidth = canvas.clientWidth || 380;
    let cssHeight = canvas.clientHeight || 224;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      cssWidth = rect.width;
      cssHeight = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
    observer?.observe(canvas);

    const startTime = performance.now();

    const drawFrame = (now: number) => {
      const { presetId: curPresetId, notchEnabled: curNotch, selectedChannel: curSelected } =
        stateRef.current;
      const preset = BRAIN_PRESETS.find((p) => p.id === curPresetId) ?? BRAIN_PRESETS[0];
      const elapsedSec = (now - startTime) / 1000;
      const windowSec = 2.4;

      ctx.clearRect(0, 0, cssWidth, cssHeight);

      // Subtle clinical gridlines
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.08)';
      ctx.lineWidth = 1;
      const gridCols = 8;
      for (let c = 1; c < gridCols; c++) {
        const gx = (cssWidth / gridCols) * c;
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, cssHeight);
        ctx.stroke();
      }
      const gridRows = 4;
      for (let r = 1; r < gridRows; r++) {
        const gy = (cssHeight / gridRows) * r;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(cssWidth, gy);
        ctx.stroke();
      }

      const visibleChannels = curSelected
        ? ELECTRODES.filter((e) => e.id === curSelected)
        : ELECTRODES;

      const labelPad = 32;
      const drawWidth = Math.max(40, cssWidth - labelPad - 8);
      const rowHeight = cssHeight / visibleChannels.length;
      const samplesCount = Math.max(120, Math.min(260, Math.floor(drawWidth / 1.5)));

      visibleChannels.forEach((node, rowIdx) => {
        const chIdx = ELECTRODES.findIndex((e) => e.id === node.id);
        const baselineY = rowHeight * rowIdx + rowHeight / 2;
        const isStrokeFocal =
          preset.id === 'stroke' && (node.id === 'F3' || node.id === 'C3');

        // Channel baseline
        ctx.strokeStyle = 'rgba(236, 253, 243, 0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(labelPad, baselineY);
        ctx.lineTo(cssWidth - 6, baselineY);
        ctx.stroke();

        // Channel label on the left
        ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillStyle = isStrokeFocal ? '#FBBF24' : '#A7F3D0';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.id, 6, baselineY);

        // Waveform trace
        const scaleUvToPx = (rowHeight * 0.42) / 95;
        ctx.strokeStyle = isStrokeFocal ? '#F59E0B' : !curNotch ? '#6EE7B7' : '#34D399';
        ctx.lineWidth = curSelected ? 2 : isStrokeFocal ? 1.85 : 1.35;
        ctx.beginPath();

        for (let s = 0; s <= samplesCount; s++) {
          const frac = s / samplesCount;
          const x = labelPad + frac * drawWidth;
          const tSample = elapsedSec - (1 - frac) * windowSec;
          const uV = computeSampleUv(node.id, chIdx, tSample, preset, curNotch);
          const y = baselineY - uV * scaleUvToPx;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      rafId = requestAnimationFrame(drawFrame);
    };

    rafId = requestAnimationFrame(drawFrame);

    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
  }, []);

  return (
    <section aria-label="Trải nghiệm qEEG trực tiếp NeuroLink" className="space-y-4">
      {/* Concise Editorial Hero Header */}
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BBF7D0] bg-[#ECFDF3] px-3 py-1 text-[11px] font-semibold tracking-wide text-[#15803D]">
          <Activity className="size-3.5" aria-hidden="true" />
          TRẠM ĐIỆN NÃO ĐỊNH LƯỢNG qEEG 10-20 & HỘI CHẨN TỪ XA
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#141413] leading-tight">
          Giải mã sóng não trực tiếp. Kết nối bác sĩ thần kinh.
        </h2>
        <p className="text-xs sm:text-sm text-[#575652] leading-relaxed">
          Chạm vào sơ đồ điện cực 10-20 hoặc chuyển trạng thái não bộ bên dưới để trải nghiệm bộ lọc DSP trực tiếp.
        </p>
      </div>

      {/* Interactive Dark-Emerald Clinical Oscilloscope Card */}
      <div className="rounded-2xl border border-[#1E3A2B] bg-[#0D1B14] p-4 sm:p-5 text-[#ECFDF3] shadow-sm space-y-3.5">
        {/* Top Controls: Presets & 50 Hz Notch Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Trạng thái sóng não mẫu">
            {BRAIN_PRESETS.map((p) => {
              const active = p.id === presetId;
              const isAmber = p.badgeTone === 'amber';
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPresetId(p.id)}
                  aria-pressed={active}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                    active
                      ? isAmber
                        ? 'border-amber-400/70 bg-amber-500/20 text-amber-200'
                        : 'border-emerald-400/70 bg-emerald-500/20 text-emerald-100'
                      : 'border-[#1E3A2B] bg-[#12261C] text-[#A7C4B5] hover:border-emerald-500/40 hover:text-white'
                  }`}
                >
                  {p.shortLabel}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setNotchEnabled((v) => !v)}
            aria-pressed={notchEnabled}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
              notchEnabled
                ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                : 'border-amber-400/70 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
            }`}
          >
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            {notchEnabled ? 'Lọc nhiễu 50 Hz: BẬT' : 'Lọc nhiễu 50 Hz: TẮT (Nhiễu lưới điện)'}
          </button>
        </div>

        {/* Interactive Split Console: 2D SVG Head Map + 60fps Canvas */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch">
          {/* 10-20 SVG Cortical Head Map */}
          <div className="sm:col-span-4 rounded-xl border border-[#1E3A2B] bg-[#09140E] p-3 flex flex-col items-center justify-between gap-2">
            <div className="flex w-full items-center justify-between text-[10px] font-medium text-[#8BB39E]">
              <span>BẢN ĐỒ 10-20</span>
              {selectedChannel ? (
                <button
                  type="button"
                  onClick={() => setSelectedChannel(null)}
                  className="rounded bg-[#183325] px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200 hover:bg-[#1F4230]"
                >
                  Tất cả 8 kênh
                </button>
              ) : (
                <span>Chạm điện cực</span>
              )}
            </div>

            <svg
              viewBox="0 0 180 180"
              className="w-36 h-36 sm:w-40 sm:h-40 select-none"
              role="img"
              aria-label="Sơ đồ 8 điện cực não bộ chuẩn quốc tế 10-20"
            >
              {/* Ears & Nose orientation */}
              <ellipse cx="22" cy="90" rx="6" ry="16" fill="none" stroke="#1E3A2B" strokeWidth="2" />
              <ellipse cx="158" cy="90" rx="6" ry="16" fill="none" stroke="#1E3A2B" strokeWidth="2" />
              <path d="M 80 22 L 90 8 L 100 22" fill="none" stroke="#2D5A42" strokeWidth="2" strokeLinejoin="round" />

              {/* Head circle & anatomical crosshairs */}
              <circle cx="90" cy="92" r="68" fill="#0D1F16" stroke="#2D5A42" strokeWidth="2" />
              <line x1="90" y1="24" x2="90" y2="160" stroke="#1A3527" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="22" y1="92" x2="158" y2="92" stroke="#1A3527" strokeWidth="1" strokeDasharray="3 3" />

              {ELECTRODES.map((node) => {
                const isSelected = selectedChannel === node.id;
                const isStrokeFocal =
                  presetId === 'stroke' && (node.id === 'F3' || node.id === 'C3');

                return (
                  <g
                    key={node.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Chọn điện cực ${node.id} - ${node.region}`}
                    aria-pressed={isSelected}
                    onClick={() =>
                      setSelectedChannel((cur) => (cur === node.id ? null : node.id))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedChannel((cur) => (cur === node.id ? null : node.id));
                      }
                    }}
                    className="cursor-pointer focus:outline-none"
                  >
                    {isStrokeFocal && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r="16"
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth="1.5"
                        opacity="0.7"
                      >
                        <animate
                          attributeName="r"
                          values="12;19;12"
                          dur="1.5s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="0.85;0.15;0.85"
                          dur="1.5s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}

                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={isSelected ? 13 : 11}
                      fill={
                        isSelected
                          ? '#16A34A'
                          : isStrokeFocal
                            ? 'rgba(245, 158, 11, 0.28)'
                            : '#153123'
                      }
                      stroke={
                        isSelected ? '#86EFAC' : isStrokeFocal ? '#FBBF24' : '#34D399'
                      }
                      strokeWidth={isSelected ? '2' : '1.3'}
                    />
                    <text
                      x={node.x}
                      y={node.y + 3.5}
                      textAnchor="middle"
                      fontSize="8.5"
                      fontWeight="700"
                      fill={isSelected ? '#FFFFFF' : isStrokeFocal ? '#FDE68A' : '#ECFDF3'}
                    >
                      {node.id}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="w-full text-center text-[11px] font-medium text-[#A7C4B5] truncate">
              {activeElectrode
                ? `${activeElectrode.id} · ${activeElectrode.region}`
                : '8 kênh · Chuẩn 10-20'}
            </div>
          </div>

          {/* 60fps HTML5 Canvas Waveform Renderer */}
          <div className="sm:col-span-8 rounded-xl border border-[#1E3A2B] bg-[#07110C] p-2.5 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between px-1 text-[10px] font-medium text-[#8BB39E]">
              <span className="inline-flex items-center gap-1 text-emerald-300">
                <Waves className="size-3" aria-hidden="true" />
                {selectedChannel ? `Kênh đơn: ${selectedChannel}` : 'Đa kênh: 8/8 trực tiếp'}
              </span>
              <span>{activePreset.freqLabel}</span>
            </div>

            <canvas
              ref={canvasRef}
              className="w-full h-48 sm:h-52 block rounded-lg"
              aria-label="Biểu đồ sóng não thời gian thực 60 khung hình trên giây"
            />

            <p className="px-1 text-[11px] text-[#B7D7C6] leading-snug">
              {activePreset.note}
            </p>
          </div>
        </div>

        {/* Live Telemetry Footer Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#1E3A2B] text-[11px]">
          <div className="rounded-lg bg-[#09140E] px-2.5 py-1.5">
            <span className="block text-[10px] text-[#7DA892]">Chỉ số đối xứng BSI</span>
            <strong
              className={
                activePreset.badgeTone === 'amber' ? 'text-amber-300' : 'text-emerald-300'
              }
            >
              {activePreset.bsi}
            </strong>
          </div>
          <div className="rounded-lg bg-[#09140E] px-2.5 py-1.5">
            <span className="block text-[10px] text-[#7DA892]">Tỷ số Delta/Alpha</span>
            <strong
              className={
                activePreset.badgeTone === 'amber' ? 'text-amber-300' : 'text-emerald-300'
              }
            >
              {activePreset.dar}
            </strong>
          </div>
          <div className="rounded-lg bg-[#09140E] px-2.5 py-1.5">
            <span className="block text-[10px] text-[#7DA892]">Kênh hiển thị</span>
            <strong className="text-white">
              {activeElectrode ? `${activeElectrode.id} · ${activeElectrode.region}` : 'Tất cả 8 kênh'}
            </strong>
          </div>
          <div className="rounded-lg bg-[#09140E] px-2.5 py-1.5">
            <span className="block text-[10px] text-[#7DA892]">Tần số lấy mẫu</span>
            <strong className="text-emerald-200">250 SPS · 24-bit ADS1299</strong>
          </div>
        </div>
      </div>

      {/* 3 Minimalist Feature Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {FEATURE_PILLS.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="flex items-start gap-2.5 rounded-xl border border-[#DCE6DF] bg-white px-3 py-2.5"
            >
              <div className="mt-0.5 rounded-lg bg-[#ECFDF3] p-1.5 text-[#15803D] shrink-0">
                <Icon className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#141413]">{item.title}</p>
                <p className="text-[11px] text-[#6E6D68] leading-snug">{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
