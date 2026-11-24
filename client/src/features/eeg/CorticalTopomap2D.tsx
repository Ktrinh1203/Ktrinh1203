import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Compass } from 'lucide-react';
import type { QeegTopomapNode } from '../../api/types';
import { cn } from '../../components/ui';
import { CHANNEL_ANATOMY_MAP } from './eegLabels';

export interface CorticalTopomap2DProps {
  nodes: QeegTopomapNode[];
  meanBsi: number;
  meanDar: number;
  trafficLight?: 'green' | 'yellow' | 'red' | 'purple';
  isProfessional?: boolean;
}

const LEFT_CHANNELS = new Set(['FP1', 'F7', 'F3', 'T3', 'C3', 'T5', 'P3', 'O1']);
const RIGHT_CHANNELS = new Set(['FP2', 'F8', 'F4', 'T4', 'C4', 'T6', 'P4', 'O2']);

interface NormalizedTopomapNode extends QeegTopomapNode {
  sx: number;
  sy: number;
  nx: number;
  ny: number;
  intensity: number;
}

const ScalpAnatomyLayer = memo(function ScalpAnatomyLayer({
  size,
  cx,
  cy,
  headRadius,
  isProfessional,
}: {
  size: number;
  cx: number;
  cy: number;
  headRadius: number;
  isProfessional: boolean;
}) {
  return (
    <g>
      {/* Anatomical Nose (Nasion) */}
      <path
        d={`M ${cx - 12} ${cy - headRadius + 2} L ${cx} ${cy - headRadius - 14} L ${cx + 12} ${cy - headRadius + 2} Z`}
        fill="#f8fafc"
        stroke="#1e293b"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <text
        x={cx}
        y={14}
        textAnchor="middle"
        fill="#475569"
        fontSize={9}
        fontWeight={700}
        fontFamily="Plus Jakarta Sans, sans-serif"
      >
        {isProfessional ? 'TRƯỚC (NASION)' : 'PHÍA TRƯỚC'}
      </text>

      {/* Left & Right Ears */}
      <path
        d={`M ${cx - headRadius + 1} ${cy - 16} C ${cx - headRadius - 12} ${cy - 14}, ${cx - headRadius - 12} ${cy + 14}, ${cx - headRadius + 1} ${cy + 16}`}
        fill="#f8fafc"
        stroke="#1e293b"
        strokeWidth={1.5}
      />
      <path
        d={`M ${cx + headRadius - 1} ${cy - 16} C ${cx + headRadius + 12} ${cy - 14}, ${cx + headRadius + 12} ${cy + 14}, ${cx + headRadius - 1} ${cy + 16}`}
        fill="#f8fafc"
        stroke="#1e293b"
        strokeWidth={1.5}
      />

      {/* Anatomical Left / Right Orientation Markers */}
      <text
        x={11}
        y={cy + 4}
        textAnchor="middle"
        fill="#0f172a"
        fontSize={10}
        fontWeight={800}
        fontFamily="JetBrains Mono, monospace"
      >
        L
      </text>
      <text
        x={size - 11}
        y={cy + 4}
        textAnchor="middle"
        fill="#0f172a"
        fontSize={10}
        fontWeight={800}
        fontFamily="JetBrains Mono, monospace"
      >
        R
      </text>

      {/* Scalp Outer Contour */}
      <circle
        cx={cx}
        cy={cy}
        r={headRadius}
        fill="none"
        stroke="#1e293b"
        strokeWidth={1.8}
      />

      {/* Sagittal & Coronal Crosshairs */}
      <line
        x1={cx}
        y1={cy - headRadius}
        x2={cx}
        y2={cy + headRadius}
        stroke="rgba(15, 23, 42, 0.22)"
        strokeDasharray="3 3"
        strokeWidth={1}
      />
      <line
        x1={cx - headRadius}
        y1={cy}
        x2={cx + headRadius}
        y2={cy}
        stroke="rgba(15, 23, 42, 0.22)"
        strokeDasharray="3 3"
        strokeWidth={1}
      />
    </g>
  );
});

const ElectrodeMarker = memo(function ElectrodeMarker({
  name,
  sx,
  sy,
  isPhysical,
  isSelected,
  onSelect,
}: {
  name: string;
  sx: number;
  sy: number;
  isPhysical: boolean;
  isSelected: boolean;
  onSelect: (name: string) => void;
}) {
  return (
    <g
      className="cursor-pointer"
      onClick={() => onSelect(name)}
      onMouseEnter={() => onSelect(name)}
    >
      <circle
        cx={sx}
        cy={sy}
        r={isSelected ? 10.5 : isPhysical ? 8.5 : 7}
        fill={
          isSelected
            ? '#0f172a'
            : isPhysical
              ? 'rgba(255, 255, 255, 0.96)'
              : 'rgba(248, 250, 252, 0.85)'
        }
        stroke={isPhysical ? '#0f172a' : '#475569'}
        strokeWidth={isPhysical ? 1.8 : 1.1}
        strokeDasharray={isPhysical ? undefined : '2 1.5'}
      />
      <text
        x={sx}
        y={sy + 2.8}
        textAnchor="middle"
        fill={isSelected ? '#ffffff' : '#0f172a'}
        fontSize={isPhysical ? 7.5 : 6.6}
        fontWeight={isPhysical ? 800 : 600}
        fontFamily="JetBrains Mono, monospace"
      >
        {name}
      </text>
    </g>
  );
});

