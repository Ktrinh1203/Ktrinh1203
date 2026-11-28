import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Database,
  ExternalLink,
  FileDown,
  FileUp,
  MessageSquarePlus,
  MoreHorizontal,
  RefreshCw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { qeegApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type {
  ClinicalCategory,
  DatasetSplit,
  EegDatasetRecord,
  NeuralLabel,
  NeuralTrainingSampleItem,
  QeegAnalysisResult,
  QeegCaseItem,
  QeegTopomapNode,
} from '../../api/types';
import { Alert, Button, Card, Input, Spinner, Textarea, cn } from '../../components/ui';
import { useAuth } from '../auth/AuthContext';
import { BrainWaveformViewer } from './BrainWaveformViewer';
import {
  CHANNEL_ANATOMY_MAP,
  CLINICAL_CATEGORY_META,
  CLINICAL_CATEGORY_ORDER,
  DATASET_SPLIT_META,
  DATASET_SPLIT_ORDER,
  NEURAL_LABEL_META,
  NEURAL_LABEL_ORDER,
  formatSafetyStatusLabel,
  sanitizeClinicalDisplayText,
} from './eegLabels';

export interface QeegStudioPanelProps {
  isProfessional?: boolean;
  onSavedToPlatform?: (dataset: EegDatasetRecord, sample: NeuralTrainingSampleItem) => void;
  onSwitchTab?: (tab: 'personal' | 'databank' | 'neural-db') => void;
}

const FALLBACK_CASES: QeegCaseItem[] = [
  {
    id: 'case_ischemia_lvo',
    name: 'Ca 1: Thiếu máu LVO trái (F3/C3)',
    subjectId: 'BN-STROKE-01',
    clinicalCategory: 'VASCULAR_STROKE',
    groundTruthLabel: 'ISCHEMIC_STROKE',
    clinicalPresentation: 'Liệt nửa người phải, chậm khu trú Delta trái.',
    trafficLight: 'red',
    tpaStatus: 'ELIGIBLE',
    badge: 'Nghi LVO',
    samplingRateHz: 500,
    channelsCount: 6,
  },
  {
    id: 'case_ich_hemorrhage',
    name: 'Ca 2: Xuất huyết ICH · Khóa tPA',
    subjectId: 'BN-ICH-02',
    clinicalCategory: 'VASCULAR_STROKE',
    groundTruthLabel: 'HEMORRHAGIC_STROKE',
    clinicalPresentation: 'Đau đầu dữ dội, sóng chậm lan tỏa hiệu ứng khối.',
    trafficLight: 'purple',
    tpaStatus: 'ABSOLUTELY_CONTRAINDICATED',
    badge: 'Khóa an toàn tPA',
    samplingRateHz: 500,
    channelsCount: 6,
  },
  {
    id: 'case_epilepsy_temporal',
    name: 'Ca 3: Động kinh thùy thái dương',
    subjectId: 'BN-EPI-03',
    clinicalCategory: 'EPILEPSY_ICU',
    groundTruthLabel: 'EPILEPTIFORM_SLOWING',
    clinicalPresentation: 'Phóng điện nhọn - sóng chậm thái dương - trung tâm.',
    trafficLight: 'yellow',
    tpaStatus: 'NOT_APPLICABLE',
    badge: 'Động kinh & ICU',
    samplingRateHz: 500,
    channelsCount: 6,
  },
  {
    id: 'case_sleep_fatigue_n3',
    name: 'Ca 4: Ngủ N3 / Mệt mỏi não',
    subjectId: 'BN-SLEEP-04',
    clinicalCategory: 'SLEEP_COGNITIVE',
    groundTruthLabel: 'COGNITIVE_FATIGUE',
    clinicalPresentation: 'Delta đối xứng, BSI < 0.10, loại trừ tắc mạch cấp.',
    trafficLight: 'yellow',
    tpaStatus: 'NOT_APPLICABLE',
    badge: 'Giấc ngủ',
    samplingRateHz: 500,
    channelsCount: 6,
  },
  {
    id: 'case_healthy_alpha',
    name: 'Ca 5: Sinh lý Alpha chẩm ổn định',
    subjectId: 'BN-CTRL-05',
    clinicalCategory: 'SLEEP_COGNITIVE',
    groundTruthLabel: 'CONTROL',
    clinicalPresentation: 'Nhịp Alpha 10.2 Hz vùng chẩm O1/O2 khi nhắm mắt.',
    trafficLight: 'green',
    tpaStatus: 'NOT_APPLICABLE',
    badge: 'Sinh lý chuẩn',
    samplingRateHz: 500,
    channelsCount: 6,
  },
  {
    id: 'case_ads1299_hardware',
    name: 'Ca 6: Phần cứng ADS1299 500 Hz',
    subjectId: 'HW-ADS1299-06',
    clinicalCategory: 'HARDWARE_BCI',
    groundTruthLabel: 'CONTROL',
    clinicalPresentation: 'Thu trực tiếp TI ADS1299 6 kênh 10-20 (500 Hz).',
    trafficLight: 'green',
    tpaStatus: 'MONITORING',
    badge: 'TI ADS1299',
    samplingRateHz: 500,
    channelsCount: 6,
  },
];

const QUICK_SAMPLE_PRESETS = [
  { id: 'case_healthy_alpha', label: 'Ổn định' },
  { id: 'case_sleep_fatigue_n3', label: 'Thiếu ngủ' },
  { id: 'case_epilepsy_temporal', label: 'Động kinh' },
  { id: 'case_ischemia_lvo', label: 'Đột quỵ' },
] as const;

function trafficBannerStyle(trafficLight: QeegAnalysisResult['trafficLight']) {
  if (trafficLight === 'purple') {
    return {
      dot: 'bg-red-700',
      border: 'border-red-300 bg-red-50/40',
      label: 'CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI tPA · KHÓA AN TOÀN',
    };
  }
  if (trafficLight === 'red') {
    return {
      dot: 'bg-red-600',
      border: 'border-red-300 bg-red-50/35',
      label: 'CẢNH BÁO ĐỘT QUỴ CẤP · CHỤP CT SỌ NÃO KHẨN',
    };
  }
  if (trafficLight === 'yellow') {
    return {
      dot: 'bg-amber-500',
      border: 'border-amber-200 bg-amber-50/25',
      label: 'BẤT THƯỜNG KHÔNG ĐỘT QUỴ / THEO DÕI CHUYÊN KHOA',
    };
  }
  return {
    dot: 'bg-[#16A34A]',
    border: 'border-[#DCE6DF] bg-white',
    label: 'ĐIỆN NÃO ĐỒ SINH LÝ ỔN ĐỊNH',
  };
}

function generalStatusLabel(trafficLight: QeegAnalysisResult['trafficLight']) {
  if (trafficLight === 'green') return 'Ổn định';
  if (trafficLight === 'yellow') return 'Cần lưu ý';
  if (trafficLight === 'red') return 'Cảnh báo đột quỵ · Gọi 115';
  return 'Cảnh báo xuất huyết · Khóa tPA · Gọi 115';
}

function plainSummaryByTrafficLight(trafficLight: QeegAnalysisResult['trafficLight']) {
  if (trafficLight === 'green') {
    return 'Nhịp Alpha cân đối và ổn định, phù hợp làm việc hoặc nghỉ ngơi.';
  }
  if (trafficLight === 'yellow') {
    return 'Có dấu hiệu sóng chậm nhẹ, nên nghỉ ngơi và theo dõi thêm.';
  }
  if (trafficLight === 'red') {
    return 'Phát hiện dấu hiệu nguy cơ đột quỵ cấp — cần chụp CT khẩn; nếu có triệu chứng thật, gọi 115 ngay.';
  }
  return 'Cảnh báo xuất huyết não (Khóa tPA) — cần gọi 115 và chụp CT khẩn ngay lập tức.';
}

// ---------------------------------------------------------------------------
// Compact 2D Cortical Topomap (clean title, no duplicate KPI numbers)
// ---------------------------------------------------------------------------

interface NormalizedTopomapNode extends QeegTopomapNode {
  sx: number;
  sy: number;
  intensity: number;
}

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
      <circle cx={cx} cy={cy} r={headRadius} fill="none" stroke="#1e293b" strokeWidth={1.8} />
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

const CompactCorticalTopomap = memo(function CompactCorticalTopomap({
  nodes,
  trafficLight,
  isProfessional,
}: {
  nodes: QeegTopomapNode[];
  trafficLight: QeegAnalysisResult['trafficLight'];
  isProfessional: boolean;
}) {
  const [metricMode, setMetricMode] = useState<'delta' | 'dar'>('delta');
  const [selectedNodeName, setSelectedNodeName] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const size = 240;
  const cx = 120;
  const cy = 124;
  const headRadius = 86;

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
        const intensity =
          metricMode === 'dar'
            ? (metricValue - 0.6) / (7.0 - 0.6)
            : (metricValue - 0.08) / (0.78 - 0.08);
        return {
          ...node,
          sx: cx + nx * headRadius * 0.86,
          sy: cy - ny * headRadius * 0.86,
          intensity: Math.max(0, Math.min(1, intensity)),
        };
      }),
    [nodes, coordScale, metricMode],
  );

  const handleSelectNode = useCallback((name: string) => {
    setSelectedNodeName(name);
  }, []);

  const inspectedNode = useMemo(() => {
    if (!selectedNodeName) return null;
    return normalizedNodes.find((n) => n.name === selectedNodeName) ?? null;
  }, [normalizedNodes, selectedNodeName]);

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
          const w = 1 / (ex * ex + ey * ey + 260);
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
        label: isProfessional ? 'Ổ nghi xuất huyết (Khóa tPA)' : 'Cảnh báo xuất huyết',
        cls: 'bg-red-900 text-white border-red-950',
      };
    }
    if (trafficLight === 'red') {
      return {
        label: isProfessional ? 'Chậm khu trú thiếu máu' : 'Sóng chậm khu trú',
        cls: 'bg-rose-50 text-rose-800 border-rose-200',
      };
    }
    if (trafficLight === 'yellow') {
      return {
        label: isProfessional ? 'Sóng chậm lan tỏa' : 'Sóng chậm nhẹ',
        cls: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    }
    return {
      label: isProfessional ? 'Phân bố sinh lý bình thường' : 'Hoạt động bình thường',
      cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    };
  }, [trafficLight, isProfessional]);

  return (
    <div className="rounded-xl border border-[#DCE6DF] bg-white overflow-hidden">
      {/* Header: crisp non-truncating title + Delta/DAR toggle */}
      <div className="px-3.5 py-2.5 bg-[#F5FAF7] border-b border-[#DCE6DF] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 shrink-0">
          <Compass className="size-4 shrink-0 text-[#15803D]" aria-hidden />
          <h3 className="text-xs sm:text-sm font-bold text-[#141413] whitespace-nowrap">
            Bản đồ vỏ não
          </h3>
        </div>

        <div
          className="inline-flex shrink-0 rounded-md border border-[#DCE6DF] bg-white p-0.5 text-[11px] font-semibold"
          role="group"
          aria-label="Chọn đại lượng hiển thị trên bản đồ vỏ não"
        >
          <button
            type="button"
            aria-pressed={metricMode === 'delta'}
            onClick={() => setMetricMode('delta')}
            className={cn(
              'rounded px-2 py-0.5 transition-colors whitespace-nowrap',
              metricMode === 'delta'
                ? 'bg-[#16A34A] text-white font-bold'
                : 'text-[#575652] hover:bg-[#F5FAF7]',
            )}
          >
            {isProfessional ? 'Delta' : 'Sóng chậm'}
          </button>
          <button
            type="button"
            aria-pressed={metricMode === 'dar'}
            onClick={() => setMetricMode('dar')}
            className={cn(
              'rounded px-2 py-0.5 transition-colors whitespace-nowrap',
              metricMode === 'dar'
                ? 'bg-[#16A34A] text-white font-bold'
                : 'text-[#575652] hover:bg-[#F5FAF7]',
            )}
          >
            {isProfessional ? 'DAR' : 'Mức chậm'}
          </button>
        </div>
      </div>

      {/* Body: overall status pill + brain map + minimal color legend */}
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold',
              statusPill.cls,
            )}
          >
            {statusPill.label}
          </span>
          {inspectedNode && (
            <span className="text-[11px] font-mono text-[#575652] truncate">
              <strong className="text-[#141413]">{inspectedNode.name}</strong>{' '}
              ({CHANNEL_ANATOMY_MAP[inspectedNode.name.toUpperCase()] ?? 'Vỏ não'}):{' '}
              {metricMode === 'dar'
                ? `${inspectedNode.dar.toFixed(2)}`
                : `${(inspectedNode.value * 100).toFixed(0)}%`}
            </span>
          )}
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
            {normalizedNodes.map((node) => (
              <ElectrodeMarker
                key={node.name}
                name={node.name}
                sx={node.sx}
                sy={node.sy}
                isPhysical={node.isPhysical}
                isSelected={inspectedNode?.name === node.name}
                onSelect={handleSelectNode}
              />
            ))}
          </svg>
        </div>

        {/* Minimal Color Legend */}
        <div className="space-y-1 pt-1 border-t border-[#EFF6F1] text-[10.5px] text-[#6E6D68]">
          <div
            className="h-2 w-full rounded-full border border-[#DCE6DF]"
            style={{
              background:
                'linear-gradient(to right, #0284c7 0%, #14b8a6 35%, #f59e0b 65%, #dc2626 100%)',
            }}
          />
          <div className="flex justify-between font-medium">
            <span>Bình thường</span>
            <span>Trung bình</span>
            <span>Sóng chậm cao</span>
          </div>
        </div>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Main QeegStudioPanel
