import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BookmarkPlus,
  Info,
  Pause,
  Play,
  SlidersHorizontal,
  X,
  ZoomIn,
} from 'lucide-react';
import { cn } from '../../components/ui';
import { CHANNEL_ANATOMY_MAP } from './eegLabels';

export type ChannelQualityStatus = 'GOOD' | 'NOISY' | 'DROPOUT' | 'SATURATED' | 'UNAVAILABLE';

export interface BrainWaveformChannelQuality {
  channel: string;
  isRecorded?: boolean;
  status: ChannelQualityStatus;
  rmsUv?: number | null;
  ptpUv?: number | null;
  noteVi?: string;
}

export interface BrainWaveformAnnotation {
  id?: string;
  startSec: number;
  endSec: number;
  kind: 'ABNORMAL' | 'ARTIFACT' | 'PHYSICIAN';
  channels?: string[];
  label: string;
}

export interface BrainWaveformInterval {
  startSec: number;
  endSec: number;
}

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
  montageLabel?: string;
  referenceLabel?: string;
  filterDescription?: string;
  recordingPositionLabel?: string;
  channelQuality?: BrainWaveformChannelQuality[];
  annotations?: BrainWaveformAnnotation[];
  selectedInterval?: BrainWaveformInterval | null;
  onSelectInterval?: (interval: BrainWaveformInterval | null) => void;
  onAddAnnotationFromSelection?: (interval: BrainWaveformInterval) => void;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

type GainUv = 25 | 50 | 100;
type TimeScaleOption = 'ALL' | 5 | 2.5;

const QUALITY_META: Record<
  ChannelQualityStatus,
  { label: string; dotColor: string; textColor: string }
> = {
  GOOD: { label: 'Hợp lệ', dotColor: '#10b981', textColor: '#047857' },
  NOISY: { label: 'Nhiễu', dotColor: '#f59e0b', textColor: '#b45309' },
  DROPOUT: { label: 'Mất tín hiệu', dotColor: '#f43f5e', textColor: '#be123c' },
  SATURATED: { label: 'Bão hòa', dotColor: '#dc2626', textColor: '#b91c1c' },
  UNAVAILABLE: { label: 'Không đo', dotColor: '#94a3b8', textColor: '#64748b' },
};

const ANNOTATION_STYLE: Record<
  BrainWaveformAnnotation['kind'],
  {
    fill: string;
    laneFill: string;
    stroke: string;
    pillBg: string;
    pillText: string;
    dashed?: boolean;
    kindLabel: string;
  }
> = {
  ABNORMAL: {
    fill: 'rgba(245, 158, 11, 0.13)',
    laneFill: 'rgba(245, 158, 11, 0.20)',
    stroke: '#d97706',
    pillBg: '#fef3c7',
    pillText: '#92400e',
    kindLabel: 'Sóng bất thường',
  },
  ARTIFACT: {
    fill: 'rgba(124, 58, 237, 0.09)',
    laneFill: 'rgba(124, 58, 237, 0.14)',
    stroke: '#7c3aed',
    pillBg: '#ede9fe',
    pillText: '#5b21b6',
    dashed: true,
    kindLabel: 'Nhiễu kỹ thuật',
  },
  PHYSICIAN: {
    fill: 'rgba(13, 148, 136, 0.12)',
    laneFill: 'rgba(13, 148, 136, 0.19)',
    stroke: '#0d9488',
    pillBg: '#ccfbf1',
    pillText: '#115e59',
    kindLabel: 'Bác sĩ đánh dấu',
  },
};

function findSampleIndexForTime(times: number[], targetSec: number): number {
  const n = times.length;
  if (n === 0) return 0;
  if (targetSec <= times[0]!) return 0;
  if (targetSec >= times[n - 1]!) return n - 1;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid]! < targetSec) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(times[lo - 1]! - targetSec) < Math.abs(times[lo]! - targetSec)) {
    return lo - 1;
  }
  return lo;
}

