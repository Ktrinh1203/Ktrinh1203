import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Pause, Play, SlidersHorizontal } from 'lucide-react';
import { cn } from '../../components/ui';
import { CHANNEL_ANATOMY_MAP } from './eegLabels';

export interface BrainWaveformViewerProps {
  waveforms: {
    time: number[];
    channels: string[];
    raw?: Record<string, number[]>;
    filtered: Record<string, number[]>;
  };
  samplingRateHz?: number;
  isProfessional?: boolean;
  title?: string;
  subtitle?: string;
}

type GainUv = 25 | 50 | 100;

export function BrainWaveformViewer({
  waveforms,
  samplingRateHz = 500,
  isProfessional = false,
  title = 'Biểu đồ Điện não Đa kênh (8 Đạo trình 10-20)',
  subtitle,
}: BrainWaveformViewerProps) {
  const hasRaw = Boolean(waveforms.raw && Object.keys(waveforms.raw).length > 0);
  const [signalMode, setSignalMode] = useState<'filtered' | 'raw'>('filtered');
  const [gainUv, setGainUv] = useState<GainUv>(50);
  const [isPaused, setIsPaused] = useState<boolean>(true);
  const [inspectIdx, setInspectIdx] = useState<number | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const sweepFractionRef = useRef<number>(0);
  const sweepLineRef = useRef<SVGLineElement | null>(null);
  const sweepDotRefs = useRef<(SVGCircleElement | null)[]>([]);
  const readoutTimeRef = useRef<HTMLSpanElement | null>(null);
  const readoutValRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const channels = waveforms.channels.length > 0 ? waveforms.channels : ['F3', 'F4', 'C3', 'C4', 'O1', 'O2', 'T3', 'T4'];
  const times = waveforms.time;
  const totalSamples = times.length;
  const durationSec = useMemo(() => {
    if (totalSamples < 2) return 5;
    const span = times[totalSamples - 1]! - times[0]!;
    return span > 0 ? span : 5;
  }, [times, totalSamples]);

  const activeSignals = signalMode === 'raw' && hasRaw ? waveforms.raw! : waveforms.filtered;

  useEffect(() => {
    if (!hasRaw && signalMode === 'raw') {
      setSignalMode('filtered');
    }
  }, [hasRaw, signalMode]);

  const svgWidth = 880;
  const laneHeight = 50;
  const topPad = 10;
  const bottomPad = 20;
  const labelWidth = 104;
  const plotWidth = svgWidth - labelWidth - 16;
  const svgHeight = topPad + channels.length * laneHeight + bottomPad;

  // At gainUv = 50, ±50 uV maps to ±20 px (so 50 uV reference bar = 20 px)
  // At gainUv = 25 (high sensitivity), ±25 uV maps to ±20 px (50 uV = 40 px)
  // At gainUv = 100 (compressed), ±100 uV maps to ±20 px (50 uV = 10 px)
  const pxPerUv = 20 / gainUv;
  const calibration50UvHeight = Math.min(40, Math.max(10, 50 * pxPerUv));
  const pxPerSec = plotWidth / Math.max(durationSec, 0.1);
  const calibration1SecWidth = Math.min(plotWidth * 0.3, Math.max(36, pxPerSec));

  useEffect(() => {
    if (isPaused || inspectIdx !== null || totalSamples < 2) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    let rafId = 0;
    let lastTs = performance.now();
    let lastSampleIdx = -1;

    const updateSweepDom = (frac: number) => {
      const idx = Math.min(totalSamples - 1, Math.floor(frac * totalSamples));
      const x = labelWidth + (idx / (totalSamples - 1)) * plotWidth;
      const xStr = x.toFixed(1);

      if (sweepLineRef.current) {
        sweepLineRef.current.setAttribute('x1', xStr);
        sweepLineRef.current.setAttribute('x2', xStr);
      }

      if (idx === lastSampleIdx) return;
      lastSampleIdx = idx;

      for (let c = 0; c < channels.length; c++) {
        const ch = channels[c]!;
        const val = activeSignals[ch]?.[idx];
        const dot = sweepDotRefs.current[c];
        if (dot) {
          if (val === undefined) {
            dot.setAttribute('display', 'none');
          } else {
            const centerY = topPad + c * laneHeight + laneHeight / 2;
            const clampedUv = Math.max(-gainUv * 1.12, Math.min(gainUv * 1.12, val));
            const y = centerY - clampedUv * pxPerUv;
            dot.removeAttribute('display');
            dot.setAttribute('cx', xStr);
            dot.setAttribute('cy', y.toFixed(1));
          }
        }
        const valEl = readoutValRefs.current[c];
        if (valEl && val !== undefined) {
          valEl.textContent = `${val >= 0 ? `+${val.toFixed(1)}` : val.toFixed(1)} µV`;
          valEl.className = val >= 0 ? 'text-teal-700' : 'text-sky-700';
        }
      }

      if (readoutTimeRef.current) {
        readoutTimeRef.current.textContent = `t = ${(times[idx] ?? 0).toFixed(2)}s`;
      }
    };

    updateSweepDom(sweepFractionRef.current);

    const step = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      const nextFrac = (sweepFractionRef.current + dt / Math.max(durationSec, 4)) % 1;
      sweepFractionRef.current = nextFrac;
      updateSweepDom(nextFrac);
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [isPaused, inspectIdx, durationSec, totalSamples, channels, activeSignals, times, gainUv, pxPerUv, plotWidth]);

  const channelStats = useMemo(() => {
    return channels.map((ch) => {
      const series = activeSignals[ch] ?? [];
      if (series.length === 0) {
        return { name: ch, peakToPeak: 0, rms: 0, path: '' };
      }
      let minVal = Infinity;
      let maxVal = -Infinity;
      let sqSum = 0;
      for (let i = 0; i < series.length; i++) {
        const v = series[i]!;
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
        sqSum += v * v;
      }
      const rms = Math.sqrt(sqSum / series.length);
      return {
        name: ch,
        peakToPeak: maxVal - minVal,
        rms,
      };
    });
  }, [channels, activeSignals]);

  const channelPaths = useMemo(() => {
    return channels.map((ch, chIdx) => {
      const series = activeSignals[ch] ?? [];
      const n = Math.min(series.length, totalSamples);
      if (n < 2) return '';
      const centerY = topPad + chIdx * laneHeight + laneHeight / 2;
      const parts: string[] = [];
      for (let i = 0; i < n; i++) {
        const x = labelWidth + (i / (n - 1)) * plotWidth;
        const clampedUv = Math.max(-gainUv * 1.12, Math.min(gainUv * 1.12, series[i]!));
        const y = centerY - clampedUv * pxPerUv;
        parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
      }
      return parts.join(' ');
    });
  }, [channels, activeSignals, totalSamples, plotWidth, gainUv, pxPerUv]);

  const activeInspectIndex = useMemo(() => {
    if (totalSamples === 0 || inspectIdx === null) return null;
    return Math.max(0, Math.min(totalSamples - 1, inspectIdx));
  }, [inspectIdx, totalSamples]);

  const isSweepActive = !isPaused && activeInspectIndex === null && totalSamples > 1;

  const togglePlay = () => {
    if (isPaused) {
      setInspectIdx(null);
      setIsPaused(false);
    } else {
      setIsPaused(true);
    }
  };

  const handlePointerInspect = (clientX: number, lockPause: boolean) => {
    if (!svgRef.current || totalSamples < 2) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * svgWidth;
    const frac = Math.max(0, Math.min(1, (relX - labelWidth) / plotWidth));
    const idx = Math.round(frac * (totalSamples - 1));
    setInspectIdx(idx);
    if (lockPause) setIsPaused(true);
  };

  const gridTicksSec = useMemo(() => {
    const step = durationSec <= 3 ? 0.5 : durationSec <= 8 ? 1 : 2;
    const ticks: number[] = [];
    for (let t = 0; t <= durationSec + 0.001; t += step) {
      ticks.push(Number(t.toFixed(1)));
    }
    return ticks;
  }, [durationSec]);

  const minorTicksSec = useMemo(() => {
    const step = durationSec <= 3 ? 0.1 : 0.2;
    const ticks: number[] = [];
    for (let t = 0; t <= durationSec + 0.001; t += step) {
      ticks.push(Number(t.toFixed(2)));
    }
    return ticks;
  }, [durationSec]);

  const traceStroke =
    signalMode === 'raw'
      ? '#b45309'
      : isProfessional
        ? '#1e3a5f'
        : '#0d9488';

  return (
    <div
      className={cn(
        'rounded-lg border bg-white overflow-hidden shadow-2xs',
        isProfessional ? 'border-slate-300' : 'border-slate-200/90',
      )}
    >
      {/* Toolbar */}
      <div className="px-3.5 py-2 bg-slate-50/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Activity
              className={cn('size-4 shrink-0', isProfessional ? 'text-[#1E3A5F]' : 'text-teal-700')}
              aria-hidden
            />
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">{title}</h3>
          </div>
          <p className="text-[11px] text-slate-500">
            {subtitle || `${samplingRateHz} Hz · ${durationSec.toFixed(1)}s`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Gain selector */}
          <div
            className="inline-flex items-center rounded-md border border-slate-200 bg-white p-0.5 text-[11px] font-semibold"
            role="group"
            aria-label="Chọn độ nhạy biên độ EEG"
          >
            <span className="px-2 text-slate-500 flex items-center gap-1">
              <SlidersHorizontal className="size-3" aria-hidden />
              Độ nhạy:
            </span>
            {([25, 50, 100] as const).map((uv) => (
              <button
                key={uv}
                type="button"
                aria-pressed={gainUv === uv}
                onClick={() => setGainUv(uv)}
                className={cn(
                  'rounded px-2 py-1 font-mono tabular-nums transition-colors',
                  gainUv === uv
                    ? isProfessional
                      ? 'bg-[#162B47] text-white font-bold'
                      : 'bg-teal-700 text-white font-bold'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {uv} µV
              </button>
            ))}
          </div>

          {/* Raw vs DSP toggle */}
          {hasRaw && (
            <div
              className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-[11px] font-semibold"
              role="group"
              aria-label="Chọn chế độ lọc tín hiệu"
            >
              <button
                type="button"
                aria-pressed={signalMode === 'filtered'}
                onClick={() => setSignalMode('filtered')}
                className={cn(
                  'rounded px-2.5 py-1 transition-colors',
                  signalMode === 'filtered'
                    ? 'bg-[#2C6865] text-white font-bold'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                Đã lọc nhiễu
              </button>
              <button
                type="button"
                aria-pressed={signalMode === 'raw'}
                onClick={() => setSignalMode('raw')}
                className={cn(
                  'rounded px-2.5 py-1 transition-colors',
                  signalMode === 'raw'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                Tín hiệu gốc
              </button>
            </div>
          )}

          {/* Play / Pause inspect */}
          <button
            type="button"
            aria-pressed={isPaused}
            onClick={togglePlay}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-bold transition-colors',
              isPaused
                ? 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                : 'border-teal-600 bg-teal-50 text-teal-800 hover:bg-teal-100',
            )}
          >
            {isPaused ? (
              <>
                <Play className="size-3.5" aria-hidden />
                <span>Chạy quét</span>
              </>
            ) : (
              <>
                <Pause className="size-3.5" aria-hidden />
                <span>Tạm dừng</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Crisp Clinical White EEG Paper Trace */}
      <div className="p-2.5 sm:p-3 bg-white space-y-2">
        <div
          tabIndex={0}
          role="region"
          aria-label="Giấy ghi sóng điện não đa kênh có thể soi bằng chuột hoặc phím mũi tên trái phải"
          onKeyDown={(e) => {
            if (totalSamples < 2) return;
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault();
              setIsPaused(true);
              const delta = e.key === 'ArrowRight' ? 1 : -1;
              setInspectIdx((prev) => {
                const base = prev ?? Math.floor(totalSamples / 2);
                return Math.max(0, Math.min(totalSamples - 1, base + delta * 3));
              });
            } else if (e.key === ' ') {
              e.preventDefault();
              togglePlay();
            }
          }}
          className="relative rounded border border-slate-200 bg-white overflow-x-auto focus-visible:outline-2 focus-visible:outline-[#2b4c7e]"
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full min-w-[640px] h-auto block select-none cursor-crosshair bg-white"
            onMouseMove={(e) => {
              if (isPaused) handlePointerInspect(e.clientX, false);
            }}
            onClick={(e) => handlePointerInspect(e.clientX, true)}
            onMouseLeave={() => {
              if (!isPaused) setInspectIdx(null);
            }}
          >
            <defs>
              {channels.map((ch, idx) => (
                <clipPath key={ch} id={`eeg-lane-clip-${idx}`}>
                  <rect
                    x={labelWidth}
                    y={topPad + idx * laneHeight + 2}
                    width={plotWidth}
                    height={laneHeight - 4}
                  />
                </clipPath>
              ))}
            </defs>

            {/* Pure white paper background */}
            <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="#ffffff" />

            {/* Left channel sidebar */}
            <rect x={0} y={0} width={labelWidth} height={svgHeight} fill="#f8fafc" />
            <line
              x1={labelWidth}
              y1={0}
              x2={labelWidth}
              y2={svgHeight}
              stroke="#cbd5e1"
              strokeWidth={1}
            />

            {/* Minor vertical EEG grid (0.2s) */}
            {minorTicksSec.map((sec) => {
              const x = labelWidth + (sec / durationSec) * plotWidth;
              return (
                <line
                  key={`minor-${sec}`}
                  x1={x}
                  y1={topPad}
                  x2={x}
                  y2={svgHeight - bottomPad}
                  stroke="#f1f5f9"
                  strokeWidth={1}
                />
              );
            })}

            {/* Major vertical EEG grid (1.0s) */}
            {gridTicksSec.map((sec) => {
              const x = labelWidth + (sec / durationSec) * plotWidth;
              return (
                <g key={`major-${sec}`}>
                  <line
                    x1={x}
                    y1={topPad}
                    x2={x}
                    y2={svgHeight - bottomPad}
                    stroke="#e2e8f0"
                    strokeWidth={1}
                  />
                  <text
                    x={x}
                    y={svgHeight - 7}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize={10}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {sec.toFixed(1)}s
                  </text>
                </g>
              );
            })}

            {/* Channel lanes, baselines, labels, and waveforms */}
            {channels.map((ch, idx) => {
              const laneTop = topPad + idx * laneHeight;
              const centerY = laneTop + laneHeight / 2;
              const stat = channelStats[idx];
              const anatomy = CHANNEL_ANATOMY_MAP[ch.toUpperCase()] ?? 'Đạo trình 10-20';
              return (
                <g key={ch}>
                  {/* Horizontal separator */}
                  <line
                    x1={0}
                    y1={laneTop + laneHeight}
                    x2={svgWidth}
                    y2={laneTop + laneHeight}
                    stroke="#f1f5f9"
                    strokeWidth={1}
                  />
                  {/* Isoelectric baseline */}
                  <line
                    x1={labelWidth}
                    y1={centerY}
                    x2={labelWidth + plotWidth}
                    y2={centerY}
                    stroke="#e2e8f0"
                    strokeDasharray="3 3"
                    strokeWidth={0.9}
                  />
                  {/* Channel name & anatomical region */}
                  <text
                    x={10}
                    y={centerY - 4}
                    fill="#0f172a"
                    fontSize={12}
                    fontWeight={700}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {ch}
                  </text>
                  <text
                    x={10}
                    y={centerY + 10}
                    fill="#64748b"
                    fontSize={9.5}
                    fontFamily="Plus Jakarta Sans, sans-serif"
                  >
                    {anatomy}
                  </text>
                  {stat && (
                    <text
                      x={labelWidth - 8}
                      y={centerY - 4}
                      textAnchor="end"
                      fill="#475569"
                      fontSize={9}
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {stat.peakToPeak.toFixed(0)}µVpp
                    </text>
                  )}

                  {/* Signal Path */}
                  <path
                    d={channelPaths[idx]}
                    fill="none"
                    stroke={traceStroke}
                    strokeWidth={1.45}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    clipPath={`url(#eeg-lane-clip-${idx})`}
                  />
                </g>
              );
            })}

            {/* Amplitude & Timebase Calibration Bracket (50 µV / 1.0 s) */}
            {(() => {
              const calBoxW = Math.max(calibration1SecWidth + 24, 158);
              const calBoxX = labelWidth + plotWidth - calBoxW - 6;
              return (
                <g transform={`translate(${calBoxX}, ${topPad + 6})`}>
                  <rect
                    x={0}
                    y={0}
                    width={calBoxW}
                    height={calibration50UvHeight + 24}
                    rx={4}
                    fill="rgba(255,255,255,0.94)"
                    stroke="#cbd5e1"
                    strokeWidth={0.9}
                  />
                  <path
                    d={`M 10 6 L 10 ${6 + calibration50UvHeight} L ${10 + calibration1SecWidth} ${6 + calibration50UvHeight}`}
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth={1.8}
                  />
                  <text
                    x={16}
                    y={Math.min(6 + calibration50UvHeight - 4, 18)}
                    fill="#0f172a"
                    fontSize={9.5}
                    fontWeight={700}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    50 µV
                  </text>
                  <text
                    x={calBoxW / 2}
                    y={calibration50UvHeight + 18}
                    textAnchor="middle"
                    fill="#0f172a"
                    fontSize={9}
                    fontWeight={700}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    1.0 s · ±{gainUv} µV
                  </text>
                </g>
              );
            })()}

            {/* DOM-driven 60fps Sweep Cursor (0% React re-render) */}
            {isSweepActive && (
              <g>
                <line
                  ref={sweepLineRef}
                  x1={labelWidth}
                  y1={topPad}
                  x2={labelWidth}
                  y2={svgHeight - bottomPad}
                  stroke="#0284c7"
                  strokeWidth={1.3}
                  strokeDasharray="4 2"
                />
                {channels.map((ch, idx) => (
                  <circle
                    key={`sweep-dot-${ch}`}
                    ref={(el) => {
                      sweepDotRefs.current[idx] = el;
                    }}
                    cx={labelWidth}
                    cy={topPad + idx * laneHeight + laneHeight / 2}
                    r={2.8}
                    fill="#0284c7"
                    stroke="#ffffff"
                    strokeWidth={1}
                    display="none"
                  />
                ))}
              </g>
            )}

            {/* Static Paused Inspection Crosshair */}
            {activeInspectIndex !== null && totalSamples > 1 && (
              <g>
                {(() => {
                  const x =
                    labelWidth + (activeInspectIndex / (totalSamples - 1)) * plotWidth;
                  return (
                    <>
                      <line
                        x1={x}
                        y1={topPad}
                        x2={x}
                        y2={svgHeight - bottomPad}
                        stroke="#dc2626"
                        strokeWidth={1.3}
                      />
                      {channels.map((ch, idx) => {
                        const val = activeSignals[ch]?.[activeInspectIndex];
                        if (val === undefined) return null;
                        const centerY = topPad + idx * laneHeight + laneHeight / 2;
                        const clampedUv = Math.max(-gainUv * 1.12, Math.min(gainUv * 1.12, val));
                        const y = centerY - clampedUv * pxPerUv;
                        return (
                          <circle
                            key={`dot-${ch}`}
                            cx={x}
                            cy={y}
                            r={2.8}
                            fill="#dc2626"
                            stroke="#ffffff"
                            strokeWidth={1}
                          />
                        );
                      })}
                    </>
                  );
                })()}
              </g>
            )}
          </svg>
        </div>

        {/* Live Sample Readout Strip */}
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
          <div className="flex items-center gap-2 text-slate-700 font-bold">
            <span key={isSweepActive ? 'sweep-time' : 'static-time'} ref={readoutTimeRef}>
              {activeInspectIndex !== null
                ? `t = ${(times[activeInspectIndex] ?? 0).toFixed(2)}s`
                : 'Toàn đoạn ghi · Di chuột hoặc nhấn để soi µV'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {channels.map((ch, idx) => {
              const sampleVal =
                activeInspectIndex !== null ? activeSignals[ch]?.[activeInspectIndex] : undefined;
              const stat = channelStats[idx];
              return (
                <span
                  key={`readout-${ch}`}
                  className="inline-flex items-center gap-1 rounded bg-white border border-slate-200 px-2 py-0.5 text-slate-700"
                >
                  <strong className="text-slate-900">{ch}:</strong>
                  {sampleVal !== undefined ? (
                    <span className={sampleVal >= 0 ? 'text-teal-700' : 'text-sky-700'}>
                      {sampleVal >= 0 ? `+${sampleVal.toFixed(1)}` : sampleVal.toFixed(1)} µV
                    </span>
                  ) : (
                    <span
                      key={isSweepActive ? `sweep-${ch}` : `static-${ch}`}
                      ref={(el) => {
                        readoutValRefs.current[idx] = el;
                      }}
                      className="text-slate-500"
                    >
                      RMS {stat?.rms.toFixed(1) ?? '0.0'} µV
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