// ---------------------------------------------------------------------------

export function QeegStudioPanel({
  isProfessional = false,
  onSavedToPlatform,
  onSwitchTab,
}: QeegStudioPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [sourceMode, setSourceMode] = useState<'sample' | 'csv'>('sample');
  const [selectedCaseId, setSelectedCaseId] = useState<string>(
    isProfessional ? 'case_ischemia_lvo' : 'case_healthy_alpha',
  );
  const [timeWindowSec, setTimeWindowSec] = useState<number>(6);
  const [notch50Hz, setNotch50Hz] = useState<boolean>(true);
  const [fastScore, setFastScore] = useState<number>(2);

  // CSV Upload state
  const [csvFilename, setCsvFilename] = useState<string>('');
  const [csvText, setCsvText] = useState<string>('');
  const [csvSamplingRate, setCsvSamplingRate] = useState<number>(500);
  const [csvCategory, setCsvCategory] = useState<ClinicalCategory>('VASCULAR_STROKE');

  const [analysis, setAnalysis] = useState<QeegAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Sequential Pop-up Modal state (Save to Platform)
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveSubjectCode, setSaveSubjectCode] = useState('');
  const [saveCategory, setSaveCategory] = useState<ClinicalCategory>('VASCULAR_STROKE');
  const [saveLabel, setSaveLabel] = useState<NeuralLabel>('ISCHEMIC_STROKE');
  const [saveSplit, setSaveSplit] = useState<DatasetSplit>('TRAIN');
  const [saveNote, setSaveNote] = useState('');
  const [deidentifiedConfirmed, setDeidentifiedConfirmed] = useState(true);
  const [savedSampleId, setSavedSampleId] = useState<string | null>(null);
  const [savedDatasetId, setSavedDatasetId] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  // Secondary menu + Deep details (default CLOSED)
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);

  const casesQuery = useQuery({
    queryKey: ['qeeg-cases'],
    queryFn: () => qeegApi.getCases(),
    enabled: Boolean(user),
  });

  const cases = casesQuery.data?.cases?.length ? casesQuery.data.cases : FALLBACK_CASES;

  const analyzeCaseMutation = useMutation({
    mutationFn: (payload: {
      caseId: string;
      timeWindowSec: number;
      notch50Hz: boolean;
      fastScore: number;
    }) => qeegApi.analyzeCase(payload),
    onSuccess: (res) => {
      setAnalysis(res);
      setAnalysisError(null);
      setSavedSampleId(null);
      setSavedDatasetId(null);
      setSaveFeedback(null);
      const matched = cases.find((c) => c.id === res.caseId);
      setSaveTitle(matched ? `qEEG · ${matched.name}` : `Bản ghi qEEG (${res.caseId})`);
      setSaveSubjectCode(matched?.subjectId ?? `NL-${Date.now().toString().slice(-4)}`);
      setSaveCategory(res.clinicalCategory);
      setSaveLabel(res.classificationLabel);
      setSaveNote(sanitizeClinicalDisplayText(res.decisionReason));
      setDeidentifiedConfirmed(true);
    },
    onError: (err) => {
      setAnalysisError(errorMessage(err));
    },
  });

  const analyzeCsvMutation = useMutation({
    mutationFn: (override?: {
      filename: string;
      csvText: string;
      samplingRateHz: number;
      clinicalCategory: ClinicalCategory;
    } | void) =>
      qeegApi.analyzeCsv({
        filename: override ? override.filename : csvFilename || 'uploaded_eeg.csv',
        csvText: override ? override.csvText : csvText,
        samplingRateHz: override ? override.samplingRateHz : csvSamplingRate,
        clinicalCategory: override ? override.clinicalCategory : csvCategory,
      }),
    onSuccess: (res, vars) => {
      const resolvedFilename = vars ? vars.filename : csvFilename;
      setAnalysis(res);
      setAnalysisError(null);
      setSavedSampleId(null);
      setSavedDatasetId(null);
      setSaveFeedback(null);
      setSaveTitle(`CSV qEEG · ${resolvedFilename || 'Bản ghi tải lên'}`);
      setSaveSubjectCode(`CSV-${Date.now().toString().slice(-4)}`);
      setSaveCategory(res.clinicalCategory);
      setSaveLabel(res.classificationLabel);
      setSaveNote(sanitizeClinicalDisplayText(res.decisionReason));
      setDeidentifiedConfirmed(true);
    },
    onError: (err) => {
      setAnalysisError(errorMessage(err));
    },
  });

  const saveToPlatformMutation = useMutation({
    mutationFn: () => {
      if (!analysis) throw new Error('Chưa có kết quả phân tích để lưu.');
      return qeegApi.saveToPlatform({
        title: saveTitle.trim(),
        clinicalCategory: saveCategory,
        groundTruthLabel: saveLabel,
        split: saveSplit,
        subjectCode: saveSubjectCode.trim() || undefined,
        clinicalNote: saveNote.trim() || analysis.decisionReason,
        deidentifiedConfirmed,
        analysis,
      });
    },
    onSuccess: (res) => {
      setSavedSampleId(res.sample.id);
      setSavedDatasetId(res.dataset.id);
      setShowSaveModal(false);
      setSaveFeedback({
        tone: 'success',
        text: `Đã lưu bản ghi ${res.sample.subjectCode} vào Hồ sơ đã lưu (${res.dataset.patientCode}) và Kho dữ liệu AI.`,
      });
      queryClient.invalidateQueries({ queryKey: ['neural-db-stats'] });
      queryClient.invalidateQueries({ queryKey: ['neural-db-samples'] });
      onSavedToPlatform?.(res.dataset, res.sample);
    },
    onError: (err) => {
      setSaveFeedback({ tone: 'error', text: errorMessage(err) });
    },
  });

  // Automatically run initial analysis on mount (Plug & Play)
  useEffect(() => {
    if (!user) return;
    analyzeCaseMutation.mutate({
      caseId: selectedCaseId,
      timeWindowSec,
      notch50Hz,
      fastScore,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Close modal & dropdowns on Escape / outside click
  useEffect(() => {
    if (!showSaveModal && !showMoreMenu && !showFilterMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSaveModal(false);
        setShowMoreMenu(false);
        setShowFilterMenu(false);
      }
    };
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (showMoreMenu && moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setShowMoreMenu(false);
      }
      if (showFilterMenu && filterMenuRef.current && !filterMenuRef.current.contains(target)) {
        setShowFilterMenu(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [showSaveModal, showMoreMenu, showFilterMenu]);

  const handleSelectCase = (caseId: string) => {
    setSourceMode('sample');
    setSelectedCaseId(caseId);
    analyzeCaseMutation.mutate({
      caseId,
      timeWindowSec,
      notch50Hz,
      fastScore,
    });
  };

  const handleCsvSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const sliced = text.slice(0, 350_000);
    setCsvFilename(file.name);
    setCsvText(sliced);
    setSourceMode('csv');
    analyzeCsvMutation.mutate({
      filename: file.name,
      csvText: sliced,
      samplingRateHz: csvSamplingRate,
      clinicalCategory: csvCategory,
    });
    e.target.value = '';
  };

  const handleSaveSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!deidentifiedConfirmed) {
      setSaveFeedback({
        tone: 'error',
        text: 'Vui lòng xác nhận dữ liệu đã ẩn danh cá nhân trước khi lưu.',
      });
      return;
    }
    if (saveTitle.trim().length < 3) {
      setSaveFeedback({
        tone: 'error',
        text: 'Tiêu đề bản ghi cần tối thiểu 3 ký tự.',
      });
      return;
    }
    saveToPlatformMutation.mutate();
  };

  const banner = analysis ? trafficBannerStyle(analysis.trafficLight) : null;
  const isBusy = analyzeCaseMutation.isPending || analyzeCsvMutation.isPending;
  const isEmergencyAlert =
    analysis?.trafficLight === 'red' ||
    analysis?.trafficLight === 'purple' ||
    Boolean(analysis?.biomarkers.tpaLockoutTriggered);
  const crossesStrokeThreshold =
    Boolean(analysis) &&
    (analysis!.biomarkers.meanBsi >= 0.22 || analysis!.biomarkers.meanDar >= 3.2);

  return (
    <div className="space-y-3">
      <label htmlFor="qeeg-csv-upload" className="sr-only">
        Tải tệp CSV sóng não
      </label>
      <input
        id="qeeg-csv-upload"
        type="file"
        accept=".csv,.txt"
        onChange={handleCsvSelect}
        className="hidden"
      />

      {/* Single-Row Top Source Toolbar: Tải CSV + 4 mẫu nhanh + Tùy chọn */}
      <Card className="px-3.5 py-2 border-[#DCE6DF]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="xs"
              variant={sourceMode === 'csv' ? 'primary' : 'outline'}
              loading={analyzeCsvMutation.isPending}
              onClick={() => document.getElementById('qeeg-csv-upload')?.click()}
              className="h-8 rounded-lg px-3 text-xs border-[#DCE6DF]"
              icon={<FileUp className="size-3.5" aria-hidden />}
            >
              {sourceMode === 'csv' && csvFilename
                ? csvFilename.slice(0, 14) + (csvFilename.length > 14 ? '…' : '')
                : 'Tải CSV'}
            </Button>

            {QUICK_SAMPLE_PRESETS.map((preset) => {
              const isActive = sourceMode === 'sample' && selectedCaseId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={isBusy}
                  aria-pressed={isActive}
                  onClick={() => handleSelectCase(preset.id)}
                  className={cn(
                    'h-8 rounded-lg px-3 text-xs transition-colors whitespace-nowrap',
                    isActive
                      ? 'bg-[#16A34A] text-white font-semibold'
                      : 'bg-[#EFF6F1] text-[#374151] hover:bg-[#E2EFE6] font-medium',
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div ref={filterMenuRef} className="relative shrink-0">
            <button
              type="button"
              aria-expanded={showFilterMenu}
              onClick={() => setShowFilterMenu((v) => !v)}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-[#DCE6DF] bg-white text-xs font-medium text-[#262624] hover:bg-[#F5FAF7] transition-colors"
            >
              <SlidersHorizontal className="size-3.5 text-[#575652]" aria-hidden />
              <span>{isProfessional ? 'Ca khác & Bộ lọc' : 'Tùy chọn'}</span>
              <ChevronDown className="size-3.5 text-[#6E6D68]" aria-hidden />
            </button>

            {showFilterMenu && (
              <div className="absolute right-0 top-full mt-1.5 z-30 w-72 rounded-xl border border-[#DCE6DF] bg-white shadow-md p-3.5 space-y-3 text-xs">
                <div className="space-y-1">
                  <label htmlFor="qeeg-case-select" className="font-semibold text-[#262624] block">
                    Tất cả ca mẫu (bao gồm Khóa tPA / Phần cứng)
                  </label>
                  <select
                    id="qeeg-case-select"
                    value={selectedCaseId}
                    disabled={isBusy}
                    onChange={(e) => {
                      handleSelectCase(e.target.value);
                      setShowFilterMenu(false);
                    }}
                    className="h-8 w-full rounded-md border border-[#DCE6DF] bg-white px-2 text-xs font-medium text-[#141413]"
                  >
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label htmlFor="qeeg-window-sec" className="font-medium text-[#262624] block">
                      Cửa sổ
                    </label>
                    <select
                      id="qeeg-window-sec"
                      value={timeWindowSec}
                      onChange={(e) => setTimeWindowSec(Number(e.target.value))}
                      className="h-8 w-full rounded-md border border-[#DCE6DF] bg-white px-2 text-xs font-mono text-[#141413]"
                    >
                      <option value={5}>5 giây</option>
                      <option value={6}>6 giây</option>
                      <option value={10}>10 giây</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="qeeg-fast-score" className="font-medium text-[#262624] block">
                      Thang FAST
                    </label>
                    <select
                      id="qeeg-fast-score"
                      value={fastScore}
                      onChange={(e) => setFastScore(Number(e.target.value))}
                      className="h-8 w-full rounded-md border border-[#DCE6DF] bg-white px-2 text-xs font-mono text-[#141413]"
                    >
                      <option value={0}>0 · Bình thường</option>
                      <option value={1}>1 · Nhẹ</option>
                      <option value={2}>2 · Nghi ngờ</option>
                      <option value={3}>3 · Khẩn</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="qeeg-csv-hz" className="font-medium text-[#262624] block">
                      Tần số CSV
                    </label>
                    <select
                      id="qeeg-csv-hz"
                      value={csvSamplingRate}
                      onChange={(e) => setCsvSamplingRate(Number(e.target.value))}
                      className="h-8 w-full rounded-md border border-[#DCE6DF] bg-white px-2 text-xs font-mono text-[#141413]"
                    >
                      <option value={250}>250 Hz</option>
                      <option value={500}>500 Hz</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="qeeg-csv-cat" className="font-medium text-[#262624] block">
                      Nhóm CSV
                    </label>
                    <select
                      id="qeeg-csv-cat"
                      value={csvCategory}
                      onChange={(e) => setCsvCategory(e.target.value as ClinicalCategory)}
                      className="h-8 w-full rounded-md border border-[#DCE6DF] bg-white px-2 text-xs text-[#141413]"
                    >
                      {CLINICAL_CATEGORY_ORDER.map((cat) => (
                        <option key={cat} value={cat}>
                          {CLINICAL_CATEGORY_META[cat].shortLabel}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#EFF6F1]">
                  <label htmlFor="qeeg-notch-50" className="inline-flex items-center gap-1.5 font-medium text-[#262624] cursor-pointer">
                    <input
                      id="qeeg-notch-50"
                      type="checkbox"
                      checked={notch50Hz}
                      onChange={(e) => setNotch50Hz(e.target.checked)}
                      className="size-3.5 rounded border-[#DCE6DF] accent-[#16A34A] text-[#16A34A]"
                    />
                    <span>Lọc nhiễu 50 Hz</span>
                  </label>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    loading={isBusy}
                    onClick={() => {
                      if (sourceMode === 'csv' && csvText) {
                        analyzeCsvMutation.mutate();
                      } else {
                        analyzeCaseMutation.mutate({
                          caseId: selectedCaseId,
                          timeWindowSec,
                          notch50Hz,
                          fastScore,
                        });
                      }
                      setShowFilterMenu(false);
                    }}
                    icon={<RefreshCw className="size-3" aria-hidden />}
                  >
                    Áp dụng
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {analysisError && <Alert tone="error">{analysisError}</Alert>}
      {saveFeedback && !showSaveModal && (
        <Alert tone={saveFeedback.tone}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{saveFeedback.text}</span>
            {saveFeedback.tone === 'success' && onSwitchTab && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onSwitchTab('personal')}
                  className="underline font-bold text-xs"
                >
                  Xem Hồ sơ đã lưu
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchTab('neural-db')}
                  className="underline font-bold text-xs"
                >
                  Mở Mẫu chuẩn AI
                </button>
              </div>
            )}
          </div>
        </Alert>
      )}

      {isBusy && !analysis && <Spinner label="Đang phân tích sóng não..." />}

      {/* Main Analysis Result Workspace */}
      {analysis && banner && (
        <div className="space-y-3">
          {/* Focal Point #1: Clean Clinical Conclusion Banner */}
          <div className={cn('rounded-xl border px-4 py-3.5 space-y-2.5', banner.border)}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('size-2 rounded-full shrink-0', banner.dot)} aria-hidden />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#575652]">
                    {isProfessional ? banner.label : generalStatusLabel(analysis.trafficLight)}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold',
                      isEmergencyAlert
                        ? 'border-red-200 bg-red-50 text-red-800'
                        : analysis.trafficLight === 'yellow'
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : 'border-[#BBF7D0] bg-[#ECFDF3] text-[#15803D]',
                    )}
                  >
                    {formatSafetyStatusLabel(analysis.safetyStatus, isProfessional)}
                  </span>
                </div>

                <h3 className="text-base sm:text-lg font-bold tracking-tight text-[#141413]">
                  {analysis.classificationTitle}
                </h3>

                <p className="text-xs leading-relaxed text-[#262624]">
                  {isProfessional ? (
                    <>
                      <span className="font-semibold text-[#141413]">
                        {sanitizeClinicalDisplayText(analysis.tpaBadge)}
                      </span>{' '}
                      · {sanitizeClinicalDisplayText(analysis.decisionReason)}
                    </>
                  ) : (
                    plainSummaryByTrafficLight(analysis.trafficLight)
                  )}
                  {isEmergencyAlert && (
                    <span className="ml-1.5 font-semibold text-red-800">
                      {crossesStrokeThreshold
                        ? '· Ngưỡng cảnh báo BSI ≥ 0.22 / DAR ≥ 3.2 · Gọi 115 & chụp CT khẩn.'
                        : '· Gọi 115 & chụp CT khẩn.'}
                    </span>
                  )}
                </p>
              </div>

              {/* Right Side: Countdown (if active) + Primary Actions (Hỏi Bác sĩ + Lưu bản ghi + Tác vụ khác) */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {analysis.tpaCountdownMin > 0 && isProfessional && (
                  <div className="rounded-lg bg-white text-[#141413] border border-red-200 px-2.5 py-1 text-center">
                    <span className="block text-[9.5px] font-semibold uppercase tracking-wider text-red-700">
                      Cửa sổ tPA
                    </span>
                    <span className="font-mono text-sm font-bold tabular-nums text-[#141413] leading-tight">
                      {analysis.tpaCountdownMin} phút
                    </span>
                  </div>
                )}

                <Link
                  to={
                    savedSampleId
                      ? `/consultations?sampleId=${encodeURIComponent(savedSampleId)}${savedDatasetId ? `&datasetId=${encodeURIComponent(savedDatasetId)}` : ''}&category=${analysis.clinicalCategory}&ask=1`
                      : `/consultations?category=${analysis.clinicalCategory}${!isProfessional ? '&ask=1' : ''}`
                  }
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2',
                    isEmergencyAlert
                      ? 'bg-red-700 hover:bg-red-800 focus-visible:outline-red-700'
                      : 'bg-[#16A34A] hover:bg-[#15803D] focus-visible:outline-[#16A34A]',
                  )}
                >
                  <MessageSquarePlus className="size-3.5" aria-hidden />
                  <span>Hỏi Bác sĩ →</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setSaveFeedback(null);
                    setShowSaveModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE6DF] bg-white px-3 py-2 text-xs font-medium text-[#141413] hover:bg-[#F5FAF7] transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16A34A]"
                >
                  <Database className="size-3.5 text-[#15803D]" aria-hidden />
                  <span>{savedDatasetId ? 'Đã lưu ✓' : 'Lưu bản ghi'}</span>
                </button>

                <div ref={moreMenuRef} className="relative">
                  <button
                    type="button"
                    aria-expanded={showMoreMenu}
                    aria-haspopup="menu"
                    onClick={() => setShowMoreMenu((v) => !v)}
                    title="Tác vụ khác"
                    className="inline-flex items-center gap-1 rounded-lg border border-[#DCE6DF] bg-white px-2.5 py-2 text-xs font-medium text-[#575652] hover:bg-[#F5FAF7] hover:text-[#141413] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <MoreHorizontal className="size-4" aria-hidden />
                    <span className="hidden sm:inline">Tác vụ khác ▾</span>
                  </button>

                  {showMoreMenu && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full mt-1.5 z-30 w-48 rounded-xl border border-[#DCE6DF] bg-white shadow-md py-1 text-xs"
                    >
                      <a
                        role="menuitem"
                        href={`/api/qeeg/export-pdf-summary?caseId=${encodeURIComponent(analysis.caseId)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setShowMoreMenu(false)}
                        className="flex items-center gap-2 px-3.5 py-2 text-[#262624] hover:bg-[#F5FAF7]"
                      >
                        <FileDown className="size-3.5 text-[#575652]" aria-hidden />
                        <span>Xuất PDF</span>
                      </a>
                      <a
                        role="menuitem"
                        href={`/clinical-workstation?mode=${isProfessional ? 'professional' : 'general'}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setShowMoreMenu(false)}
                        className="flex items-center gap-2 px-3.5 py-2 text-[#262624] hover:bg-[#F5FAF7]"
                      >
                        <ExternalLink className="size-3.5 text-[#575652]" aria-hidden />
                        <span>Toàn màn hình</span>
                      </a>
                      <Link
                        role="menuitem"
                        to="/eeg-hub?view=workspace"
                        onClick={() => setShowMoreMenu(false)}
                        className="flex items-center gap-2 px-3.5 py-2 text-[#262624] hover:bg-[#F5FAF7]"
                      >
                        <Activity className="size-3.5 text-[#575652]" aria-hidden />
                        <span>Mở Trạm qEEG</span>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {analysis.biomarkers.tpaLockoutTriggered && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 flex items-start gap-2 text-xs text-red-900">
                <AlertTriangle className="size-4 text-red-700 shrink-0 mt-0.5" aria-hidden />
                <span>
                  <strong>Khóa tPA · Chụp CT khẩn:</strong> Hệ thống đã kích hoạt khóa an toàn xuất huyết não. Mọi quyết định điều trị bắt buộc đối chiếu CT sọ não không cản quang và gọi 115 khi cần cấp cứu.
                </span>
              </div>
            )}
          </div>

          {/* 12-col grid: Waveform (8 cols) + Topomap & 3 scannable KPIs (4 cols) */}
          <div className="grid gap-4 lg:grid-cols-12 items-start">
            {/* Left 8 cols: Brain Waveform */}
            <div className="lg:col-span-8 min-w-0">
              <BrainWaveformViewer
                waveforms={analysis.waveforms}
                samplingRateHz={analysis.samplingRateHz}
                isProfessional={isProfessional}
                title={`Tín hiệu Điện não ${analysis.channelsCount} Kênh (${analysis.samplingRateHz} Hz)`}
                subtitle={`${analysis.channelsCount} kênh · ${analysis.samplingRateHz} Hz`}
              />
            </div>

            {/* Right 4 cols: Topomap + 3 Scannable KPI Cards */}
            <div className="lg:col-span-4 min-w-0 space-y-3">
              <CompactCorticalTopomap
                nodes={analysis.topomap}
                trafficLight={analysis.trafficLight}
                isProfessional={isProfessional}
              />

              {/* 3 Primary Scannable KPI Cards */}
              <div className="rounded-xl border border-[#DCE6DF] bg-white divide-y divide-[#DCE6DF] text-xs">
                <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <span className="block font-semibold text-[#141413]">
                      {isProfessional ? 'Chỉ số sóng chậm (DAR)' : 'Chỉ số sóng chậm'}
                    </span>
                    <span className="text-[11px] text-[#6E6D68]">
                      {analysis.biomarkers.meanDar > 1.5 ? 'Tăng cao' : 'Bình thường'}
                    </span>
                  </div>
                  <span className="font-mono text-base font-bold text-[#141413] tabular-nums">
                    {analysis.biomarkers.meanDar.toFixed(2)}
                  </span>
                </div>

                <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <span className="block font-semibold text-[#141413]">
                      {isProfessional ? 'Cân bằng 2 bên (BSI)' : 'Cân bằng 2 bên'}
                    </span>
                    <span className="text-[11px] text-[#6E6D68]">
                      {analysis.biomarkers.meanBsi > 0.15 ? 'Lệch bán cầu' : 'Cân đối'}
                    </span>
                  </div>
                  <span className="font-mono text-base font-bold text-[#141413] tabular-nums">
                    {analysis.biomarkers.meanBsi.toFixed(3)}
                  </span>
                </div>

                <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <span className="block font-semibold text-[#141413]">Nhịp Alpha</span>
                    <span className="text-[11px] text-[#6E6D68]">
                      {analysis.biomarkers.alphaPeakHz >= 9 ? 'Tốt' : 'Đang mỏi não'}
                    </span>
                  </div>
                  <span className="font-mono text-base font-bold text-[#141413] tabular-nums">
                    {analysis.biomarkers.alphaPeakHz.toFixed(1)} Hz
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Deep Technical Specs: Closed by default, expands on click */}
          <div className="rounded-xl border border-[#DCE6DF] bg-[#F5FAF7]">
            <button
              type="button"
              aria-expanded={showDetails}
              onClick={() => setShowDetails((v) => !v)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-[#262624] hover:text-[#141413] transition-colors cursor-pointer"
            >
              <span>Xem thông số chi tiết</span>
              {showDetails ? (
                <ChevronUp className="size-4 text-[#575652]" aria-hidden />
              ) : (
                <ChevronDown className="size-4 text-[#575652]" aria-hidden />
              )}
            </button>

            {showDetails && (
              <div className="px-4 pb-4 pt-2 border-t border-[#DCE6DF] space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs font-mono tabular-nums">
                  <div className="rounded-lg border border-[#DCE6DF] bg-white p-3">
                    <span className="block text-[10px] font-sans font-medium text-[#6E6D68]">
                      {isProfessional ? 'TAR (Theta/Alpha)' : 'Chỉ số mệt mỏi'}
                    </span>
                    <strong className="text-base font-semibold text-[#141413]">
                      {analysis.biomarkers.meanTar.toFixed(2)}
                    </strong>
                    <span className="block text-[10px] font-sans text-[#6E6D68]">
                      Sóng chậm / nhịp nghỉ
                    </span>
                  </div>

                  <div className="rounded-lg border border-[#DCE6DF] bg-white p-3">
                    <span className="block text-[10px] font-sans font-medium text-[#6E6D68]">
                      {isProfessional ? 'wPLI / PRI' : 'Kết nối vùng não'}
                    </span>
                    <strong className="text-base font-semibold text-[#141413]">
                      {analysis.biomarkers.wpli.toFixed(2)}
                    </strong>
                    <span className="block text-[10px] font-sans text-[#6E6D68]">
                      PRI: {analysis.biomarkers.pri.toFixed(2)} · Tín hiệu {(analysis.biomarkers.signalQualityScore * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="rounded-lg border border-[#DCE6DF] bg-white p-3">
                    <span className="block text-[10px] font-sans font-medium text-[#6E6D68]">
                      An toàn lâm sàng
                    </span>
                    <strong className="text-sm font-semibold text-[#141413] font-sans">
                      {formatSafetyStatusLabel(analysis.safetyStatus, isProfessional)}
                    </strong>
                    <span className="block text-[10px] font-sans text-[#6E6D68]">
                      {analysis.biomarkers.cusumAlarm ? 'CUSUM cảnh báo sớm' : 'CUSUM bình thường'}
                    </span>
                  </div>

                  <div className="rounded-lg border border-[#DCE6DF] bg-white p-3">
                    <span className="block text-[10px] font-sans font-medium text-[#6E6D68]">
                      Phương pháp &amp; Đặc trưng
                    </span>
                    <strong className="text-sm font-semibold text-[#141413]">
                      {analysis.featureVector80.length || 80} chỉ số
                    </strong>
                    <span className="block text-[10px] font-sans text-[#6E6D68] truncate" title={analysis.montage}>
                      {analysis.montage} · {analysis.samplingRateHz} Hz · {analysis.latencyMs} ms
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="p-4 border-[#DCE6DF] space-y-2.5 text-xs">
                    <h4 className="font-semibold text-[#141413]">Phổ Công suất Dải tần (PSD)</h4>
                    {[
                      { key: 'delta', label: 'Delta (0.5–4 Hz)', val: analysis.bandPowers.delta, bar: 'bg-[#8A8882]' },
                      { key: 'theta', label: 'Theta (4–8 Hz)', val: analysis.bandPowers.theta, bar: 'bg-[#575652]' },
                      { key: 'alpha', label: 'Alpha (8–13 Hz)', val: analysis.bandPowers.alpha, bar: 'bg-[#16A34A]' },
                      { key: 'beta', label: 'Beta (13–30 Hz)', val: analysis.bandPowers.beta, bar: 'bg-[#141413]' },
                    ].map((b) => {
                      const pct = Math.round(b.val * 100);
                      return (
                        <div key={b.key} className="space-y-1">
                          <div className="flex justify-between font-mono tabular-nums text-[11px]">
                            <span className="font-sans font-medium text-[#575652]">{b.label}</span>
                            <span className="font-semibold text-[#141413]">{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-[#EFF6F1] overflow-hidden">
                            <div className={cn('h-full rounded-full', b.bar)} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </Card>

                  <Card className="p-4 border-[#DCE6DF] space-y-2.5 text-xs">
                    <h4 className="font-semibold text-[#141413]">Phân tầng Xác suất 5 Lớp</h4>
                    {[
                      { key: 'control', label: 'Sinh lý bình thường', val: analysis.probabilities.control, bar: 'bg-[#16A34A]' },
                      { key: 'ischemic', label: 'Thiếu máu não cục bộ', val: analysis.probabilities.ischemic, bar: 'bg-red-600' },
                      { key: 'hemorrhagic', label: 'Xuất huyết não (ICH)', val: analysis.probabilities.hemorrhagic, bar: 'bg-red-800' },
                      { key: 'epileptiform', label: 'Động kinh / Chậm', val: analysis.probabilities.epileptiform, bar: 'bg-amber-600' },
                      { key: 'cognitiveFatigue', label: 'Mệt mỏi / Ngủ N3', val: analysis.probabilities.cognitiveFatigue, bar: 'bg-[#575652]' },
                    ].map((p) => {
                      const pct = Math.round(p.val * 100);
                      return (
                        <div key={p.key} className="space-y-1">
                          <div className="flex justify-between font-mono tabular-nums text-[11px]">
                            <span className="font-sans font-medium text-[#575652]">{p.label}</span>
                            <span className="font-semibold text-[#141413]">{(p.val * 100).toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-[#EFF6F1] overflow-hidden">
                            <div className={cn('h-full rounded-full', p.bar)} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </Card>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sequential Pop-up Modal: Lưu bản ghi vào Hồ sơ (Plug & Play) */}
      {showSaveModal && analysis && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
          onClick={() => setShowSaveModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-qeeg-modal-title"
            className="w-full max-w-xl rounded-2xl border border-[#DCE6DF] bg-white shadow-xl overflow-hidden text-[#141413]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-[#DCE6DF] bg-[#F5FAF7] px-5 py-3.5">
              <div>
                <h4 id="save-qeeg-modal-title" className="text-sm font-bold text-[#141413]">
                  Lưu bản ghi vào Hồ sơ
                </h4>
                <p className="text-[11px] text-[#6E6D68]">
                  Thông tin đã được điền sẵn tự động — kiểm tra nhanh và bấm Lưu ngay.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                aria-label="Đóng hộp thoại lưu bản ghi"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-[#6E6D68] hover:bg-[#E2EFE6] hover:text-[#141413] transition-colors"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <form onSubmit={handleSaveSubmit} className="p-5 space-y-3 text-xs">
              {saveFeedback && saveFeedback.tone === 'error' && (
                <Alert tone="error">{saveFeedback.text}</Alert>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-1">
                  <label htmlFor="save-qeeg-title" className="font-semibold text-[#262624] block">
                    Tiêu đề Hồ sơ *
                  </label>
                  <Input
                    id="save-qeeg-title"
                    value={saveTitle}
                    onChange={(e) => setSaveTitle(e.target.value)}
                    className="bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="save-qeeg-code" className="font-semibold text-[#262624] block">
                    Mã đối tượng ẩn danh
                  </label>
                  <Input
                    id="save-qeeg-code"
                    value={saveSubjectCode}
                    onChange={(e) => setSaveSubjectCode(e.target.value)}
                    className="bg-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="save-qeeg-split" className="font-semibold text-[#262624] block">
                    Tập dữ liệu (Split)
                  </label>
                  <select
                    id="save-qeeg-split"
                    value={saveSplit}
                    onChange={(e) => setSaveSplit(e.target.value as DatasetSplit)}
                    className="h-9.5 w-full rounded-lg border border-[#DCE6DF] bg-white px-2.5 text-xs text-[#141413]"
                  >
                    {DATASET_SPLIT_ORDER.map((sp) => (
                      <option key={sp} value={sp}>
                        {DATASET_SPLIT_META[sp].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="save-qeeg-cat" className="font-semibold text-[#262624] block">
                    Nhóm chuyên khoa
                  </label>
                  <select
                    id="save-qeeg-cat"
                    value={saveCategory}
                    onChange={(e) => setSaveCategory(e.target.value as ClinicalCategory)}
                    className="h-9.5 w-full rounded-lg border border-[#DCE6DF] bg-white px-2.5 text-xs text-[#141413]"
                  >
                    {CLINICAL_CATEGORY_ORDER.map((cat) => (
                      <option key={cat} value={cat}>
                        {CLINICAL_CATEGORY_META[cat].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="save-qeeg-label" className="font-semibold text-[#262624] block">
                    Nhãn chuẩn đề xuất
                  </label>
                  <select
                    id="save-qeeg-label"
                    value={saveLabel}
                    onChange={(e) => setSaveLabel(e.target.value as NeuralLabel)}
                    className="h-9.5 w-full rounded-lg border border-[#DCE6DF] bg-white px-2.5 text-xs text-[#141413]"
                  >
                    {NEURAL_LABEL_ORDER.map((lbl) => (
                      <option key={lbl} value={lbl}>
                        {NEURAL_LABEL_META[lbl].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label htmlFor="save-qeeg-note" className="font-semibold text-[#262624] block">
                    Ghi chú lâm sàng
                  </label>
                  <Textarea
                    id="save-qeeg-note"
                    rows={2}
                    value={saveNote}
                    onChange={(e) => setSaveNote(e.target.value)}
                    className="bg-white"
                  />
                </div>
              </div>

              <label
                htmlFor="save-qeeg-deid"
                className="inline-flex items-center gap-2 font-medium text-[#262624] cursor-pointer pt-1"
              >
                <input
                  id="save-qeeg-deid"
                  type="checkbox"
                  checked={deidentifiedConfirmed}
                  onChange={(e) => setDeidentifiedConfirmed(e.target.checked)}
                  className="size-4 rounded border-[#DCE6DF] accent-[#16A34A] text-[#16A34A]"
                />
                <span>Xác nhận dữ liệu đã ẩn danh thông tin cá nhân</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#DCE6DF]">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSaveModal(false)}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  loading={saveToPlatformMutation.isPending}
                  icon={<CheckCircle2 className="size-3.5" aria-hidden />}
                >
                  Lưu ngay
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