export function BrainWaveformViewer({
  waveforms,
  samplingRateHz = 500,
  isProfessional = false,
  title = 'Biểu đồ Điện não Đa kênh',
  subtitle,
  montageLabel,
  referenceLabel,
  filterDescription,
  recordingPositionLabel,
  channelQuality,
  annotations,
  selectedInterval,
  onSelectInterval,
  onAddAnnotationFromSelection,
  svgRef: externalSvgRef,
}: BrainWaveformViewerProps) {
  const instanceId = useId().replace(/:/g, '');
  const hasRaw = Boolean(waveforms.raw && Object.keys(waveforms.raw).length > 0);
  const [signalMode, setSignalMode] = useState<'filtered' | 'raw'>('filtered');
  const [gainUv, setGainUv] = useState<GainUv>(50);
  const [timeScale, setTimeScale] = useState<TimeScaleOption>('ALL');
  const [windowStartOffsetSec, setWindowStartOffsetSec] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(true);
  const [inspectIdx, setInspectIdx] = useState<number | null>(null);
  const [internalSelectedInterval, setInternalSelectedInterval] =
    useState<BrainWaveformInterval | null>(null);
  const [dragPreview, setDragPreview] = useState<BrainWaveformInterval | null>(null);
  const [activeAnnotationIdx, setActiveAnnotationIdx] = useState<number | null>(null);

  const internalSvgRef = useRef<SVGSVGElement | null>(null);
  const sweepFractionRef = useRef<number>(0);
  const sweepLineRef = useRef<SVGLineElement | null>(null);
  const sweepDotRefs = useRef<(SVGCircleElement | null)[]>([]);
  const readoutTimeRef = useRef<HTMLSpanElement | null>(null);
  const readoutValRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const dragStateRef = useRef<{
    active: boolean;
    startSec: number;
    startClientX: number;
    lastClientX: number;
  }>({ active: false, startSec: 0, startClientX: 0, lastClientX: 0 });

  const setSvgElementRef = useCallback(
    (el: SVGSVGElement | null) => {
      internalSvgRef.current = el;
      if (externalSvgRef && 'current' in externalSvgRef) {
        (externalSvgRef as React.MutableRefObject<SVGSVGElement | null>).current = el;
      }
    },
    [externalSvgRef],
  );

  const channels = useMemo(
    () => (waveforms.channels.length > 0 ? waveforms.channels : ['F3', 'F4', 'C3', 'C4', 'O1', 'O2']),
    [waveforms.channels],
  );
  const times = waveforms.time;
  const totalSamples = times.length;
  const baseTimeSec = totalSamples > 0 ? (times[0] ?? 0) : 0;
  const endTimeSec = useMemo(() => {
    if (totalSamples < 2) return baseTimeSec + 5;
    const last = times[totalSamples - 1] ?? baseTimeSec + 5;
    return last > baseTimeSec ? last : baseTimeSec + 5;
  }, [times, totalSamples, baseTimeSec]);

  const totalDurationSec = Math.max(0.2, endTimeSec - baseTimeSec);

  const windowDurationSec = useMemo(() => {
    if (timeScale === 'ALL') return totalDurationSec;
    return Math.min(totalDurationSec, timeScale);
  }, [timeScale, totalDurationSec]);

  const maxOffsetSec = Math.max(0, totalDurationSec - windowDurationSec);
  const clampedOffsetSec = Math.min(windowStartOffsetSec, maxOffsetSec);
  const viewStartSec = baseTimeSec + clampedOffsetSec;
  const viewEndSec = Math.min(endTimeSec, viewStartSec + windowDurationSec);

  useEffect(() => {
    if (windowStartOffsetSec > maxOffsetSec) {
      setWindowStartOffsetSec(maxOffsetSec);
    }
  }, [maxOffsetSec, windowStartOffsetSec]);

  const activeSignals = signalMode === 'raw' && hasRaw ? waveforms.raw! : waveforms.filtered;

  useEffect(() => {
    if (!hasRaw && signalMode === 'raw') {
      setSignalMode('filtered');
    }
  }, [hasRaw, signalMode]);

  const qualityByChannel = useMemo(() => {
    const map = new Map<string, BrainWaveformChannelQuality>();
    if (channelQuality) {
      for (const item of channelQuality) {
        map.set(item.channel.trim().toUpperCase(), item);
      }
    }
    return map;
  }, [channelQuality]);

  // Layout geometry: wider sidebar for metadata + safe right margin so calibration bar never clips
  const svgWidth = 920;
  const laneHeight = 56;
  const topPad = 22;
  const bottomPad = 26;
  const labelWidth = 172;
  const rightPad = 18;
  const plotWidth = svgWidth - labelWidth - rightPad;
  const svgHeight = topPad + channels.length * laneHeight + bottomPad;

  // At gainUv = 50, ±50 uV maps to ±22 px
  const pxPerUv = 22 / gainUv;
  const calibration50UvHeight = Math.min(44, Math.max(11, 50 * pxPerUv));
  const pxPerSec = plotWidth / Math.max(windowDurationSec, 0.1);
  const calibrationSeconds = windowDurationSec < 1.0 ? 0.5 : 1.0;
  const calibrationTimeWidth = Math.min(plotWidth * 0.34, Math.max(36, calibrationSeconds * pxPerSec));

  const timeToX = useCallback(
    (t: number) => labelWidth + ((t - viewStartSec) / Math.max(windowDurationSec, 0.05)) * plotWidth,
    [labelWidth, plotWidth, viewStartSec, windowDurationSec],
  );

  const clientXToSec = useCallback(
    (clientX: number) => {
      const svg = internalSvgRef.current;
      if (!svg) return viewStartSec;
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0) return viewStartSec;
      const relX = ((clientX - rect.left) / rect.width) * svgWidth;
      const frac = Math.max(0, Math.min(1, (relX - labelWidth) / plotWidth));
      return viewStartSec + frac * windowDurationSec;
    },
    [labelWidth, plotWidth, svgWidth, viewStartSec, windowDurationSec],
  );

  const channelMeta = useMemo(() => {
    return channels.map((ch) => {
      const upper = ch.trim().toUpperCase();
      const q = qualityByChannel.get(upper);
      const series = activeSignals[ch] ?? [];
      const hasSeries = series.length >= 2;
      const isRecorded = q ? q.isRecorded !== false && q.status !== 'UNAVAILABLE' : hasSeries;
      const status: ChannelQualityStatus = !isRecorded
        ? 'UNAVAILABLE'
        : q?.status ?? (hasSeries ? 'GOOD' : 'UNAVAILABLE');

      let minVal = Infinity;
      let maxVal = -Infinity;
      let sqSum = 0;
      if (isRecorded && series.length > 0) {
        for (let i = 0; i < series.length; i++) {
          const v = series[i]!;
          if (v < minVal) minVal = v;
          if (v > maxVal) maxVal = v;
          sqSum += v * v;
        }
      }
      const computedRms = isRecorded && series.length > 0 ? Math.sqrt(sqSum / series.length) : 0;
      const computedPtp = isRecorded && series.length > 0 ? maxVal - minVal : 0;

      return {
        name: ch,
        anatomy: CHANNEL_ANATOMY_MAP[upper] ?? 'Đạo trình 10-20',
        isRecorded,
        status,
        noteVi: q?.noteVi,
        rmsUv: q?.rmsUv != null ? q.rmsUv : computedRms,
        ptpUv: q?.ptpUv != null ? q.ptpUv : computedPtp,
      };
    });
  }, [channels, qualityByChannel, activeSignals]);

  const visibleSampleRange = useMemo(() => {
    if (totalSamples < 2) return { startIdx: 0, endIdx: 0 };
    const startIdx = Math.max(0, findSampleIndexForTime(times, viewStartSec) - 1);
    const endIdx = Math.min(totalSamples - 1, findSampleIndexForTime(times, viewEndSec) + 1);
    return { startIdx, endIdx };
  }, [times, totalSamples, viewStartSec, viewEndSec]);

  const channelPaths = useMemo(() => {
    const { startIdx, endIdx } = visibleSampleRange;
    const count = endIdx - startIdx + 1;
    // Downsample gracefully if zoomed out on very long recordings (>2500 pts) to keep SVG fast
    const step = count > 2400 ? Math.ceil(count / 2400) : 1;

    return channels.map((ch, chIdx) => {
      const meta = channelMeta[chIdx];
      if (!meta?.isRecorded) return '';
      const series = activeSignals[ch] ?? [];
      if (series.length < 2 || count < 2) return '';
      const centerY = topPad + chIdx * laneHeight + laneHeight / 2;
      const parts: string[] = [];
      for (let i = startIdx; i <= endIdx; i += step) {
        const t = times[i];
        const val = series[i];
        if (t === undefined || val === undefined) continue;
        const x = timeToX(t);
        const clampedUv = Math.max(-gainUv * 1.12, Math.min(gainUv * 1.12, val));
        const y = centerY - clampedUv * pxPerUv;
        parts.push(`${parts.length === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
      }
      // Ensure final point in visible window is included
      if ((endIdx - startIdx) % step !== 0 && endIdx > startIdx) {
        const t = times[endIdx];
        const val = series[endIdx];
        if (t !== undefined && val !== undefined) {
          const x = timeToX(t);
          const clampedUv = Math.max(-gainUv * 1.12, Math.min(gainUv * 1.12, val));
          const y = centerY - clampedUv * pxPerUv;
          parts.push(`L${x.toFixed(1)},${y.toFixed(1)}`);
        }
      }
      return parts.join(' ');
    });
  }, [
    channels,
    channelMeta,
    activeSignals,
    visibleSampleRange,
    times,
    timeToX,
    gainUv,
    pxPerUv,
  ]);

  useEffect(() => {
    if (isPaused || inspectIdx !== null || totalSamples < 2) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const { startIdx, endIdx } = visibleSampleRange;
    const spanSamples = Math.max(1, endIdx - startIdx);
    let rafId = 0;
    let lastTs = performance.now();
    let lastSampleIdx = -1;

    const updateSweepDom = (frac: number) => {
      const idx = Math.min(endIdx, startIdx + Math.floor(frac * spanSamples));
      const t = times[idx] ?? viewStartSec;
      const x = timeToX(t);
      const xStr = x.toFixed(1);

      if (sweepLineRef.current) {
        sweepLineRef.current.setAttribute('x1', xStr);
        sweepLineRef.current.setAttribute('x2', xStr);
      }

      if (idx === lastSampleIdx) return;
      lastSampleIdx = idx;

      for (let c = 0; c < channels.length; c++) {
        const ch = channels[c]!;
        const meta = channelMeta[c];
        const val = meta?.isRecorded ? activeSignals[ch]?.[idx] : undefined;
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
        readoutTimeRef.current.textContent = `t = ${t.toFixed(2)}s`;
      }
    };

    updateSweepDom(sweepFractionRef.current);

    const step = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      const nextFrac = (sweepFractionRef.current + dt / Math.max(windowDurationSec, 3.5)) % 1;
      sweepFractionRef.current = nextFrac;
      updateSweepDom(nextFrac);
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [
    isPaused,
    inspectIdx,
    totalSamples,
    visibleSampleRange,
    channels,
    channelMeta,
    activeSignals,
    times,
    viewStartSec,
    windowDurationSec,
    timeToX,
    gainUv,
    pxPerUv,
  ]);

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

  const handlePointerInspect = useCallback(
    (clientX: number, lockPause: boolean) => {
      if (totalSamples < 2) return;
      const sec = clientXToSec(clientX);
      const idx = findSampleIndexForTime(times, sec);
      setInspectIdx(idx);
      if (lockPause) setIsPaused(true);
    },
    [totalSamples, clientXToSec, times],
  );

  const effectiveSelectedInterval =
    selectedInterval !== undefined ? selectedInterval : internalSelectedInterval;

  const commitSelectedInterval = useCallback(
    (next: BrainWaveformInterval | null) => {
      if (selectedInterval === undefined) {
        setInternalSelectedInterval(next);
      }
      onSelectInterval?.(next);
    },
    [selectedInterval, onSelectInterval],
  );

  useEffect(() => {
    const handleWindowMouseUp = (e: MouseEvent) => {
      if (!dragStateRef.current.active) return;
      dragStateRef.current.active = false;
      const movedPx = Math.abs(e.clientX - dragStateRef.current.startClientX);
      if (movedPx >= 6) {
        const secA = dragStateRef.current.startSec;
        const secB = clientXToSec(e.clientX);
        const startSec = Number(Math.max(baseTimeSec, Math.min(secA, secB)).toFixed(2));
        const endSec = Number(Math.min(endTimeSec, Math.max(secA, secB)).toFixed(2));
        setDragPreview(null);
        if (endSec - startSec >= 0.05) {
          setIsPaused(true);
          commitSelectedInterval({ startSec, endSec });
        }
      } else {
        setDragPreview(null);
        handlePointerInspect(e.clientX, true);
      }
    };

    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => window.removeEventListener('mouseup', handleWindowMouseUp);
  }, [baseTimeSec, endTimeSec, clientXToSec, commitSelectedInterval, handlePointerInspect]);

  const displayedInterval = dragPreview ?? effectiveSelectedInterval;

  const intervalStats = useMemo(() => {
    if (!effectiveSelectedInterval || totalSamples < 2) return null;
    const { startSec, endSec } = effectiveSelectedInterval;
    if (endSec <= startSec) return null;
    const iStart = findSampleIndexForTime(times, startSec);
    const iEnd = findSampleIndexForTime(times, endSec);
    if (iEnd <= iStart) return null;

    let rmsSum = 0;
    let recordedCount = 0;
    let maxPeak = 0;

    for (let c = 0; c < channels.length; c++) {
      if (!channelMeta[c]?.isRecorded) continue;
      const series = activeSignals[channels[c]!] ?? [];
      if (series.length === 0) continue;
      let sq = 0;
      let count = 0;
      for (let i = iStart; i <= iEnd && i < series.length; i++) {
        const v = series[i]!;
        sq += v * v;
        count++;
        const absV = Math.abs(v);
        if (absV > maxPeak) maxPeak = absV;
      }
      if (count > 0) {
        rmsSum += Math.sqrt(sq / count);
        recordedCount++;
      }
    }

    return {
      startSec,
      endSec,
      durationSec: endSec - startSec,
      avgRmsUv: recordedCount > 0 ? rmsSum / recordedCount : 0,
      maxPeakUv: maxPeak,
    };
  }, [effectiveSelectedInterval, totalSamples, times, channels, channelMeta, activeSignals]);

  const gridTicksSec = useMemo(() => {
    const step = windowDurationSec <= 3 ? 0.5 : windowDurationSec <= 8 ? 1 : 2;
    const firstTick = Math.ceil(viewStartSec / step) * step;
    const ticks: number[] = [];
    for (let t = firstTick; t <= viewEndSec + 0.001; t += step) {
      const rounded = Number(t.toFixed(2));
      if (rounded >= viewStartSec - 0.001 && rounded <= viewEndSec + 0.001) {
        ticks.push(rounded);
      }
    }
    return ticks;
  }, [viewStartSec, viewEndSec, windowDurationSec]);

  const minorTicksSec = useMemo(() => {
    const step = windowDurationSec <= 3 ? 0.1 : 0.2;
    const firstTick = Math.ceil(viewStartSec / step) * step;
    const ticks: number[] = [];
    for (let t = firstTick; t <= viewEndSec + 0.001; t += step) {
      const rounded = Number(t.toFixed(2));
      if (rounded >= viewStartSec - 0.001 && rounded <= viewEndSec + 0.001) {
        ticks.push(rounded);
      }
    }
    return ticks;
  }, [viewStartSec, viewEndSec, windowDurationSec]);

  const visibleAnnotations = useMemo(() => {
    if (!annotations || annotations.length === 0) return [];
    return annotations
      .map((ann, idx) => ({ ann, idx }))
      .filter(({ ann }) => ann.endSec >= viewStartSec && ann.startSec <= viewEndSec);
  }, [annotations, viewStartSec, viewEndSec]);

  const activeAnnotation =
    activeAnnotationIdx !== null && annotations?.[activeAnnotationIdx]
      ? annotations[activeAnnotationIdx]!
      : null;

  const traceStroke =
    signalMode === 'raw' ? '#b45309' : isProfessional ? '#1e3a5f' : '#0d9488';

  const resolvedMontage = montageLabel?.trim() || `${channels.length} kênh 10–20`;
  const resolvedFilterLine =
    signalMode === 'raw'
      ? 'Tín hiệu gốc trừ DC offset — Chưa áp dụng lọc băng thông / Notch'
      : filterDescription?.trim() || 'Đã lọc chuẩn hóa phía máy chủ (chưa khai báo thông số chi tiết)';

  return (
    <div
      className={cn(
        'rounded-lg border bg-white overflow-hidden shadow-2xs',
        isProfessional ? 'border-slate-300' : 'border-slate-200/90',
      )}
    >
      {/* Toolbar */}
      <div className="px-3.5 py-2.5 bg-slate-50/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Activity
              className={cn('size-4 shrink-0', isProfessional ? 'text-[#1E3A5F]' : 'text-teal-700')}
              aria-hidden
            />
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">{title}</h3>
          </div>
          <p className="text-[11px] text-slate-500">
            {subtitle ||
              `${samplingRateHz} Hz · ${channels.length} đạo trình · ${totalDurationSec.toFixed(1)}s`}
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

          {/* Horizontal Time Scale / Zoom selector */}
          <div
            className="inline-flex items-center rounded-md border border-slate-200 bg-white p-0.5 text-[11px] font-semibold"
            role="group"
            aria-label="Chọn cửa sổ thời gian hiển thị"
          >
            <span className="px-1.5 text-slate-500 flex items-center gap-1">
              <ZoomIn className="size-3" aria-hidden />
              Khung:
            </span>
            {(['ALL', 5, 2.5] as const).map((opt) => {
              const disabled = opt !== 'ALL' && totalDurationSec <= opt + 0.05;
              return (
                <button
                  key={String(opt)}
                  type="button"
                  disabled={disabled}
                  aria-pressed={timeScale === opt}
                  onClick={() => {
                    setTimeScale(opt);
                    if (opt === 'ALL') setWindowStartOffsetSec(0);
                  }}
                  className={cn(
                    'rounded px-2 py-1 font-mono tabular-nums transition-colors',
                    disabled && 'opacity-40 cursor-not-allowed',
                    timeScale === opt
                      ? isProfessional
                        ? 'bg-[#162B47] text-white font-bold'
                        : 'bg-teal-700 text-white font-bold'
                      : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {opt === 'ALL' ? 'Toàn đoạn' : `${opt}s`}
                </button>
              );
            })}
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

      {/* Technical Metadata Strip */}
      <div className="px-3.5 py-1.5 bg-slate-50/50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-slate-600">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            <strong className="text-slate-800">Tần số:</strong>{' '}
            <span className="font-mono tabular-nums">{samplingRateHz} Hz</span>
          </span>
          <span aria-hidden className="text-slate-300">
            |
          </span>
          <span>
            <strong className="text-slate-800">Montage:</strong> {resolvedMontage}
            {referenceLabel ? ` · Tham chiếu: ${referenceLabel}` : ''}
          </span>
          <span aria-hidden className="text-slate-300">
            |
          </span>
          <span className={signalMode === 'raw' ? 'text-amber-800 font-medium' : 'text-slate-700'}>
            <strong className="text-slate-800">Bộ lọc:</strong> {resolvedFilterLine}
          </span>
        </div>
        <div className="font-mono tabular-nums text-slate-700 font-semibold">
          {recordingPositionLabel
            ? `${recordingPositionLabel} · Đang xem: ${viewStartSec.toFixed(1)}s – ${viewEndSec.toFixed(1)}s`
            : `Vị trí đoạn ghi: ${viewStartSec.toFixed(1)}s – ${viewEndSec.toFixed(1)}s`}
        </div>
      </div>

      {/* Crisp Clinical White EEG Paper Trace */}
      <div className="p-2.5 sm:p-3 bg-white space-y-2">
        {/* Horizontal Time Window Slider when zoomed */}
        {maxOffsetSec > 0.05 && (
          <div className="rounded-md border border-slate-200 bg-slate-50/70 px-3 py-1.5 flex flex-wrap items-center gap-3 text-[11px]">
            <span className="font-semibold text-slate-700 shrink-0">
              Di chuyển cửa sổ ({windowDurationSec.toFixed(1)}s):
            </span>
            <input
              type="range"
              min={0}
              max={maxOffsetSec}
              step={0.1}
              value={clampedOffsetSec}
              onChange={(e) => setWindowStartOffsetSec(parseFloat(e.target.value))}
              aria-label="Thanh trượt vị trí cửa sổ thời gian EEG"
              className="flex-1 min-w-[140px] accent-teal-700 cursor-pointer"
            />
            <span className="font-mono tabular-nums font-bold text-slate-800 shrink-0">
              {viewStartSec.toFixed(1)}s – {viewEndSec.toFixed(1)}s / {endTimeSec.toFixed(1)}s
            </span>
          </div>
        )}

        <div
          tabIndex={0}
          role="region"
          aria-label="Giấy ghi sóng điện não đa kênh: nhấn để soi điểm, kéo chuột để chọn khoảng thời gian"
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
            ref={setSvgElementRef}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full min-w-[600px] lg:min-w-0 h-auto block select-none cursor-crosshair bg-white"
            onMouseDown={(e) => {
              if (e.button !== 0 || totalSamples < 2) return;
              const svg = internalSvgRef.current;
              if (!svg) return;
              const rect = svg.getBoundingClientRect();
              const relX = ((e.clientX - rect.left) / rect.width) * svgWidth;
              if (relX < labelWidth) return;
              const sec = clientXToSec(e.clientX);
              dragStateRef.current = {
                active: true,
                startSec: sec,
                startClientX: e.clientX,
                lastClientX: e.clientX,
              };
              setDragPreview({ startSec: sec, endSec: sec });
            }}
            onMouseMove={(e) => {
              if (dragStateRef.current.active) {
                dragStateRef.current.lastClientX = e.clientX;
                const currentSec = clientXToSec(e.clientX);
                const startSec = Math.min(dragStateRef.current.startSec, currentSec);
                const endSec = Math.max(dragStateRef.current.startSec, currentSec);
                setDragPreview({ startSec, endSec });
                return;
              }
              if (isPaused) handlePointerInspect(e.clientX, false);
            }}
            onMouseLeave={() => {
              if (!dragStateRef.current.active && !isPaused) setInspectIdx(null);
            }}
          >
            <defs>
              {channels.map((ch, idx) => (
                <clipPath key={ch} id={`eeg-lane-clip-${instanceId}-${idx}`}>
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

            {/* Minor vertical EEG grid (0.2s / 0.1s) */}
            {minorTicksSec.map((sec) => {
              const x = timeToX(sec);
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

            {/* Major vertical EEG grid */}
            {gridTicksSec.map((sec) => {
              const x = timeToX(sec);
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
                    y={svgHeight - 9}
                    textAnchor="middle"
                    fill="#475569"
                    fontSize={9.5}
                    fontWeight={600}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {sec.toFixed(1)}s
                  </text>
                </g>
              );
            })}

            {/* Explicit Time Axis Unit Label */}
            <text
              x={14}
              y={svgHeight - 9}
              textAnchor="start"
              fill="#64748b"
              fontSize={9.5}
              fontWeight={700}
              fontFamily="Plus Jakarta Sans, sans-serif"
            >
              Trục thời gian (s)
            </text>

            {/* Annotation Bands (ABNORMAL / ARTIFACT / PHYSICIAN) */}
            {visibleAnnotations.map(({ ann, idx }) => {
              const style = ANNOTATION_STYLE[ann.kind];
              const clampedStart = Math.max(viewStartSec, ann.startSec);
              const clampedEnd = Math.min(viewEndSec, ann.endSec);
              const x1 = timeToX(clampedStart);
              const rawW = timeToX(clampedEnd) - x1;
              const w = Math.max(4, rawW);
              const targetChannelSet =
                ann.channels && ann.channels.length > 0
                  ? new Set(ann.channels.map((c) => c.trim().toUpperCase()))
                  : null;
              const pillW = Math.min(130, Math.max(54, ann.label.length * 5.8 + 14));
              const pillX = Math.min(labelWidth + plotWidth - pillW - 4, Math.max(labelWidth + 2, x1));

              return (
                <g
                  key={ann.id ?? `ann-${idx}`}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveAnnotationIdx((prev) => (prev === idx ? null : idx));
                  }}
                >
                  <title>{`${style.kindLabel}: ${ann.label} (${ann.startSec.toFixed(2)}s – ${ann.endSec.toFixed(2)}s)`}</title>
                  {targetChannelSet ? (
                    channels.map((ch, cIdx) => {
                      const matches = targetChannelSet.has(ch.trim().toUpperCase());
                      const y = topPad + cIdx * laneHeight + 2;
                      return (
                        <rect
                          key={`ann-${idx}-${ch}`}
                          x={x1}
                          y={y}
                          width={w}
                          height={laneHeight - 4}
                          fill={matches ? style.laneFill : style.fill}
                          opacity={matches ? 1 : 0.35}
                        />
                      );
                    })
                  ) : (
                    <rect
                      x={x1}
                      y={topPad}
                      width={w}
                      height={channels.length * laneHeight}
                      fill={style.fill}
                    />
                  )}
                  <line
                    x1={x1}
                    y1={topPad}
                    x2={x1}
                    y2={svgHeight - bottomPad}
                    stroke={style.stroke}
                    strokeWidth={1.2}
                    strokeDasharray={style.dashed ? '4 2' : undefined}
                  />
                  <line
                    x1={x1 + w}
                    y1={topPad}
                    x2={x1 + w}
                    y2={svgHeight - bottomPad}
                    stroke={style.stroke}
                    strokeWidth={1}
                    strokeDasharray={style.dashed ? '4 2' : undefined}
                    opacity={0.75}
                  />
                  {/* Top rim label pill */}
                  <rect
                    x={pillX}
                    y={3}
                    width={pillW}
                    height={15}
                    rx={3}
                    fill={style.pillBg}
                    stroke={style.stroke}
                    strokeWidth={0.8}
                  />
                  <text
                    x={pillX + 5}
                    y={13.5}
                    fill={style.pillText}
                    fontSize={8.5}
                    fontWeight={700}
                    fontFamily="Plus Jakarta Sans, sans-serif"
                  >
                    {ann.label.length > 20 ? `${ann.label.slice(0, 19)}…` : ann.label}
                  </text>
                </g>
              );
            })}

            {/* Selected or Dragged Time Interval Overlay */}
            {displayedInterval && displayedInterval.endSec > displayedInterval.startSec + 0.02 && (() => {
              const s1 = Math.max(viewStartSec, displayedInterval.startSec);
              const s2 = Math.min(viewEndSec, displayedInterval.endSec);
              if (s2 <= s1) return null;
              const x1 = timeToX(s1);
              const x2 = timeToX(s2);
              return (
                <g pointerEvents="none">
                  <rect
                    x={x1}
                    y={topPad}
                    width={Math.max(2, x2 - x1)}
                    height={channels.length * laneHeight}
                    fill="rgba(2, 132, 199, 0.12)"
                  />
                  <line
                    x1={x1}
                    y1={topPad}
                    x2={x1}
                    y2={svgHeight - bottomPad}
                    stroke="#0284c7"
                    strokeWidth={1.5}
                  />
                  <line
                    x1={x2}
                    y1={topPad}
                    x2={x2}
                    y2={svgHeight - bottomPad}
                    stroke="#0284c7"
                    strokeWidth={1.5}
                  />
                </g>
              );
            })()}

            {/* Channel lanes, baselines, labels, quality dots, and waveforms */}
            {channels.map((ch, idx) => {
              const laneTop = topPad + idx * laneHeight;
              const centerY = laneTop + laneHeight / 2;
              const meta = channelMeta[idx]!;
              const qStyle = QUALITY_META[meta.status];

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
                    stroke={meta.isRecorded ? '#e2e8f0' : '#cbd5e1'}
                    strokeDasharray={meta.isRecorded ? '3 3' : '5 4'}
                    strokeWidth={meta.isRecorded ? 0.9 : 1.1}
                  />

                  {/* Channel Name + Quality Status Dot */}
                  <circle cx={12} cy={centerY - 12} r={3.5} fill={qStyle.dotColor} />
                  <text
                    x={20}
                    y={centerY - 8.5}
                    fill="#0f172a"
                    fontSize={11.5}
                    fontWeight={800}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {ch}
                  </text>
                  <text
                    x={labelWidth - 8}
                    y={centerY - 8.5}
                    textAnchor="end"
                    fill={qStyle.textColor}
                    fontSize={8.5}
                    fontWeight={700}
                    fontFamily="Plus Jakarta Sans, sans-serif"
                  >
                    {qStyle.label}
                  </text>

                  {/* Anatomical 10-20 short label */}
                  <text
                    x={10}
                    y={centerY + 4}
                    fill="#475569"
                    fontSize={9}
                    fontFamily="Plus Jakarta Sans, sans-serif"
                  >
                    {meta.anatomy}
                  </text>

                  {/* RMS / PtP (µV) */}
                  <text
                    x={10}
                    y={centerY + 17}
                    fill="#64748b"
                    fontSize={8.5}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {meta.isRecorded
                      ? `RMS ${meta.rmsUv.toFixed(1)} · PtP ${meta.ptpUv.toFixed(0)} µV`
                      : 'Chưa ghi nhận kênh này'}
                  </text>

                  {/* Amplitude scale ticks (±gainUv µV) on plot left edge */}
                  {meta.isRecorded && (
                    <g pointerEvents="none">
                      <text
                        x={labelWidth + 4}
                        y={laneTop + 10}
                        fill="#94a3b8"
                        fontSize={7.5}
                        fontFamily="JetBrains Mono, monospace"
                      >
                        +{gainUv}µV
                      </text>
                      <text
                        x={labelWidth + 4}
                        y={laneTop + laneHeight - 4}
                        fill="#94a3b8"
                        fontSize={7.5}
                        fontFamily="JetBrains Mono, monospace"
                      >
                        -{gainUv}µV
                      </text>
                    </g>
                  )}

                  {/* Signal Path or Explicit Not-Recorded Banner */}
                  {meta.isRecorded ? (
                    <path
                      d={channelPaths[idx]}
                      fill="none"
                      stroke={traceStroke}
                      strokeWidth={1.45}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      clipPath={`url(#eeg-lane-clip-${instanceId}-${idx})`}
                    />
                  ) : (
                    <g pointerEvents="none">
                      <rect
                        x={labelWidth + plotWidth / 2 - 88}
                        y={centerY - 10}
                        width={176}
                        height={20}
                        rx={10}
                        fill="#f8fafc"
                        stroke="#cbd5e1"
                        strokeWidth={1}
                      />
                      <text
                        x={labelWidth + plotWidth / 2}
                        y={centerY + 3.2}
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize={9.5}
                        fontWeight={600}
                        fontFamily="Plus Jakarta Sans, sans-serif"
                      >
                        Không đo (Not recorded)
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Safe Calibration Box (50 µV / 1.0 s) — guaranteed >= 14px inside plot right edge */}
            {(() => {
              const calBoxW = Math.max(calibrationTimeWidth + 28, 160);
              const calBoxX = Math.max(
                labelWidth + 12,
                labelWidth + plotWidth - calBoxW - 14,
              );
              return (
                <g transform={`translate(${calBoxX}, ${topPad + 6})`} pointerEvents="none">
                  <rect
                    x={0}
                    y={0}
                    width={calBoxW}
                    height={calibration50UvHeight + 24}
                    rx={4}
                    fill="rgba(255,255,255,0.95)"
                    stroke="#cbd5e1"
                    strokeWidth={0.95}
                  />
                  <path
                    d={`M 12 6 L 12 ${6 + calibration50UvHeight} L ${12 + calibrationTimeWidth} ${6 + calibration50UvHeight}`}
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth={1.8}
                  />
                  <text
                    x={18}
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
                    {calibrationSeconds.toFixed(1)} s · ±{gainUv} µV
                  </text>
                </g>
              );
            })()}

            {/* DOM-driven 60fps Sweep Cursor */}
            {isSweepActive && (
              <g pointerEvents="none">
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
            {activeInspectIndex !== null && totalSamples > 1 && (() => {
              const tInspect = times[activeInspectIndex] ?? viewStartSec;
              if (tInspect < viewStartSec || tInspect > viewEndSec) return null;
              const x = timeToX(tInspect);
              return (
                <g pointerEvents="none">
                  <line
                    x1={x}
                    y1={topPad}
                    x2={x}
                    y2={svgHeight - bottomPad}
                    stroke="#dc2626"
                    strokeWidth={1.3}
                  />
                  {channels.map((ch, idx) => {
                    if (!channelMeta[idx]?.isRecorded) return null;
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
                </g>
              );
            })()}
          </svg>
        </div>

        {/* Clicked Annotation Detail Banner */}
        {activeAnnotation && (
          <div className="rounded-md border border-amber-200 bg-amber-50/70 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-800">
            <div className="flex items-center gap-2">
              <Info className="size-3.5 text-amber-700 shrink-0" aria-hidden />
              <span>
                <strong>{ANNOTATION_STYLE[activeAnnotation.kind].kindLabel}:</strong>{' '}
                {activeAnnotation.label} ({activeAnnotation.startSec.toFixed(2)}s –{' '}
                {activeAnnotation.endSec.toFixed(2)}s
                {activeAnnotation.channels?.length
                  ? ` · Kênh: ${activeAnnotation.channels.join(', ')}`
                  : ''}
                )
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveAnnotationIdx(null)}
              className="text-slate-500 hover:text-slate-800"
              aria-label="Đóng chi tiết đánh dấu"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Drag-Selected Interval Summary Bar */}
        {intervalStats && (
          <div className="rounded-md border border-sky-200 bg-sky-50/80 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-800 font-mono tabular-nums">
              <span className="font-sans font-bold text-sky-900">
                Đoạn chọn: [{intervalStats.startSec.toFixed(2)}s – {intervalStats.endSec.toFixed(2)}s]
              </span>
              <span>Δt = {intervalStats.durationSec.toFixed(2)}s</span>
              <span>RMS TB: {intervalStats.avgRmsUv.toFixed(1)} µV</span>
              <span>Đỉnh cực đại: {intervalStats.maxPeakUv.toFixed(1)} µV</span>
            </div>
            <div className="flex items-center gap-1.5">
              {onAddAnnotationFromSelection && (
                <button
                  type="button"
                  onClick={() =>
                    onAddAnnotationFromSelection({
                      startSec: intervalStats.startSec,
                      endSec: intervalStats.endSec,
                    })
                  }
                  className="inline-flex items-center gap-1 rounded bg-teal-700 hover:bg-teal-800 text-white px-2.5 py-1 font-semibold transition-colors"
                >
                  <BookmarkPlus className="size-3.5" aria-hidden />
                  <span>+ Đánh dấu vào nhận định</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => commitSelectedInterval(null)}
                className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 px-2 py-1 font-semibold transition-colors"
              >
                <X className="size-3" aria-hidden />
                <span>Bỏ chọn</span>
              </button>
            </div>
          </div>
        )}

        {/* Live Sample Readout Strip */}
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
          <div className="flex items-center gap-2 text-slate-700 font-bold font-sans">
            <span key={isSweepActive ? 'sweep-time' : 'static-time'} ref={readoutTimeRef}>
              {activeInspectIndex !== null
                ? `t = ${(times[activeInspectIndex] ?? 0).toFixed(2)}s`
                : 'Nhấn để soi µV · Giữ và kéo chuột để chọn đoạn thời gian'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {channels.map((ch, idx) => {
              const meta = channelMeta[idx]!;
              const sampleVal =
                meta.isRecorded && activeInspectIndex !== null
                  ? activeSignals[ch]?.[activeInspectIndex]
                  : undefined;
              return (
                <span
                  key={`readout-${ch}`}
                  className="inline-flex items-center gap-1 rounded bg-white border border-slate-200 px-2 py-0.5 text-slate-700"
                >
                  <strong className="text-slate-900">{ch}:</strong>
                  {!meta.isRecorded ? (
                    <span className="text-slate-400">Không đo</span>
                  ) : sampleVal !== undefined ? (
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
                      RMS {meta.rmsUv.toFixed(1)} µV
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
