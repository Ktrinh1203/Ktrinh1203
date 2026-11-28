import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Compass } from 'lucide-react';
import type { QeegTopomapNode } from '../../api/types';
import { cn } from '../../components/ui';
import { CHANNEL_ANATOMY_MAP } from './eegLabels';

export type TopomapDisplayMode = 'MEASURED_6CH' | 'INTERPOLATED_ESTIMATE';
export type TopomapMetricMode = 'DELTA_REL' | 'DAR';

export interface CorticalTopomap2DProps {
  nodes: QeegTopomapNode[];
  meanBsi: number;
  meanDar: number;
  trafficLight?: 'green' | 'yellow' | 'red' | 'purple';
  isProfessional?: boolean;
  recordedChannels?: string[];
  qualitySuppressed?: boolean;
  channelStatuses?: Record<string, string>;
  defaultDisplayMode?: TopomapDisplayMode;
  metricMode?: TopomapMetricMode;
  onMetricModeChange?: (mode: TopomapMetricMode) => void;
  compact?: boolean;
}

const LEFT_CHANNELS = new Set(['FP1', 'F7', 'F3', 'T3', 'C3', 'T5', 'P3', 'O1']);
const RIGHT_CHANNELS = new Set(['FP2', 'F8', 'F4', 'T4', 'C4', 'T6', 'P4', 'O2']);

// Canonical 10-20 normalized scalp coordinates (x: left=-1..right=+1, y: posterior=-1..anterior=+1)
const STANDARD_10_20_LAYOUT: Array<{ name: string; x: number; y: number }> = [
  { name: 'FP1', x: -0.31, y: 0.90 },
  { name: 'FP2', x: 0.31, y: 0.90 },
  { name: 'F7', x: -0.78, y: 0.56 },
  { name: 'F3', x: -0.38, y: 0.48 },
  { name: 'FZ', x: 0.0, y: 0.48 },
  { name: 'F4', x: 0.38, y: 0.48 },
  { name: 'F8', x: 0.78, y: 0.56 },
  { name: 'T3', x: -0.92, y: 0.0 },
  { name: 'C3', x: -0.46, y: 0.0 },
  { name: 'CZ', x: 0.0, y: 0.0 },
  { name: 'C4', x: 0.46, y: 0.0 },
  { name: 'T4', x: 0.92, y: 0.0 },
  { name: 'T5', x: -0.78, y: -0.56 },
  { name: 'P3', x: -0.38, y: -0.48 },
  { name: 'PZ', x: 0.0, y: -0.48 },
  { name: 'P4', x: 0.38, y: -0.48 },
  { name: 'T6', x: 0.78, y: -0.56 },
  { name: 'O1', x: -0.31, y: -0.90 },
  { name: 'O2', x: 0.31, y: -0.90 },
];

function displayElectrodeName(upperName: string): string {
  if (upperName === 'FP1') return 'Fp1';
  if (upperName === 'FP2') return 'Fp2';
  if (upperName === 'FZ') return 'Fz';
  if (upperName === 'CZ') return 'Cz';
  if (upperName === 'PZ') return 'Pz';
  return upperName;
}

type ElectrodeState = 'MEASURED' | 'INTERPOLATED' | 'NOT_RECORDED' | 'INVALID';

interface NormalizedTopomapNode extends QeegTopomapNode {
  displayName: string;
  sx: number;
  sy: number;
  nx: number;
  ny: number;
  intensity: number;
  isMeasured: boolean;
  isInvalid: boolean;
  invalidReason?: string;
  state: ElectrodeState;
}

/** Maps normalized intensity [0, 1] to clinical RGB (Sky -> Teal -> Amber -> Crimson). */
function intensityToRgb(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped < 0.35) {
    const f = clamped / 0.35;
    return [
      Math.round(2 + (20 - 2) * f),
      Math.round(132 + (184 - 132) * f),
      Math.round(199 + (166 - 199) * f),
    ];
  }
  if (clamped < 0.65) {
    const f = (clamped - 0.35) / 0.3;
    return [
      Math.round(20 + (245 - 20) * f),
      Math.round(184 + (158 - 184) * f),
      Math.round(166 + (11 - 166) * f),
    ];
  }
  const f = (clamped - 0.65) / 0.35;
  return [
    Math.round(245 + (220 - 245) * f),
    Math.round(158 + (38 - 158) * f),
    Math.round(11 + (38 - 11) * f),
  ];
}

