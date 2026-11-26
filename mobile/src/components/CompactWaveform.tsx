import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { cn } from './ui';

export interface CompactWaveformProps {
  waveforms: {
    time: number[];
    channels: string[];
    raw?: Record<string, number[]>;
    filtered: Record<string, number[]>;
  };
  dark?: boolean;
  plainLanguage?: boolean;
}

/**
 * Touch-native 6-lead EEG viewer designed specifically for 375–430px phone screens.
 * Supports tap/drag scrubbing across traces, live playback sweep, and filtered/raw switch.
 */
export function CompactWaveform({ waveforms, dark = false, plainLanguage = false }: CompactWaveformProps) {
  const hasRaw = Boolean(waveforms.raw && Object.keys(waveforms.raw).length > 0);
  const [mode, setMode] = useState<'filtered' | 'raw'>('filtered');
  const [scaleMode, setScaleMode] = useState<'auto' | 'fixed'>('auto');
  const [playing, setPlaying] = useState(false);
  const [scrubIdx, setScrubIdx] = useState<number | null>(null);
  const [sweep, setSweep] = useState(0);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef(false);

  const channels = (waveforms.channels.length > 0 ? waveforms.channels : ['F3', 'F4', 'C3', 'C4', 'O1', 'O2', 'T3', 'T4']).slice(0, 8);
  const times = waveforms.time;
  const nTotal = times.length;
  const activeMap = mode === 'raw' && hasRaw ? waveforms.raw! : waveforms.filtered;

  useEffect(() => {
    if (!playing || nTotal < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setSweep((p) => (p + dt / 4.5) % 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, nTotal]);

  const width = 360;
  const labelW = 34;
  const plotW = width - labelW - 8;
  const laneH = 34;
  const topPad = 6;
  const height = topPad + channels.length * laneH + 10;

  const channelGains = useMemo(() => {
    return channels.map((ch) => {
      if (scaleMode === 'fixed') return 55;
      const arr = activeMap[ch] ?? [];
      const absVals: number[] = [];
      for (let i = 0; i < arr.length; i++) {
        const v = arr[i];
        if (typeof v === 'number' && Number.isFinite(v)) {
          absVals.push(Math.abs(v));
        }
      }
      if (absVals.length === 0) return 25;
      absVals.sort((a, b) => a - b);
      const p95Idx = Math.min(absVals.length - 1, Math.floor(absVals.length * 0.95));
      const p95 = absVals[p95Idx] ?? 0;
      return Math.max(25, p95 * 1.15);
    });
  }, [channels, activeMap, scaleMode]);

  const paths = useMemo(() => {
    return channels.map((ch, idx) => {
      const arr = activeMap[ch] ?? [];
      const n = Math.min(arr.length, nTotal);
      if (n < 2) return '';
      const chGain = channelGains[idx] ?? 55;
      const pxPerUv = 13.5 / chGain;
      const step = Math.max(1, Math.floor(n / 150));
      const cy = topPad + idx * laneH + laneH / 2;
      const cmds: string[] = [];
      for (let i = 0; i < n; i += step) {
        const x = labelW + (i / (n - 1)) * plotW;
        const uv = Math.max(-chGain * 1.15, Math.min(chGain * 1.15, arr[i]!));
        const y = cy - uv * pxPerUv;
        cmds.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
      }
      return cmds.join(' ');
    });
  }, [channels, activeMap, nTotal, plotW, channelGains]);

  const activeIdx =
    scrubIdx !== null
      ? Math.max(0, Math.min(nTotal - 1, scrubIdx))
      : playing
        ? Math.min(nTotal - 1, Math.floor(sweep * nTotal))
        : null;

  const updateScrub = (clientX: number) => {
    if (!svgRef.current || nTotal < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const rx = ((clientX - rect.left) / rect.width) * width;
    const frac = Math.max(0, Math.min(1, (rx - labelW) / plotW));
    setScrubIdx(Math.round(frac * (nTotal - 1)));
    setPlaying(false);
  };

  const cursorX =
    activeIdx !== null && nTotal > 1
      ? labelW + (activeIdx / (nTotal - 1)) * plotW
      : null;

  const activeTimeSec = activeIdx !== null && times[activeIdx] !== undefined ? times[activeIdx]!.toFixed(2) : null;

  return (
    <div
      className={cn(
        'rounded-2xl border overflow-hidden',
        dark ? 'bg-[#0B2A1A] border-[#1B4A31] text-white' : 'bg-white border-[#DCE6DF] text-[#111827]',
      )}
    >
      {/* Slim control strip */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2 border-b text-xs',
          dark ? 'border-white/10' : 'border-[#EDF3EF]',
        )}
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setScrubIdx(null);
              setPlaying((v) => !v);
            }}
            aria-label={playing ? 'Tạm dừng' : 'Chạy sóng'}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 h-8 text-xs font-semibold transition-colors cursor-pointer',
              dark
                ? 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                : 'bg-[#ECFDF3] text-[#15803D] hover:bg-[#DCFCE7]',
            )}
          >
            {playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
            <span>{playing ? 'Dừng' : 'Chạy'}</span>
          </button>

          {hasRaw && (
            <button
              type="button"
              onClick={() => setMode((m) => (m === 'filtered' ? 'raw' : 'filtered'))}
              className={cn(
                'rounded-full px-2.5 h-8 text-xs font-medium border transition-colors cursor-pointer',
                dark
                  ? 'border-white/15 text-emerald-100/80 hover:bg-white/10'
                  : 'border-[#DCE6DF] text-[#5B6860] hover:bg-[#F5FAF7]',
              )}
            >
              {mode === 'filtered' ? 'Đã lọc nhiễu' : 'Tín hiệu gốc'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setScaleMode((s) => (s === 'auto' ? 'fixed' : 'auto'))}
            title={
              scaleMode === 'auto'
                ? 'Đang tự động phóng đại riêng từng kênh (bấm để về thang chung ±55µV)'
                : 'Đang dùng thang chung ±55µV (bấm để tự động từng kênh)'
            }
            aria-label={
              scaleMode === 'auto'
                ? 'Chuyển sang thang chung ±55µV'
                : 'Chuyển sang tự động từng kênh'
            }
            className={cn(
              'rounded-full px-2.5 h-8 text-xs font-medium border transition-colors cursor-pointer',
              dark
                ? 'border-white/15 text-emerald-100/80 hover:bg-white/10'
                : 'border-[#DCE6DF] text-[#5B6860] hover:bg-[#F5FAF7]',
            )}
          >
            {scaleMode === 'auto' ? 'Auto/CH' : '±55µV'}
          </button>
        </div>

        <span
          className={cn(
            'font-mono text-[11px] tabular-nums',
            dark ? 'text-emerald-200/80' : 'text-[#5B6860]',
          )}
        >
          {activeTimeSec ? `${activeTimeSec}s` : 'Chạm để soi'}
        </span>
      </div>

      {/* Interactive SVG Traces */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full h-auto touch-pan-y select-none cursor-crosshair"
        onPointerDown={(e) => {
          draggingRef.current = true;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // ignore synthetic pointer capture failures
          }
          updateScrub(e.clientX);
        }}
        onPointerMove={(e) => {
          if (draggingRef.current || e.buttons > 0) updateScrub(e.clientX);
        }}
        onPointerUp={(e) => {
          draggingRef.current = false;
          try {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
          } catch {
            // ignore
          }
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
        role="img"
        aria-label={plainLanguage ? `Biểu đồ sóng não ${channels.length} kênh` : `Biểu đồ sóng não ${channels.length} đạo trình`}
      >
        {/* Subtle vertical time grid */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={labelW + plotW * f}
            y1={topPad}
            x2={labelW + plotW * f}
            y2={height - 8}
            stroke={dark ? 'rgba(255,255,255,0.07)' : '#EDF3EF'}
            strokeWidth="1"
          />
        ))}

        {channels.map((ch, idx) => {
          const cy = topPad + idx * laneH + laneH / 2;
          const val = activeIdx !== null ? activeMap[ch]?.[activeIdx] : undefined;
          const chGain = channelGains[idx] ?? 55;
          const gainLabel =
            chGain >= 1000 ? `±${(chGain / 1000).toFixed(1)}kµV` : `±${Math.round(chGain)}µV`;
          return (
            <g key={ch}>
              <line
                x1={labelW}
                y1={cy}
                x2={width - 8}
                y2={cy}
                stroke={dark ? 'rgba(255,255,255,0.06)' : '#F2F7F4'}
                strokeWidth="1"
              />
              <text
                x={8}
                y={cy + 3.5}
                fontSize="10"
                fontWeight="600"
                fontFamily="JetBrains Mono, monospace"
                fill={dark ? '#A7F3D0' : '#4B5563'}
              >
                {ch}
              </text>
              <path
                d={paths[idx]}
                fill="none"
                stroke={dark ? '#34D399' : '#16A34A'}
                strokeWidth="1.35"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {val !== undefined && cursorX !== null ? (
                <text
                  x={width - 10}
                  y={cy - 7}
                  textAnchor="end"
                  fontSize="8.5"
                  fontFamily="JetBrains Mono, monospace"
                  fill={dark ? '#6EE7B7' : '#15803D'}
                >
                  {val.toFixed(0)}µV
                </text>
              ) : (
                <text
                  x={width - 10}
                  y={cy - 7}
                  textAnchor="end"
                  fontSize="8"
                  fontFamily="JetBrains Mono, monospace"
                  fill={dark ? 'rgba(167,243,208,0.65)' : '#6B7280'}
                >
                  {gainLabel}
                </text>
              )}
            </g>
          );
        })}

        {cursorX !== null && (
          <line
            x1={cursorX}
            y1={topPad}
            x2={cursorX}
            y2={height - 8}
            stroke={dark ? '#6EE7B7' : '#15803D'}
            strokeWidth="1.2"
            strokeDasharray="3 2"
          />
        )}
      </svg>
    </div>
  );
}