const TopomapLegendFooter = memo(function TopomapLegendFooter({
  meanBsi,
  leftAvgDar,
  rightAvgDar,
  dominantSide,
  metricMode,
  isProfessional,
}: {
  meanBsi: number;
  leftAvgDar: number;
  rightAvgDar: number;
  dominantSide: string;
  metricMode: 'delta' | 'dar';
  isProfessional: boolean;
}) {
  return (
    <>
      {/* Inline Hemispheric Asymmetry (BSI L/R) */}
      <div className="rounded-md border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span
          className={cn(
            'font-bold',
            meanBsi > 0.15 ? 'text-rose-700' : 'text-emerald-700',
          )}
        >
          {dominantSide}
        </span>
        <span className="font-mono tabular-nums text-[10.5px] text-slate-700">
          {isProfessional ? 'BSI L:' : 'Trái:'}{' '}
          <strong className="text-slate-900">{leftAvgDar.toFixed(2)}</strong> ·{' '}
          {isProfessional ? 'R:' : 'Phải:'}{' '}
          <strong className="text-slate-900">{rightAvgDar.toFixed(2)}</strong>
        </span>
      </div>

      {/* Compact Clinical Color & Channel Legend */}
      <div className="space-y-1 pt-1 border-t border-slate-100 text-[10px] text-slate-500">
        <div
          className="h-2 w-full rounded-full border border-slate-200"
          style={{
            background:
              'linear-gradient(to right, #0284c7 0%, #14b8a6 35%, #f59e0b 65%, #dc2626 100%)',
          }}
        />
        {isProfessional ? (
          <div className="flex justify-between font-mono tabular-nums">
            <span>{metricMode === 'dar' ? '0.6 Bình thường' : '8% Bình thường'}</span>
            <span>{metricMode === 'dar' ? '3.5' : '42%'}</span>
            <span>{metricMode === 'dar' ? '7.0+ DAR' : '78%+ Delta'}</span>
          </div>
        ) : (
          <div className="flex justify-between font-medium">
            <span>Bình thường</span>
            <span>Trung bình</span>
            <span>Sóng chậm cao</span>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block size-2 rounded-full border-2 border-slate-900 bg-white" />
            {isProfessional ? 'Vật lý (F3/F4/C3/C4/O1/O2)' : '6 điểm đo chính'}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block size-2 rounded-full border border-dashed border-slate-500 bg-slate-100" />
            {isProfessional ? '13 kênh nội suy' : '13 vùng nội suy'}
          </span>
        </div>
      </div>
    </>
  );
});

/** Maps normalized intensity [0, 1] to clinical RGB (Sky -> Teal -> Amber -> Crimson). */
function intensityToRgb(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped < 0.35) {
    // Sky (#0284c7) -> Clinical Teal (#14b8a6)
    const f = clamped / 0.35;
    return [
      Math.round(2 + (20 - 2) * f),
      Math.round(132 + (184 - 132) * f),
      Math.round(199 + (166 - 199) * f),
    ];
  }
  if (clamped < 0.65) {
    // Teal (#14b8a6) -> Amber (#f59e0b)
    const f = (clamped - 0.35) / 0.3;
    return [
      Math.round(20 + (245 - 20) * f),
      Math.round(184 + (158 - 184) * f),
      Math.round(166 + (11 - 166) * f),
    ];
  }
  // Amber (#f59e0b) -> Clinical Crimson (#dc2626)
  const f = (clamped - 0.65) / 0.35;
  return [
    Math.round(245 + (220 - 245) * f),
    Math.round(158 + (38 - 158) * f),
    Math.round(11 + (38 - 11) * f),
  ];
}

export function CorticalTopomap2D({
  nodes,
  meanBsi,
  meanDar,
  trafficLight = 'green',
  isProfessional = false,
}: CorticalTopomap2DProps) {
  const [metricMode, setMetricMode] = useState<'delta' | 'dar'>('delta');
  const [selectedNodeName, setSelectedNodeName] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const size = 240;
  const cx = 120;
  const cy = 124;
  const headRadius = 86;

  // Normalize coordinate scale safely in case nodes are already normalized or slightly outside [-1,1]
  const coordScale = useMemo(() => {
    if (nodes.length === 0) return 1;
    const maxAbs = Math.max(...nodes.map((n) => Math.max(Math.abs(n.x), Math.abs(n.y))), 1);
    return maxAbs > 1.05 ? 1 / maxAbs : 1;
  }, [nodes]);

  const normalizedNodes: NormalizedTopomapNode[] = useMemo(
    () =>
      nodes.map((node) => {
        const nx = node.x * coordScale;
        const ny = node.y * coordScale;
        const metricValue = metricMode === 'dar' ? node.dar : node.value;
        // Fixed clinical scale: Delta [0.08..0.78], DAR [0.6..7.0]
        const intensity =
          metricMode === 'dar'
            ? (metricValue - 0.6) / (7.0 - 0.6)
            : (metricValue - 0.08) / (0.78 - 0.08);
        return {
          ...node,
          sx: cx + nx * headRadius * 0.86,
          sy: cy - ny * headRadius * 0.86,
          nx,
          ny,
          intensity: Math.max(0, Math.min(1, intensity)),
        };
      }),
    [nodes, coordScale, metricMode],
  );

  const handleSelectNode = useCallback((name: string) => {
    setSelectedNodeName(name);
  }, []);

  // Hemispheric asymmetry comparison
  const lateralization = useMemo(() => {
    const leftNodes = nodes.filter((n) => LEFT_CHANNELS.has(n.name.toUpperCase()));
    const rightNodes = nodes.filter((n) => RIGHT_CHANNELS.has(n.name.toUpperCase()));
    const leftAvgDar =
      leftNodes.length > 0
        ? leftNodes.reduce((acc, n) => acc + n.dar, 0) / leftNodes.length
        : meanDar;
    const rightAvgDar =
      rightNodes.length > 0
        ? rightNodes.reduce((acc, n) => acc + n.dar, 0) / rightNodes.length
        : meanDar;

    let dominantSide = isProfessional ? 'Cân bằng hai bán cầu' : 'Cân bằng 2 bên';
    if (meanBsi > 0.15) {
      dominantSide =
        leftAvgDar > rightAvgDar
          ? isProfessional
            ? 'Chậm khu trú bán cầu Trái (Left)'
            : 'Nghiêng chậm bên Trái'
          : isProfessional
            ? 'Chậm khu trú bán cầu Phải (Right)'
            : 'Nghiêng chậm bên Phải';
    }

    return { leftAvgDar, rightAvgDar, dominantSide };
  }, [nodes, meanBsi, meanDar, isProfessional]);

  const activeNode = useMemo(() => {
    if (normalizedNodes.length === 0) return null;
    if (selectedNodeName) {
      return normalizedNodes.find((n) => n.name === selectedNodeName) ?? normalizedNodes[0]!;
    }
    // Default to electrode with highest DAR/value for immediate clinical insight
    return [...normalizedNodes].sort((a, b) => b.dar - a.dar)[0]!;
  }, [normalizedNodes, selectedNodeName]);

  // Render smooth IDW heatmap onto canvas clipped to head circle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || normalizedNodes.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;
    const rSqLimit = (headRadius - 1) * (headRadius - 1);

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const dx = px - cx;
        const dy = py - cy;
        const idx = (py * size + px) * 4;
        if (dx * dx + dy * dy > rSqLimit) {
          data[idx + 3] = 0;
          continue;
        }

        let weightedSum = 0;
        let weightTotal = 0;
        for (let k = 0; k < normalizedNodes.length; k++) {
          const nd = normalizedNodes[k]!;
          const ex = px - nd.sx;
          const ey = py - nd.sy;
          const d2 = ex * ex + ey * ey;
          const w = 1 / (d2 + 260);
          weightedSum += w * nd.intensity;
          weightTotal += w;
        }

        const interp = weightTotal > 0 ? weightedSum / weightTotal : 0;
        const [r, g, b] = intensityToRgb(interp);
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 195;
      }
    }

    ctx.clearRect(0, 0, size, size);
    ctx.putImageData(imgData, 0, 0);
  }, [normalizedNodes]);

  const statusPill = useMemo(() => {
    if (trafficLight === 'purple') {
      return {
        label: isProfessional ? 'Ổ nghi xuất huyết (Lockout tPA)' : 'Cảnh báo xuất huyết',
        cls: 'bg-red-900 text-white border-red-950',
      };
    }
    if (trafficLight === 'red') {
      return {
        label: isProfessional
          ? 'Chậm khu trú thiếu máu (Bất đối xứng)'
          : 'Sóng chậm khu trú (Lệch 2 bên)',
        cls: 'bg-rose-50 text-rose-800 border-rose-200',
      };
    }
    if (trafficLight === 'yellow') {
      return {
        label: isProfessional
          ? 'Sóng chậm lan tỏa đối xứng'
          : 'Sóng chậm nhẹ (Hai bên cân đối)',
        cls: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    }
    return {
      label: isProfessional ? 'Phân bố sinh lý bình thường' : 'Hoạt động bình thường',
      cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    };
  }, [trafficLight, isProfessional]);

  return (
    <div
      className={cn(
        'rounded-lg border bg-white overflow-hidden shadow-2xs flex flex-col justify-between',
        isProfessional ? 'border-slate-300' : 'border-slate-200/90',
      )}
    >
      {/* Header */}
      <div className="px-3 py-2 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Compass
            className={cn('size-4 shrink-0', isProfessional ? 'text-[#1E3A5F]' : 'text-teal-700')}
            aria-hidden
          />
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
            {isProfessional ? 'Bản đồ Vỏ não 2D (19 Kênh)' : 'Bản đồ Hoạt động Não 2D'}
          </h3>
        </div>

        <div
          className="inline-flex shrink-0 rounded-md border border-slate-200 bg-white p-0.5 text-[11px] font-semibold"
          role="group"
          aria-label="Chọn đại lượng hiển thị trên bản đồ vỏ não"
        >
          <button
            type="button"
            aria-pressed={metricMode === 'delta'}
            onClick={() => setMetricMode('delta')}
            className={cn(
              'rounded px-2 py-0.5 transition-colors',
              metricMode === 'delta'
                ? isProfessional
                  ? 'bg-[#162B47] text-white font-bold'
                  : 'bg-teal-700 text-white font-bold'
                : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {isProfessional ? 'Delta (%)' : 'Sóng chậm'}
          </button>
          <button
            type="button"
            aria-pressed={metricMode === 'dar'}
            onClick={() => setMetricMode('dar')}
            className={cn(
              'rounded px-2 py-0.5 transition-colors',
              metricMode === 'dar'
                ? isProfessional
                  ? 'bg-[#162B47] text-white font-bold'
                  : 'bg-teal-700 text-white font-bold'
                : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {isProfessional ? 'DAR' : 'Mức chậm'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={cn(
              'inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-bold',
              statusPill.cls,
            )}
          >
            {statusPill.label}
          </span>
          <span className="text-[11px] font-mono tabular-nums font-bold text-slate-700">
            {isProfessional
              ? `BSI: ${meanBsi.toFixed(3)} · DAR: ${meanDar.toFixed(2)}`
              : `Lệch: ${meanBsi.toFixed(3)} · Chậm: ${meanDar.toFixed(2)}`}
          </span>
        </div>

        {/* Anatomical Scalp Map */}
        <div className="relative mx-auto w-[216px] h-[216px] select-none">
          <canvas
            ref={canvasRef}
            width={size}
            height={size}
            className="absolute inset-0 w-full h-full pointer-events-none"
            aria-hidden
          />

          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="relative w-full h-full"
            role="img"
            aria-label="Bản đồ điện thế vỏ não 2D gồm 19 điện cực từ FP1 đến O2"
          >
            <ScalpAnatomyLayer
              size={size}
              cx={cx}
              cy={cy}
              headRadius={headRadius}
              isProfessional={isProfessional}
            />

            {/* 19 Electrodes FP1..O2 */}
            {normalizedNodes.map((node) => (
              <ElectrodeMarker
                key={node.name}
                name={node.name}
                sx={node.sx}
                sy={node.sy}
                isPhysical={node.isPhysical}
                isSelected={activeNode?.name === node.name}
                onSelect={handleSelectNode}
              />
            ))}
          </svg>
        </div>

        {/* Selected Electrode Inspection Pill */}
        {activeNode && (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="font-semibold text-slate-800">
              <span className="font-mono font-bold text-[#1E3A5F]">{activeNode.name}</span>{' '}
              <span className="text-slate-500">
                ({CHANNEL_ANATOMY_MAP[activeNode.name.toUpperCase()] ?? 'Vỏ não'} ·{' '}
                {activeNode.isPhysical ? (isProfessional ? 'Vật lý' : 'Đo trực tiếp') : 'Nội suy'})
              </span>
            </div>
            <div className="font-mono tabular-nums font-bold text-slate-900">
              {isProfessional
                ? `Delta: ${(activeNode.value * 100).toFixed(1)}% · DAR: ${activeNode.dar.toFixed(2)}`
                : `Sóng chậm: ${(activeNode.value * 100).toFixed(1)}% · Mức chậm: ${activeNode.dar.toFixed(2)}`}
            </div>
          </div>
        )}

        <TopomapLegendFooter
          meanBsi={meanBsi}
          leftAvgDar={lateralization.leftAvgDar}
          rightAvgDar={lateralization.rightAvgDar}
          dominantSide={lateralization.dominantSide}
          metricMode={metricMode}
          isProfessional={isProfessional}
        />
      </div>
    </div>
  );
}