function rgbCss(rgb: [number, number, number], alpha = 1): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

const ScalpAnatomyLayer = memo(function ScalpAnatomyLayer({
  size,
  cx,
  cy,
  headRadius,
}: {
  size: number;
  cx: number;
  cy: number;
  headRadius: number;
}) {
  return (
    <g>
      {/* Anatomical Nose (Nasion) */}
      <path
        d={`M ${cx - 11} ${cy - headRadius + 2} L ${cx} ${cy - headRadius - 13} L ${cx + 11} ${cy - headRadius + 2} Z`}
        fill="#f8fafc"
        stroke="#1e293b"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <text
        x={cx}
        y={13}
        textAnchor="middle"
        fill="#334155"
        fontSize={8.5}
        fontWeight={700}
        fontFamily="Plus Jakarta Sans, sans-serif"
      >
        PHÍA TRƯỚC / NASION
      </text>

      {/* Left & Right Ears */}
      <path
        d={`M ${cx - headRadius + 1} ${cy - 15} C ${cx - headRadius - 11} ${cy - 13}, ${cx - headRadius - 11} ${cy + 13}, ${cx - headRadius + 1} ${cy + 15}`}
        fill="#f8fafc"
        stroke="#1e293b"
        strokeWidth={1.5}
      />
      <path
        d={`M ${cx + headRadius - 1} ${cy - 15} C ${cx + headRadius + 11} ${cy - 13}, ${cx + headRadius + 11} ${cy + 13}, ${cx + headRadius - 1} ${cy + 15}`}
        fill="#f8fafc"
        stroke="#1e293b"
        strokeWidth={1.5}
      />

      {/* Anatomical Left / Right Orientation Markers */}
      <text
        x={12}
        y={cy + 4}
        textAnchor="middle"
        fill="#0f172a"
        fontSize={10.5}
        fontWeight={800}
        fontFamily="JetBrains Mono, monospace"
      >
        L
      </text>
      <text
        x={size - 12}
        y={cy + 4}
        textAnchor="middle"
        fill="#0f172a"
        fontSize={10.5}
        fontWeight={800}
        fontFamily="JetBrains Mono, monospace"
      >
        R
      </text>

      {/* Posterior / Inion */}
      <text
        x={cx}
        y={size - 6}
        textAnchor="middle"
        fill="#475569"
        fontSize={8}
        fontWeight={700}
        fontFamily="Plus Jakarta Sans, sans-serif"
      >
        CHẨM / INION
      </text>

      {/* Scalp Outer Contour */}
      <circle cx={cx} cy={cy} r={headRadius} fill="none" stroke="#1e293b" strokeWidth={1.8} />

      {/* Sagittal & Coronal Crosshairs */}
      <line
        x1={cx}
        y1={cy - headRadius}
        x2={cx}
        y2={cy + headRadius}
        stroke="rgba(15, 23, 42, 0.18)"
        strokeDasharray="3 3"
        strokeWidth={1}
      />
      <line
        x1={cx - headRadius}
        y1={cy}
        x2={cx + headRadius}
        y2={cy}
        stroke="rgba(15, 23, 42, 0.18)"
        strokeDasharray="3 3"
        strokeWidth={1}
      />
    </g>
  );
});

const ElectrodeMarker = memo(function ElectrodeMarker({
  node,
  displayMode,
  metricMode,
  measuredCount,
  isSelected,
  onSelect,
}: {
  node: NormalizedTopomapNode;
  displayMode: TopomapDisplayMode;
  metricMode: TopomapMetricMode;
  measuredCount: number;
  isSelected: boolean;
  onSelect: (name: string) => void;
}) {
  const rgb = intensityToRgb(node.intensity);
  const formattedValue =
    metricMode === 'DAR' ? node.dar.toFixed(2) : `${(node.value * 100).toFixed(0)}%`;

  if (node.state === 'INVALID') {
    const errTag = node.invalidReason === 'DROPOUT' ? 'Mất' : node.invalidReason === 'SATURATED' ? 'Bão hòa' : 'Lỗi';
    const tooltip = `${node.displayName} — Tín hiệu lỗi (${node.invalidReason ?? 'DROPOUT/SATURATED'}), không hiển thị mức sóng chậm sinh lý`;
    return (
      <g
        className="cursor-pointer"
        onClick={() => onSelect(node.name)}
        onMouseEnter={() => onSelect(node.name)}
      >
        <title>{tooltip}</title>
        <circle
          cx={node.sx}
          cy={node.sy}
          r={isSelected ? 11.2 : 9.8}
          fill={isSelected ? '#334155' : '#f1f5f9'}
          stroke="#94a3b8"
          strokeWidth={1.8}
          strokeDasharray="2.5 1.8"
        />
        <text
          x={node.sx}
          y={node.sy + 2.7}
          textAnchor="middle"
          fill={isSelected ? '#ffffff' : '#475569'}
          fontSize={7.2}
          fontWeight={800}
          fontFamily="JetBrains Mono, monospace"
        >
          {node.displayName}
        </text>
        <rect
          x={node.sx - 16}
          y={node.sy + 10.5}
          width={32}
          height={10.5}
          rx={3}
          fill="#fffbeb"
          stroke="#d97706"
          strokeWidth={0.7}
        />
        <text
          x={node.sx}
          y={node.sy + 18}
          textAnchor="middle"
          fill="#92400e"
          fontSize={6.2}
          fontWeight={700}
          fontFamily="JetBrains Mono, monospace"
        >
          {errTag}
        </text>
      </g>
    );
  }

  if (node.state === 'NOT_RECORDED') {
    const tooltip = `${node.displayName} — Không đo / Chưa có dữ liệu (Not Recorded in ${measuredCount}-ch montage)`;
    return (
      <g
        className="cursor-pointer"
        onClick={() => onSelect(node.name)}
        onMouseEnter={() => onSelect(node.name)}
      >
        <title>{tooltip}</title>
        <circle
          cx={node.sx}
          cy={node.sy}
          r={isSelected ? 8.2 : 6.4}
          fill={isSelected ? '#e2e8f0' : 'rgba(248, 250, 252, 0.94)'}
          stroke={isSelected ? '#475569' : '#cbd5e1'}
          strokeWidth={isSelected ? 1.5 : 1.1}
        />
        <text
          x={node.sx}
          y={node.sy + 2.3}
          textAnchor="middle"
          fill="#64748b"
          fontSize={6.2}
          fontWeight={600}
          fontFamily="JetBrains Mono, monospace"
        >
          {node.displayName}
        </text>
      </g>
    );
  }

  if (node.state === 'INTERPOLATED') {
    const tooltip = `${node.displayName}: ${formattedValue} [Ước lượng nội suy Spline từ ${measuredCount} kênh — Không đo trực tiếp]`;
    return (
      <g
        className="cursor-pointer"
        onClick={() => onSelect(node.name)}
        onMouseEnter={() => onSelect(node.name)}
      >
        <title>{tooltip}</title>
        <circle
          cx={node.sx}
          cy={node.sy}
          r={isSelected ? 8.2 : 6.4}
          fill={isSelected ? '#334155' : 'rgba(255, 255, 255, 0.78)'}
          stroke="#475569"
          strokeWidth={1.1}
          strokeDasharray="2.2 1.6"
        />
        <text
          x={node.sx}
          y={node.sy + 2.3}
          textAnchor="middle"
          fill={isSelected ? '#ffffff' : '#334155'}
          fontSize={6.2}
          fontWeight={600}
          fontFamily="JetBrains Mono, monospace"
        >
          {node.displayName}
        </text>
      </g>
    );
  }

  // MEASURED electrode: local focal halo in MEASURED_6CH mode + bold solid circle + measured readout
  const tooltip = `${node.displayName}: ${formattedValue} [Đo trực tiếp]`;
  return (
    <g
      className="cursor-pointer"
      onClick={() => onSelect(node.name)}
      onMouseEnter={() => onSelect(node.name)}
    >
      <title>{tooltip}</title>
      {displayMode === 'MEASURED_6CH' && (
        <circle
          cx={node.sx}
          cy={node.sy}
          r={20}
          fill={rgbCss(rgb, 0.28)}
          stroke={rgbCss(rgb, 0.45)}
          strokeWidth={0.8}
        />
      )}
      <circle
        cx={node.sx}
        cy={node.sy}
        r={isSelected ? 11.2 : 9.8}
        fill={isSelected ? '#0f172a' : rgbCss(rgb, 0.22)}
        stroke={isSelected ? '#0f172a' : '#0f172a'}
        strokeWidth={2}
      />
      <circle
        cx={node.sx}
        cy={node.sy}
        r={isSelected ? 9.4 : 8.1}
        fill={isSelected ? '#0f172a' : 'rgba(255, 255, 255, 0.94)'}
      />
      <text
        x={node.sx}
        y={node.sy + 2.7}
        textAnchor="middle"
        fill={isSelected ? '#ffffff' : '#0f172a'}
        fontSize={7.6}
        fontWeight={800}
        fontFamily="JetBrains Mono, monospace"
      >
        {node.displayName}
      </text>
      {/* Direct measured readout tag right beneath electrode */}
      <rect
        x={node.sx - 13}
        y={node.sy + 10.5}
        width={26}
        height={10.5}
        rx={3}
        fill="rgba(255,255,255,0.92)"
        stroke={rgbCss(rgb, 0.7)}
        strokeWidth={0.7}
      />
      <text
        x={node.sx}
        y={node.sy + 18}
        textAnchor="middle"
        fill="#0f172a"
        fontSize={6.8}
        fontWeight={700}
        fontFamily="JetBrains Mono, monospace"
      >
        {formattedValue}
      </text>
    </g>
  );
});

export function CorticalTopomap2D({
  nodes,
  meanBsi,
  meanDar,
  trafficLight = 'green',
  isProfessional = false,
  recordedChannels,
  qualitySuppressed = false,
  channelStatuses,
  defaultDisplayMode = 'MEASURED_6CH',
  metricMode: metricModeProp,
  onMetricModeChange,
  compact = false,
}: CorticalTopomap2DProps) {
  const [displayMode, setDisplayMode] = useState<TopomapDisplayMode>(defaultDisplayMode);
  const [internalMetricMode, setInternalMetricMode] = useState<TopomapMetricMode>('DELTA_REL');
  const [selectedNodeName, setSelectedNodeName] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const metricMode: TopomapMetricMode = metricModeProp ?? internalMetricMode;
  const setMetricMode = useCallback(
    (next: TopomapMetricMode) => {
      if (metricModeProp === undefined) {
        setInternalMetricMode(next);
      }
      onMetricModeChange?.(next);
    },
    [metricModeProp, onMetricModeChange],
  );

  const size = 256;
  const cx = 128;
  const cy = 128;
  const headRadius = 84;

  const coordScale = useMemo(() => {
    if (nodes.length === 0) return 1;
    const maxAbs = Math.max(...nodes.map((n) => Math.max(Math.abs(n.x), Math.abs(n.y))), 1);
    return maxAbs > 1.05 ? 1 / maxAbs : 1;
  }, [nodes]);

  const recordedSet = useMemo(() => {
    if (!recordedChannels) return null;
    return new Set(recordedChannels.map((c) => c.trim().toUpperCase()));
  }, [recordedChannels]);

  const normalizedNodes: NormalizedTopomapNode[] = useMemo(() => {
    const incomingByUpper = new Map<string, QeegTopomapNode>();
    for (const nd of nodes) {
      incomingByUpper.set(nd.name.trim().toUpperCase(), nd);
    }

    const resolveChannelInvalid = (upper: string, incoming?: QeegTopomapNode) => {
      const chStatus = (channelStatuses?.[upper] ?? incoming?.qualityStatus)?.toUpperCase();
      const isInvalid =
        Boolean(incoming?.isInvalidQuality) ||
        chStatus === 'DROPOUT' ||
        chStatus === 'SATURATED';
      return { isInvalid, chStatus };
    };

    const merged: NormalizedTopomapNode[] = STANDARD_10_20_LAYOUT.map((std) => {
      const incoming = incomingByUpper.get(std.name);
      const nx = incoming ? incoming.x * coordScale : std.x;
      const ny = incoming ? incoming.y * coordScale : std.y;
      const { isInvalid, chStatus } = resolveChannelInvalid(std.name, incoming);
      const value = isInvalid ? 0 : (incoming?.value ?? 0);
      const dar = isInvalid ? 0 : (incoming?.dar ?? 0);

      const isRawRecorded = recordedSet
        ? recordedSet.has(std.name) && Boolean(incoming)
        : Boolean(incoming?.isPhysical);
      const isMeasured = isRawRecorded && !isInvalid;

      const metricValue = metricMode === 'DAR' ? dar : value;
      const rawIntensity = isInvalid
        ? 0
        : metricMode === 'DAR'
          ? (metricValue - 0.6) / (7.0 - 0.6)
          : (metricValue - 0.08) / (0.78 - 0.08);

      const state: ElectrodeState = isInvalid
        ? 'INVALID'
        : isMeasured
          ? 'MEASURED'
          : displayMode === 'INTERPOLATED_ESTIMATE'
            ? 'INTERPOLATED'
            : 'NOT_RECORDED';

      return {
        name: incoming?.name ?? displayElectrodeName(std.name),
        displayName: displayElectrodeName(std.name),
        x: nx,
        y: ny,
        isPhysical: isMeasured,
        value,
        dar,
        sx: cx + nx * headRadius * 0.84,
        sy: cy - ny * headRadius * 0.84,
        nx,
        ny,
        intensity: isInvalid ? 0 : Math.max(0, Math.min(1, rawIntensity)),
        isMeasured,
        isInvalid,
        invalidReason: chStatus,
        state,
      };
    });

    // Include any non-standard channels from nodes if present
    for (const nd of nodes) {
      const upper = nd.name.trim().toUpperCase();
      if (STANDARD_10_20_LAYOUT.some((s) => s.name === upper)) continue;
      const nx = nd.x * coordScale;
      const ny = nd.y * coordScale;
      const { isInvalid, chStatus } = resolveChannelInvalid(upper, nd);
      const isRawRecorded = recordedSet ? recordedSet.has(upper) : Boolean(nd.isPhysical);
      const isMeasured = isRawRecorded && !isInvalid;
      const value = isInvalid ? 0 : nd.value;
      const dar = isInvalid ? 0 : nd.dar;
      const metricValue = metricMode === 'DAR' ? dar : value;
      const rawIntensity = isInvalid
        ? 0
        : metricMode === 'DAR'
          ? (metricValue - 0.6) / (7.0 - 0.6)
          : (metricValue - 0.08) / (0.78 - 0.08);
      merged.push({
        ...nd,
        value,
        dar,
        displayName: nd.name,
        nx,
        ny,
        sx: cx + nx * headRadius * 0.84,
        sy: cy - ny * headRadius * 0.84,
        intensity: isInvalid ? 0 : Math.max(0, Math.min(1, rawIntensity)),
        isMeasured,
        isInvalid,
        invalidReason: chStatus,
        state: isInvalid
          ? 'INVALID'
          : isMeasured
            ? 'MEASURED'
            : displayMode === 'INTERPOLATED_ESTIMATE'
              ? 'INTERPOLATED'
              : 'NOT_RECORDED',
      });
    }

    return merged;
  }, [nodes, coordScale, recordedSet, metricMode, displayMode, channelStatuses]);

  const measuredNodes = useMemo(
    () => normalizedNodes.filter((n) => n.isMeasured),
    [normalizedNodes],
  );
  const measuredCount = measuredNodes.length;

  const handleSelectNode = useCallback((name: string) => {
    setSelectedNodeName(name);
  }, []);

  // Hemispheric asymmetry comparison calculated strictly on valid measured channels
  const lateralization = useMemo(() => {
    if (qualitySuppressed && measuredNodes.length === 0) {
      return {
        leftAvgDar: 0,
        rightAvgDar: 0,
        dominantSide: 'Không đủ kênh sạch để đánh giá đối xứng',
      };
    }
    const source = measuredNodes.length > 0 ? measuredNodes : normalizedNodes.filter((n) => !n.isInvalid);
    const leftNodes = source.filter((n) => LEFT_CHANNELS.has(n.name.toUpperCase()));
    const rightNodes = source.filter((n) => RIGHT_CHANNELS.has(n.name.toUpperCase()));
    const leftAvgDar =
      leftNodes.length > 0
        ? leftNodes.reduce((acc, n) => acc + n.dar, 0) / leftNodes.length
        : meanDar;
    const rightAvgDar =
      rightNodes.length > 0
        ? rightNodes.reduce((acc, n) => acc + n.dar, 0) / rightNodes.length
        : meanDar;

    let dominantSide = isProfessional ? 'Cân bằng hai bán cầu' : 'Cân bằng 2 bên';
    if (qualitySuppressed) {
      dominantSide = 'Không tin cậy do chất lượng tín hiệu';
    } else if (meanBsi > 0.15) {
      dominantSide =
        leftAvgDar > rightAvgDar
          ? isProfessional
            ? 'Chậm ưu thế bán cầu Trái (Left)'
            : 'Nghiêng chậm bên Trái'
          : isProfessional
            ? 'Chậm ưu thế bán cầu Phải (Right)'
            : 'Nghiêng chậm bên Phải';
    }

    return { leftAvgDar, rightAvgDar, dominantSide };
  }, [measuredNodes, normalizedNodes, meanBsi, meanDar, isProfessional, qualitySuppressed]);

  const activeNode = useMemo(() => {
    if (normalizedNodes.length === 0) return null;
    if (selectedNodeName) {
      return (
        normalizedNodes.find(
          (n) => n.name.toUpperCase() === selectedNodeName.toUpperCase(),
        ) ?? normalizedNodes[0]!
      );
    }
    const pool = measuredNodes.length > 0 ? measuredNodes : normalizedNodes;
    return [...pool].sort((a, b) => b.dar - a.dar)[0]!;
  }, [normalizedNodes, measuredNodes, selectedNodeName]);

  // Render smooth IDW/Spline heatmap ONLY when INTERPOLATED_ESTIMATE is explicitly active and valid anchors exist
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, size, size);
    if (displayMode !== 'INTERPOLATED_ESTIMATE') return;
    if (measuredNodes.length === 0) return;

    const anchors = measuredNodes;
    if (anchors.length === 0) return;

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
        for (let k = 0; k < anchors.length; k++) {
          const nd = anchors[k]!;
          const ex = px - nd.sx;
          const ey = py - nd.sy;
          const d2 = ex * ex + ey * ey;
          const w = 1 / (d2 + 320);
          weightedSum += w * nd.intensity;
          weightTotal += w;
        }

        const interp = weightTotal > 0 ? weightedSum / weightTotal : 0;
        const [r, g, b] = intensityToRgb(interp);
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        // Reduced opacity so interpolated surface clearly reads as a reference estimate
        data[idx + 3] = 135;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [displayMode, measuredNodes]);

  const summaryState = useMemo(() => {
    if (qualitySuppressed) {
      return {
        label: 'Tín hiệu không đạt chuẩn',
        cls: 'text-amber-800',
      };
    }
    if (trafficLight === 'purple') {
      return {
        label: isProfessional
          ? 'Cảnh báo sóng chậm nặng · Đối chiếu CT'
          : 'Cảnh báo bất thường nặng · Kiểm tra CT',
        cls: 'text-red-800',
      };
    }
    if (trafficLight === 'red') {
      const sideText =
        lateralization.leftAvgDar >= lateralization.rightAvgDar
          ? 'Tăng sóng chậm bán cầu trái'
          : 'Tăng sóng chậm bán cầu phải';
      return {
        label: sideText,
        cls: 'text-rose-700',
      };
    }
    if (trafficLight === 'yellow') {
      return {
        label: isProfessional ? 'Sóng chậm lan tỏa đối xứng' : 'Sóng chậm nhẹ (Hai bên cân đối)',
        cls: 'text-amber-700',
      };
    }
    if (meanBsi > 0.15) {
      return {
        label:
          lateralization.leftAvgDar >= lateralization.rightAvgDar
            ? 'Tăng sóng chậm bán cầu trái'
            : 'Tăng sóng chậm bán cầu phải',
        cls: 'text-rose-700',
      };
    }
    return {
      label: isProfessional ? 'Phân bố sinh lý bình thường' : 'Hoạt động bình thường',
      cls: 'text-emerald-700',
    };
  }, [trafficLight, isProfessional, qualitySuppressed, meanBsi, lateralization]);

  return (
    <div
      className={cn(
        'rounded-lg border bg-white overflow-hidden flex flex-col',
        isProfessional ? 'border-slate-300' : 'border-slate-200/90',
      )}
    >
      {/* 1-line Header */}
      <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Compass
            className={cn(
              'size-4 shrink-0',
              isProfessional ? 'text-[#1E3A5F]' : 'text-teal-700',
            )}
            aria-hidden
          />
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate">
              Bản đồ phân bố EEG trên da đầu
            </h3>
            <p className="text-[10.5px] font-medium text-slate-500 leading-tight truncate">
              EEG Scalp Topography
            </p>
          </div>
        </div>

        <div
          className="inline-flex shrink-0 rounded-md border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold"
          role="group"
          aria-label="Chọn đại lượng hiển thị trên bản đồ phân bố EEG"
        >
          <button
            type="button"
            aria-pressed={metricMode === 'DELTA_REL'}
            onClick={() => setMetricMode('DELTA_REL')}
            className={cn(
              'rounded px-2 py-0.5 transition-colors',
              metricMode === 'DELTA_REL'
                ? isProfessional
                  ? 'bg-[#162B47] text-white font-bold'
                  : 'bg-teal-700 text-white font-bold'
                : 'text-slate-600 hover:bg-white',
            )}
          >
            Delta (%)
          </button>
          <button
            type="button"
            aria-pressed={metricMode === 'DAR'}
            onClick={() => setMetricMode('DAR')}
            className={cn(
              'rounded px-2 py-0.5 transition-colors',
              metricMode === 'DAR'
                ? isProfessional
                  ? 'bg-[#162B47] text-white font-bold'
                  : 'bg-teal-700 text-white font-bold'
                : 'text-slate-600 hover:bg-white',
            )}
          >
            DAR
          </button>
        </div>
      </div>

      {/* Flat Body */}
      <div className={cn(compact ? 'p-2.5 space-y-2' : 'p-3.5 space-y-2.5')}>
        {/* Compact Display Mode Switch */}
        <div
          className="inline-flex w-full rounded-md border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold"
          role="group"
          aria-label="Chọn chế độ hiển thị kênh đo thực tế hoặc nội suy tham khảo"
        >
          <button
            type="button"
            aria-pressed={displayMode === 'MEASURED_6CH'}
            onClick={() => setDisplayMode('MEASURED_6CH')}
            className={cn(
              'flex-1 rounded px-2 py-1 transition-colors text-center',
              displayMode === 'MEASURED_6CH'
                ? isProfessional
                  ? 'bg-[#162B47] text-white font-bold'
                  : 'bg-teal-700 text-white font-bold'
                : 'text-slate-600 hover:bg-white',
            )}
          >
            Kênh đo ({measuredCount > 0 ? measuredCount : 6})
          </button>
          <button
            type="button"
            aria-pressed={displayMode === 'INTERPOLATED_ESTIMATE'}
            onClick={() => setDisplayMode('INTERPOLATED_ESTIMATE')}
            className={cn(
              'flex-1 rounded px-2 py-1 transition-colors text-center',
              displayMode === 'INTERPOLATED_ESTIMATE'
                ? 'bg-amber-600 text-white font-bold'
                : 'text-slate-600 hover:bg-white',
            )}
          >
            Nội suy (Tham khảo)
          </button>
        </div>

        {/* Single Summary Line */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className={cn('font-semibold', summaryState.cls)}>{summaryState.label}</span>
          <span className="font-mono tabular-nums text-slate-600">
            {qualitySuppressed && measuredCount === 0
              ? 'BSI: N/A · DAR: N/A'
              : `BSI: ${meanBsi.toFixed(3)} · DAR: ${meanDar.toFixed(2)}`}
          </span>
        </div>

        {/* Anatomical Scalp Map */}
        <div
          className={cn(
            'relative mx-auto select-none',
            compact ? 'w-[216px] h-[216px]' : 'w-[236px] h-[236px]',
          )}
        >
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
            aria-label="Bản đồ phân bố EEG trên da đầu gồm 19 vị trí chuẩn 10-20"
          >
            <ScalpAnatomyLayer size={size} cx={cx} cy={cy} headRadius={headRadius} />

            {normalizedNodes.map((node) => (
              <ElectrodeMarker
                key={node.name}
                node={node}
                displayMode={displayMode}
                metricMode={metricMode}
                measuredCount={measuredCount > 0 ? measuredCount : 6}
                isSelected={activeNode?.name.toUpperCase() === node.name.toUpperCase()}
                onSelect={handleSelectNode}
              />
            ))}
          </svg>
        </div>

        {/* Interpolation Caution Note */}
        {displayMode === 'INTERPOLATED_ESTIMATE' && (
          <p className="text-[10.5px] leading-snug text-amber-800 text-center">
            Nội suy tham khảo từ {measuredCount > 0 ? measuredCount : 6} kênh đo — không dùng để
            định khu vùng không đo.
          </p>
        )}

        {/* Selected Electrode Inline Readout */}
        {activeNode && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-100">
            <span className="truncate">
              <strong className="font-mono text-slate-900">{activeNode.displayName}</strong>{' '}
              <span className="text-slate-500">
                ({CHANNEL_ANATOMY_MAP[activeNode.name.toUpperCase()] ?? '10-20'})
              </span>
            </span>
            {activeNode.state === 'INVALID' ? (
              <span className="font-medium text-amber-800">
                Lỗi ({activeNode.invalidReason ?? 'DROPOUT/SATURATED'})
              </span>
            ) : activeNode.state === 'NOT_RECORDED' ? (
              <span className="text-slate-500">Không đo / Chưa có dữ liệu</span>
            ) : (
              <span className="font-mono tabular-nums font-semibold text-slate-800">
                Delta {(activeNode.value * 100).toFixed(1)}% · DAR {activeNode.dar.toFixed(2)}
                {activeNode.state === 'INTERPOLATED' ? ' (Nội suy)' : ''}
              </span>
            )}
          </div>
        )}

        {/* Minimalist Color Scale + Single 3-State Legend */}
        <div className="space-y-1.5 pt-1.5 border-t border-slate-100 text-[10px] text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-mono tabular-nums text-slate-500 shrink-0">
              {metricMode === 'DAR' ? '0.6' : '8%'}
            </span>
            <div
              className="h-1.5 flex-1 rounded-full border border-slate-200"
              style={{
                background:
                  'linear-gradient(to right, #0284c7 0%, #14b8a6 35%, #f59e0b 65%, #dc2626 100%)',
              }}
            />
            <span className="font-mono tabular-nums text-slate-500 shrink-0">
              {metricMode === 'DAR' ? '7.0+ DAR' : '78%+ Delta'}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[10.5px] text-slate-600">
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block size-2 rounded-full bg-slate-900 border border-slate-900"
                aria-hidden
              />
              Đo trực tiếp
            </span>
            <span aria-hidden className="text-slate-300">
              ·
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block size-2 rounded-full border border-dashed border-slate-600 bg-slate-100"
                aria-hidden
              />
              Nội suy tham khảo
            </span>
            <span aria-hidden className="text-slate-300">
              ·
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block size-2 rounded-full border border-slate-400 bg-white"
                aria-hidden
              />
              Không đo
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
