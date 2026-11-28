import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookmarkPlus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  FileDown,
  FileText,
  FileUp,
  Info,
  Layers,
  Lock,
  Maximize2,
  MessageSquarePlus,
  Minimize2,
  MoreHorizontal,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import {
  qeegApi,
  type QeegAnalysisResponse,
  type QeegBsiPair,
  type QeegChannelQuality,
  type QeegPsdCurve,
} from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type {
  ClinicalCategory,
  DatasetSplit,
  EegDatasetRecord,
  NeuralLabel,
  NeuralTrainingSampleItem,
  QeegCaseItem,
  QeegTopomapNode,
} from '../../api/types';
import { Alert, Button, Card, Input, Spinner, Textarea, cn } from '../../components/ui';
import { useAuth } from '../auth/AuthContext';
import {
  BrainWaveformViewer,
  type BrainWaveformAnnotation,
  type BrainWaveformChannelQuality,
  type BrainWaveformInterval,
  type ChannelQualityStatus,
} from './BrainWaveformViewer';
import { CorticalTopomap2D, type TopomapMetricMode } from './CorticalTopomap2D';
import {
  CHANNEL_ANATOMY_MAP,
  CLINICAL_CATEGORY_META,
  CLINICAL_CATEGORY_ORDER,
  DATASET_SPLIT_META,
  DATASET_SPLIT_ORDER,
  NEURAL_LABEL_META,
  NEURAL_LABEL_ORDER,
  sanitizeClinicalDisplayText,
} from './eegLabels';

export interface QeegStudioPanelProps {
  isProfessional?: boolean;
  onSavedToPlatform?: (dataset: EegDatasetRecord, sample: NeuralTrainingSampleItem) => void;
  onSwitchTab?: (tab: 'personal' | 'databank' | 'neural-db') => void;
}

type ClinicalSectionTab = 'overview' | 'waveform' | 'qeeg' | 'ai' | 'review';

const CLINICAL_SECTION_TABS: ReadonlyArray<{ id: ClinicalSectionTab; label: string }> = [
  { id: 'overview', label: '1. Tổng quan' },
  { id: 'waveform', label: '2. Sóng EEG' },
  { id: 'qeeg', label: '3. Phân tích QEEG' },
  { id: 'ai', label: '4. Gợi ý AI' },
  { id: 'review', label: '5. Nhận định & Báo cáo' },
];

interface PhysicianAnnotationItem extends BrainWaveformAnnotation {
  id: string;
  source: 'system' | 'physician';
}

interface PhysicianReviewState {
  backgroundAndFindings: string;
  artifactAndTechnicalLimits: string;
  conclusionAndPlan: string;
  lastKnownWellText: string;
  confirmedAt: string | null;
  confirmedByName: string | null;
  confirmedByUsername: string | null;
  annotations: PhysicianAnnotationItem[];
}

const STANDARD_6_CHANNELS = ['F3', 'F4', 'C3', 'C4', 'O1', 'O2'] as const;

const FALLBACK_CASES: QeegCaseItem[] = [
  {
    id: 'case_healthy_alpha',
    name: 'Ca 1: Nhịp nền Alpha (Tham chiếu)',
    subjectId: 'DEMO-CTRL-05',
    clinicalCategory: 'SLEEP_COGNITIVE',
    groundTruthLabel: 'CONTROL',
    clinicalPresentation: 'Nhịp Alpha vùng chẩm O1/O2 rõ khi nhắm mắt nghỉ ngơi.',
    trafficLight: 'green',
    tpaStatus: 'NOT_APPLICABLE',
    badge: 'Tham chiếu',
    samplingRateHz: 500,
    channelsCount: 6,
  },
  {
    id: 'case_sleep_fatigue_n3',
    name: 'Ca 2: Buồn ngủ / Giảm cảnh tỉnh',
    subjectId: 'DEMO-DROWSY-04',
    clinicalCategory: 'SLEEP_COGNITIVE',
    groundTruthLabel: 'COGNITIVE_FATIGUE',
    clinicalPresentation: 'Tăng sóng chậm Theta–Delta đối xứng hai bán cầu, giảm Alpha.',
    trafficLight: 'yellow',
    tpaStatus: 'NOT_APPLICABLE',
    badge: 'Giảm cảnh tỉnh',
    samplingRateHz: 500,
    channelsCount: 6,
  },
  {
    id: 'case_epilepsy_temporal',
    name: 'Ca 3: Dạng động kinh (F3–C3)',
    subjectId: 'DEMO-EPI-03',
    clinicalCategory: 'EPILEPSY_ICU',
    groundTruthLabel: 'EPILEPTIFORM_SLOWING',
    clinicalPresentation: 'Phức hợp dạng nhọn–sóng chậm ghi nhận trên kênh F3–C3.',
    trafficLight: 'yellow',
    tpaStatus: 'NOT_APPLICABLE',
    badge: 'Dạng kịch phát',
    samplingRateHz: 500,
    channelsCount: 6,
  },
  {
    id: 'case_ischemia_lvo',
    name: 'Ca 4: Sóng chậm lệch bán cầu (F3/C3)',
    subjectId: 'DEMO-ASYM-01',
    clinicalCategory: 'VASCULAR_STROKE',
    groundTruthLabel: 'ISCHEMIC_STROKE',
    clinicalPresentation: 'Sóng chậm Delta ưu thế bán cầu trái (F3, C3) và tăng bất đối xứng.',
    trafficLight: 'red',
    tpaStatus: 'MONITORING',
    badge: 'Lệch bán cầu',
    samplingRateHz: 500,
    channelsCount: 6,
  },
  {
    id: 'case_ich_hemorrhage',
    name: 'Ca 5: Sóng chậm lan tỏa biên độ cao',
    subjectId: 'DEMO-SLOW-02',
    clinicalCategory: 'VASCULAR_STROKE',
    groundTruthLabel: 'HEMORRHAGIC_STROKE',
    clinicalPresentation: 'Sóng chậm biên độ cao lan tỏa kèm bất đối xứng; cần CT sọ não đối chiếu.',
    trafficLight: 'purple',
    tpaStatus: 'ABSOLUTELY_CONTRAINDICATED',
    badge: 'Cảnh báo quy trình CT',
    samplingRateHz: 500,
    channelsCount: 6,
  },
  {
    id: 'case_ads1299_hardware',
    name: 'Ca 6: Mẫu phần cứng ADS1299 500 Hz',
    subjectId: 'HW-ADS1299-06',
    clinicalCategory: 'HARDWARE_BCI',
    groundTruthLabel: 'CONTROL',
    clinicalPresentation: 'Tín hiệu mẫu 6 kênh 10–20 rút gọn (F3, F4, C3, C4, O1, O2).',
    trafficLight: 'green',
    tpaStatus: 'MONITORING',
    badge: 'TI ADS1299',
    samplingRateHz: 500,
    channelsCount: 6,
  },
];

const SAMPLE_CASE_DISPLAY_META: Record<
  string,
  { group: 'SIMULATED' | 'HARDWARE'; label: string }
> = {
  case_healthy_alpha: { group: 'SIMULATED', label: 'Nhịp nền Alpha tham chiếu' },
  case_ischemia_lvo: { group: 'SIMULATED', label: 'Sóng chậm lệch bán cầu' },
  case_ich_hemorrhage: { group: 'SIMULATED', label: 'Sóng chậm biên độ cao lan tỏa' },
  case_epilepsy_temporal: { group: 'SIMULATED', label: 'Hoạt động dạng động kinh (F3–C3)' },
  case_sleep_fatigue_n3: { group: 'SIMULATED', label: 'Buồn ngủ / Giảm cảnh tỉnh' },
  case_ads1299_hardware: { group: 'HARDWARE', label: 'Mẫu ADS1299 500 Hz' },
};

const SIMULATED_CASE_ORDER = [
  'case_healthy_alpha',
  'case_ischemia_lvo',
  'case_ich_hemorrhage',
  'case_epilepsy_temporal',
  'case_sleep_fatigue_n3',
] as const;

type MetricDetailKey = 'dar' | 'bsi' | 'alphaPeak' | 'psd' | 'tar' | 'wpli' | 'pri';

const METRIC_INFO_DETAILS: Record<
  MetricDetailKey,
  {
    fullName: string;
    definition: string;
    formula: string;
    unit: string;
    channelsAndWindow: string;
    evidenceAndLimits: string;
  }
> = {
  dar: {
    fullName: 'Delta/Alpha Ratio (Tỷ số công suất Delta trên Alpha)',
    definition:
      'Tỷ số giữa công suất phổ dải sóng chậm Delta (0.5–4 Hz) và dải Alpha (8–13 Hz), phản ánh mức độ chậm hóa nền điện não.',
    formula: 'DAR = (1 / N) · Σ (P_delta,c / P_alpha,c) với N kênh hợp lệ',
    unit: 'Tỷ số không thứ nguyên (dimensionless ratio)',
    channelsAndWindow: 'Kênh F3, F4, C3, C4, O1, O2 · Cửa sổ phân tích đã cắt 0.5 s biên',
    evidenceAndLimits:
      'Dẫn chứng: Finnigan et al. (2016, Clin Neurophysiol) khảo sát ngưỡng DAR > 3.7 trên 19 kênh trong thiếu máu não cấp. Giới hạn: Chưa chuẩn hóa lâm sàng cho hệ 6 kênh NeuroLink; tăng DAR cũng gặp trong buồn ngủ, sóng chậm dạng động kinh, hoặc nhiễu chớp mắt / chuyển động.',
  },
  bsi: {
    fullName: 'Brain Symmetry Index (Chỉ số bất đối xứng hai bán cầu)',
    definition:
      'Đo mức độ chênh lệch công suất phổ giữa các cặp điện cực đối xứng hai bán cầu trên dải tần khảo sát.',
    formula: 'BSI = (1 / M) · Σ | (R(f) − L(f)) / (R(f) + L(f)) | (cặp F3–F4, C3–C4, O1–O2)',
    unit: 'Khoảng [0, 1] (0 = đối xứng hoàn toàn, 1 = bất đối xứng cực đại)',
    channelsAndWindow: '3 cặp đối xứng: F3–F4, C3–C4, O1–O2 · Dải 1–25 Hz (pdBSI) / toàn dải',
    evidenceAndLimits:
      'Dẫn chứng: van Putten & Tavy (2004, Stroke); Sheorajpanday et al. (2009) trên hệ 19 kênh. Giới hạn: Nhạy cảm với nhiễu cơ EMG một bên hoặc lệch tiếp xúc điện cực; BSI thấp (đối xứng) KHÔNG loại trừ đột quỵ tuần hoàn sau, ổ khuyết hoặc tổn thương hai bên.',
  },
  alphaPeak: {
    fullName: 'Alpha Peak Frequency (Tần số Đỉnh Alpha chẩm)',
    definition:
      'Tần số có mật độ công suất cực đại trong dải Alpha (8–13 Hz) đo tại vùng chẩm O1, O2.',
    formula: 'f_peak = argmax_{f ∈ [8, 13] Hz} PSD_{O1,O2}(f)',
    unit: 'Hz (Chuẩn người trưởng thành tỉnh táo nhắm mắt: ~8.5–12.0 Hz)',
    channelsAndWindow: 'Kênh O1, O2 · Điều kiện chuẩn: nhắm mắt nghỉ ngơi tỉnh táo',
    evidenceAndLimits:
      'Giới hạn: Mở mắt gây ức chế (blocking) nhịp Alpha. Khi tỷ trọng Alpha < 20% hoặc Delta > 50%, đỉnh Alpha có thể bị lấn át bởi sóng chậm hoặc chỉ phản ánh dao động nhiễu nền.',
  },
  psd: {
    fullName: 'Power Spectral Density (Phổ mật độ công suất Welch)',
    definition:
      'Phân bố năng lượng tín hiệu điện não theo tần số (µV²/Hz) và tỷ trọng phần trăm từng dải sóng.',
    formula: 'P_rel(band) = ∫_band PSD(f) df / ∫_{0.5}^{30 Hz} PSD(f) df × 100%',
    unit: 'Đường cong: µV²/Hz · Thanh tỷ trọng: % chuẩn hóa 100% trên 0.5–30 Hz',
    channelsAndWindow: '6 kênh đo · Dải chuẩn hóa 0.5–30 Hz (Gamma 30–45 Hz tách riêng)',
    evidenceAndLimits:
      'Giới hạn: Dải Gamma (30–45 Hz) tách khỏi mẫu số 100% để tránh nhiễu cơ (EMG) làm biến dạng tỷ trọng Delta–Beta. Biên độ tuyệt đối phụ thuộc trở kháng tiếp xúc và cấu hình lọc.',
  },
  tar: {
    fullName: 'Theta/Alpha Ratio (Tỷ số công suất Theta trên Alpha)',
    definition:
      'Tỷ số năng lượng dải Theta (4–8 Hz) trên dải Alpha (8–13 Hz), thường tăng khi giảm cảnh tỉnh hoặc buồn ngủ.',
    formula: 'TAR = P_theta(4–8 Hz) / P_alpha(8–13 Hz)',
    unit: 'Tỷ số không thứ nguyên',
    channelsAndWindow: 'Kênh F3, F4, C3, C4, O1, O2 · Cửa sổ đã cắt biên 0.5 s',
    evidenceAndLimits:
      'Giới hạn: Thay đổi mạnh theo trạng thái mở/nhắm mắt, tuổi tác và thuốc an thần; không đặc hiệu cho một bệnh lý đơn lẻ.',
  },
  wpli: {
    fullName: 'Weighted Phase Lag Index (Chỉ số trễ pha có trọng số)',
    definition:
      'Đo đồng bộ pha giữa các cặp kênh không phụ thuộc dẫn truyền thể tích tức thời (zero-lag), dựa trên phần ảo của phổ chéo.',
    formula: 'wPLI = |E{Im(S_xy)}| / E{|Im(S_xy)|} (Vinck et al., 2011, NeuroImage)',
    unit: 'Khoảng [0, 1] (0 = không đồng bộ pha lệch pha 0/π, 1 = khóa pha nhất quán)',
    channelsAndWindow: 'Các cặp kênh đo trong cấu hình 6 kênh · Cửa sổ ngắn hiện tại',
    evidenceAndLimits:
      'Giới hạn nghiêm trọng: wPLI bị thiên lệch (finite-sample bias) trên đoạn ghi ngắn (< 10–20 s) và mật độ điện cực thưa (6 kênh không đủ phân giải mạng lưới toàn vỏ não như 32–64 kênh).',
  },
  pri: {
    fullName: 'Power Ratio Index (Chỉ số tỷ số công suất chậm/nhanh)',
    definition:
      'Tỷ số giữa tổng công suất hai dải chậm (Delta + Theta) trên tổng công suất hai dải nhanh (Alpha + Beta).',
    formula: 'PRI = (P_delta + P_theta) / (P_alpha + P_beta) (Nagata et al., 1989)',
    unit: 'Tỷ số không thứ nguyên',
    channelsAndWindow: '6 kênh đo · Dải 0.5–30 Hz',
    evidenceAndLimits:
      'Giới hạn: Phản ánh chậm hóa điện não không đặc hiệu (gặp trong giảm cảnh tỉnh, chuyển hóa, tổn thương cấu trúc, hoặc nhiễu tần số thấp).',
  },
};

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeNarrative(text: string | null | undefined): string {
  const base = sanitizeClinicalDisplayText(text);
  if (!base) return '';
  return base
    .replace(/NGUY CƠ CAO ĐỘT QUỴ THIẾU MÁU CỤC BỘ\s*\(LVO\)/gi, 'Sóng chậm khu trú & bất đối xứng bán cầu')
    .replace(/ỨNG VIÊN TIÊU SỢI HUYẾT/gi, 'Cần bác sĩ đối chiếu lâm sàng & CT sọ não')
    .replace(/MIỄN NHIỄM GIẢ ĐỘT QUỴ/gi, 'Không ghi nhận lệch bán cầu rõ trên 6 kênh')
    .replace(/Ngủ sâu N3/gi, 'Tăng sóng chậm đối xứng (giảm cảnh tỉnh)')
    .replace(/thùy thái dương/gi, 'kênh F3–C3')
    .replace(/Thùy Thái dương/gi, 'kênh F3–C3');
}

function getCautiousPatternPresentation(
  analysis: QeegAnalysisResponse,
  isProfessional: boolean,
  aiSuppressedOverride?: boolean,
  channelQualityOverride?: BrainWaveformChannelQuality[],
): {
  title: string;
  observation: string;
  tone: 'neutral' | 'amber' | 'quality';
  badgeLabel: string;
} {
  if (analysis.signalQuality?.aiSuppressedByQuality || aiSuppressedOverride) {
    const reasons = analysis.signalQuality?.suppressionReasons ?? [];
    const chList = channelQualityOverride ?? analysis.signalQuality?.channels ?? [];
    const dropoutChs = chList.filter((c) => c.status === 'DROPOUT').map((c) => c.channel);
    const satChs = chList.filter((c) => c.status === 'SATURATED').map((c) => c.channel);
    const noisyChs = chList.filter((c) => c.status === 'NOISY').map((c) => c.channel);
    const detailParts: string[] = [];
    if (reasons.length > 0) detailParts.push(reasons.join(' '));
    if (dropoutChs.length > 0) detailParts.push(`Mất tín hiệu (DROPOUT): ${dropoutChs.join(', ')}.`);
    if (satChs.length > 0) detailParts.push(`Bão hòa biên độ (SATURATED): ${satChs.join(', ')}.`);
    if (noisyChs.length > 0) detailParts.push(`Nhiễu nặng (NOISY): ${noisyChs.join(', ')}.`);
    return {
      title: 'Không đủ điều kiện diễn giải EEG — Nhiễu nặng / Mất kênh / Bão hòa biên độ',
      observation:
        detailParts.length > 0
          ? detailParts.join(' ')
          : 'Tín hiệu không đạt chuẩn kỹ thuật (mất kênh, bão hòa biên độ hoặc thời lượng khả dụng không đủ) — Đã khóa diễn giải và phân loại tự động.',
      tone: 'quality',
      badgeLabel: 'TÍN HIỆU KHÔNG ĐẠT CHUẨN KỸ THUẬT',
    };
  }

  const label = analysis.classificationLabel;
  if (label === 'CONTROL') {
    return {
      title: isProfessional
        ? 'Hoạt động nền ổn định · Nhịp Alpha vùng chẩm cân đối'
        : 'Tín hiệu nền ổn định và cân đối',
      observation:
        'Không ghi nhận sóng chậm khu trú nổi bật hay bất đối xứng biên độ rõ giữa các cặp kênh đo được.',
      tone: 'neutral',
      badgeLabel: isProfessional ? 'MẪU NỀN THAM CHIẾU' : 'Ổn định',
    };
  }
  if (label === 'COGNITIVE_FATIGUE') {
    return {
      title: isProfessional
        ? 'PHÁT HIỆN MẪU EEG CẦN LƯU Ý — Tăng sóng chậm đối xứng (Giảm cảnh tỉnh / Buồn ngủ)'
        : 'Ghi nhận tăng sóng chậm nhẹ hai bên (dạng buồn ngủ / mệt mỏi)',
      observation:
        'Tăng tỷ trọng sóng chậm Theta–Delta tương đối đối xứng trên các kênh đo kèm giảm ưu thế Alpha; không thấy lệch bán cầu rõ.',
      tone: 'amber',
      badgeLabel: 'MẪU SÓNG CHẬM ĐỐI XỨNG',
    };
  }
  if (label === 'EPILEPTIFORM_SLOWING') {
    return {
      title: isProfessional
        ? 'PHÁT HIỆN MẪU EEG BẤT THƯỜNG TIỀM ẨN — Hoạt động dạng nhọn–sóng chậm trên kênh F3–C3'
        : 'Phát hiện mẫu sóng nhọn–chậm bất thường tiềm ẩn cần bác sĩ xem xét',
      observation:
        'Ghi nhận biến động biên độ dạng nhọn–sóng chậm khu trú trên các kênh đo phía trước–trung tâm (F3–C3); cần bác sĩ đối chiếu lâm sàng và EEG chuẩn 10–20.',
      tone: 'amber',
      badgeLabel: 'MẪU DẠNG KỊCH PHÁT TIỀM ẨN',
    };
  }
  if (label === 'HEMORRHAGIC_STROKE') {
    return {
      title: isProfessional
        ? 'PHÁT HIỆN MẪU EEG BẤT THƯỜNG TIỀM ẨN — Sóng chậm biên độ cao lan tỏa / lệch bán cầu'
        : 'Phát hiện sóng chậm biên độ cao bất thường — Cần bác sĩ đánh giá & chụp CT',
      observation:
        'Sóng chậm Delta biên độ cao kèm bất đối xứng giữa hai bên. Lưu ý: EEG không phân biệt được nhồi máu hay xuất huyết nội sọ khi chưa chụp CT sọ não.',
      tone: 'amber',
      badgeLabel: 'BẤT THƯỜNG SÓNG CHẬM BIÊN ĐỘ CAO',
    };
  }
  return {
    title: isProfessional
      ? 'PHÁT HIỆN MẪU EEG BẤT THƯỜNG TIỀM ẨN — Sóng chậm Delta khu trú & bất đối xứng bán cầu'
      : 'Phát hiện sóng chậm bất đối xứng hai bên — Cần bác sĩ đánh giá sớm',
    observation:
      'Tăng sóng chậm Delta ưu thế một bên kèm chênh lệch công suất giữa các cặp kênh đối xứng; cần đối chiếu bệnh sử, khám thần kinh và chẩn đoán hình ảnh.',
    tone: 'amber',
    badgeLabel: 'BẤT THƯỜNG SÓNG CHẬM KHU TRÚ',
  };
}

function getChannelStatusBadge(status: ChannelQualityStatus): { label: string; cls: string } {
  switch (status) {
    case 'GOOD':
      return {
        label: 'Hợp lệ',
        cls: 'border-[#BBF7D0] bg-[#ECFDF3] text-[#15803D]',
      };
    case 'NOISY':
      return {
        label: 'Nhiễu EMG / 50Hz',
        cls: 'border-amber-300 bg-amber-50 text-amber-800',
      };
    case 'DROPOUT':
      return {
        label: 'Mất tín hiệu',
        cls: 'border-red-300 bg-red-50 text-red-800',
      };
    case 'SATURATED':
      return {
        label: 'Bão hòa',
        cls: 'border-red-300 bg-red-50 text-red-800',
      };
    case 'UNAVAILABLE':
    default:
      return {
        label: 'Không đo',
        cls: 'border-slate-200 bg-slate-100 text-slate-600',
      };
  }
}

function computeFallbackChannelQuality(
  analysis: QeegAnalysisResponse,
  recordedChannels: string[],
  notch50Hz: boolean,
): {
  channels: BrainWaveformChannelQuality[];
  hasLineNoiseWarning: boolean;
  hasEmgWarning: boolean;
  hasLowFreqArtifactWarning: boolean;
} {
  let hasLineNoiseWarning = false;
  let hasEmgWarning = false;
  let hasLowFreqArtifactWarning = false;

  const channels: BrainWaveformChannelQuality[] = STANDARD_6_CHANNELS.map((ch) => {
    const provided: QeegChannelQuality | undefined = analysis.signalQuality?.channels?.find(
      (item) => item.channel.toUpperCase() === ch,
    );
    if (provided) {
      if (provided.lineNoiseRatio > 0.25) hasLineNoiseWarning = true;
      if (provided.emgRatio > 0.3) hasEmgWarning = true;
      if (provided.lowFreqDriftRatio > 0.35 || provided.ptpUv > 220) {
        hasLowFreqArtifactWarning = true;
      }
      return {
        channel: provided.channel,
        isRecorded: provided.isRecorded,
        status: provided.status,
        rmsUv: provided.rmsUv,
        ptpUv: provided.ptpUv,
        noteVi: getChannelStatusBadge(provided.status).label,
      };
    }

    if (!recordedChannels.includes(ch)) {
      return {
        channel: ch,
        isRecorded: false,
        status: 'UNAVAILABLE',
        rmsUv: null,
        ptpUv: null,
        noteVi: 'Không đo',
      };
    }

    const filteredSeries = analysis.waveforms.filtered[ch] ?? [];
    const rawSeries = analysis.waveforms.raw?.[ch] ?? [];
    if (filteredSeries.length < 4) {
      return {
        channel: ch,
        isRecorded: true,
        status: 'DROPOUT',
        rmsUv: 0,
        ptpUv: 0,
        noteVi: 'Mất tín hiệu',
      };
    }

    let minV = Infinity;
    let maxV = -Infinity;
    let sqSum = 0;
    let diffSq = 0;
    for (let i = 0; i < filteredSeries.length; i++) {
      const v = filteredSeries[i]!;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
      sqSum += v * v;
      if (i > 0) {
        const d = v - filteredSeries[i - 1]!;
        diffSq += d * d;
      }
    }
    const rmsUv = Math.sqrt(sqSum / filteredSeries.length);
    const ptpUv = maxV - minV;

    let rawDiffRms = 0;
    if (rawSeries.length === filteredSeries.length && rawSeries.length > 0) {
      let rawDiffSq = 0;
      for (let i = 0; i < rawSeries.length; i++) {
        const d = rawSeries[i]! - filteredSeries[i]!;
        rawDiffSq += d * d;
      }
      rawDiffRms = Math.sqrt(rawDiffSq / rawSeries.length);
    }

    const lineRatio = rmsUv > 0.1 ? rawDiffRms / (rmsUv + rawDiffRms) : 0;
    const hfRatio =
      rmsUv > 0.1
        ? Math.sqrt(diffSq / Math.max(1, filteredSeries.length - 1)) / (rmsUv * 1.5)
        : 0;

    if (lineRatio > 0.25 || (!notch50Hz && lineRatio > 0.18)) {
      hasLineNoiseWarning = true;
    }
    if (hfRatio > 0.65) hasEmgWarning = true;
    if (ptpUv > 180) hasLowFreqArtifactWarning = true;

    let status: ChannelQualityStatus = 'GOOD';
    if (rmsUv < 0.4 || ptpUv < 1.2) status = 'DROPOUT';
    else if (ptpUv > 360 || maxV > 240 || minV < -240) status = 'SATURATED';
    else if (lineRatio > 0.38 || hfRatio > 0.72) status = 'NOISY';

    return {
      channel: ch,
      isRecorded: true,
      status,
      rmsUv: Number(rmsUv.toFixed(1)),
      ptpUv: Number(ptpUv.toFixed(1)),
      noteVi: getChannelStatusBadge(status).label,
    };
  });

  return {
    channels,
    hasLineNoiseWarning,
    hasEmgWarning,
    hasLowFreqArtifactWarning,
  };
}

function buildFallbackPsdCurve(analysis: QeegAnalysisResponse): {
  curve: QeegPsdCurve;
  isEstimated: boolean;
} {
  if (
    analysis.psdCurve &&
    analysis.psdCurve.freqsHz.length >= 8 &&
    analysis.psdCurve.meanPowerUv2Hz.length === analysis.psdCurve.freqsHz.length
  ) {
    return { curve: analysis.psdCurve, isEstimated: false };
  }

  const freqsHz: number[] = [];
  const meanPowerUv2Hz: number[] = [];
  const d = Math.max(0.05, analysis.bandPowers.delta);
  const t = Math.max(0.05, analysis.bandPowers.theta);
  const a = Math.max(0.05, analysis.bandPowers.alpha);
  const b = Math.max(0.03, analysis.bandPowers.beta);
  const alphaCenter = Math.max(8.2, Math.min(12.5, analysis.biomarkers.alphaPeakHz || 10.0));

  for (let f = 0.5; f <= 45; f += 0.5) {
    const freq = Number(f.toFixed(1));
    freqsHz.push(freq);
    const oneOverF = (d * 18) / Math.pow(freq + 0.6, 1.45);
    const thetaBump = t * 14 * Math.exp(-Math.pow((freq - 6.0) / 1.8, 2));
    const alphaBump = a * 34 * Math.exp(-Math.pow((freq - alphaCenter) / 1.15, 2));
    const betaBump = b * 8 * Math.exp(-Math.pow((freq - 18.5) / 5.5, 2));
    const gammaTail = 0.25 * Math.exp(-Math.max(0, freq - 30) / 10);
    meanPowerUv2Hz.push(
      Number((oneOverF + thetaBump + alphaBump + betaBump + gammaTail).toFixed(3)),
    );
  }

  return {
    curve: {
      freqsHz,
      meanPowerUv2Hz,
      leftHemispherePowerUv2Hz: [],
      rightHemispherePowerUv2Hz: [],
      gammaRelRatio: 0,
      bandNormalizationBasis: '0.5–30 Hz',
    },
    isEstimated: true,
  };
}

function computeBsiPairs(analysis: QeegAnalysisResponse): QeegBsiPair[] {
  if (analysis.bsiPairs && analysis.bsiPairs.length > 0) {
    return analysis.bsiPairs;
  }
  const topomapNodes = analysis.topomap as unknown as QeegTopomapNode[];
  const nodeMap = new Map(topomapNodes.map((n) => [n.name.toUpperCase(), n]));
  return [
    ['F3', 'F4'],
    ['C3', 'C4'],
    ['O1', 'O2'],
  ].map(([l, r]) => {
    const ln = nodeMap.get(l!);
    const rn = nodeMap.get(r!);
    if (ln && rn && ln.dar + rn.dar > 0) {
      const val = Math.abs(rn.dar - ln.dar) / (rn.dar + ln.dar);
      const side: QeegBsiPair['dominantSide'] =
        val < 0.08 ? 'BALANCED' : ln.dar > rn.dar ? 'LEFT' : 'RIGHT';
      return {
        pair: `${l}–${r}`,
        leftChannel: l!,
        rightChannel: r!,
        isAvailable: true,
        bsi: Number(val.toFixed(3)),
        pdBsi1To25Hz: Number(val.toFixed(3)),
        leftPower: Number(ln.dar.toFixed(2)),
        rightPower: Number(rn.dar.toFixed(2)),
        dominantSide: side,
      };
    }
    return {
      pair: `${l}–${r}`,
      leftChannel: l!,
      rightChannel: r!,
      isAvailable: true,
      bsi: Number(analysis.biomarkers.meanBsi.toFixed(3)),
      pdBsi1To25Hz: Number(analysis.biomarkers.meanBsi.toFixed(3)),
      leftPower: 0,
      rightPower: 0,
      dominantSide: 'BALANCED',
    };
  });
}

function formatFilterDescription(
  analysis: QeegAnalysisResponse,
  waveformMode: 'filtered' | 'raw',
  notch50Hz: boolean,
): string {
  if (waveformMode === 'raw') {
    return 'Raw (Tín hiệu gốc chưa qua lọc số)';
  }
  const fc = analysis.filterConfig;
  if (fc) {
    const notchLabel = fc.notchHz ? `Notch ${fc.notchHz} Hz` : 'Notch Tắt';
    return `${fc.filterType || 'Butterworth'} ${fc.highpassHz}–${fc.lowpassHz} Hz · ${notchLabel}`;
  }
  return `Bandpass 0.5–45 Hz · Notch ${notch50Hz ? '50 Hz Bật' : 'Tắt'}`;
}

function PsdSpectrumChart({
  curve,
  isEstimated,
}: {
  curve: QeegPsdCurve;
  isEstimated: boolean;
}) {
  const w = 440;
  const h = 156;
  const padL = 38;
  const padR = 12;
  const padT = 14;
  const padB = 24;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const maxFreq = Math.max(35, Math.min(45, curve.freqsHz[curve.freqsHz.length - 1] ?? 45));
  const maxPow = Math.max(
    1,
    ...curve.meanPowerUv2Hz,
    ...(curve.leftHemispherePowerUv2Hz ?? []),
    ...(curve.rightHemispherePowerUv2Hz ?? []),
  );

  const toX = (f: number) => padL + (Math.min(f, maxFreq) / maxFreq) * plotW;
  const toY = (p: number) => padT + plotH - (Math.max(0, p) / (maxPow * 1.08)) * plotH;

  const buildPath = (vals: number[]) =>
    curve.freqsHz
      .map((f, i) => `${i === 0 ? 'M' : 'L'}${toX(f).toFixed(1)},${toY(vals[i] ?? 0).toFixed(1)}`)
      .join(' ');

  const meanPath = buildPath(curve.meanPowerUv2Hz);
  const leftPath =
    curve.leftHemispherePowerUv2Hz.length === curve.freqsHz.length &&
    curve.leftHemispherePowerUv2Hz.length > 0
      ? buildPath(curve.leftHemispherePowerUv2Hz)
      : null;
  const rightPath =
    curve.rightHemispherePowerUv2Hz.length === curve.freqsHz.length &&
    curve.rightHemispherePowerUv2Hz.length > 0
      ? buildPath(curve.rightHemispherePowerUv2Hz)
      : null;

  const bands = [
    { label: 'δ', from: 0.5, to: 4, fill: 'rgba(148, 163, 184, 0.14)' },
    { label: 'θ', from: 4, to: 8, fill: 'rgba(245, 158, 11, 0.10)' },
    { label: 'α', from: 8, to: 13, fill: 'rgba(22, 163, 74, 0.13)' },
    { label: 'β', from: 13, to: 30, fill: 'rgba(14, 116, 144, 0.08)' },
    { label: 'γ', from: 30, to: maxFreq, fill: 'rgba(100, 116, 139, 0.06)' },
  ];

  return (
    <div className="rounded-lg border border-[#DCE6DF] bg-white p-2.5 space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
        <span className="font-semibold text-[#141413]">
          Đường cong Phổ Mật độ Công suất (PSD · µV²/Hz)
        </span>
        <span className="text-[#6E6D68] font-mono">
          {isEstimated ? '[Ước lượng phổ từ bandPowers]' : 'Welch PSD 0.5–45 Hz'}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto block bg-white"
        role="img"
        aria-label="Biểu đồ đường cong phổ mật độ công suất EEG theo tần số Hz"
      >
        {bands.map((b) => {
          const x1 = toX(b.from);
          const x2 = toX(b.to);
          return (
            <g key={b.label}>
              <rect x={x1} y={padT} width={Math.max(0, x2 - x1)} height={plotH} fill={b.fill} />
              <text
                x={(x1 + x2) / 2}
                y={padT + 10}
                textAnchor="middle"
                fill="#475569"
                fontSize={9}
                fontWeight={700}
              >
                {b.label}
              </text>
            </g>
          );
        })}

        <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#cbd5e1" strokeWidth={1} />
        <line
          x1={padL}
          y1={padT + plotH}
          x2={padL + plotW}
          y2={padT + plotH}
          stroke="#cbd5e1"
          strokeWidth={1}
        />

        {[0, 4, 8, 13, 20, 30, 40].map((hz) => (
          <g key={hz}>
            <line
              x1={toX(hz)}
              y1={padT + plotH}
              x2={toX(hz)}
              y2={padT + plotH + 3}
              stroke="#64748b"
              strokeWidth={1}
            />
            <text
              x={toX(hz)}
              y={h - 6}
              textAnchor="middle"
              fill="#64748b"
              fontSize={9}
              fontFamily="JetBrains Mono, monospace"
            >
              {hz}
            </text>
          </g>
        ))}

        <text
          x={padL - 4}
          y={padT + 8}
          textAnchor="end"
          fill="#64748b"
          fontSize={8.5}
          fontFamily="JetBrains Mono, monospace"
        >
          {maxPow.toFixed(0)}
        </text>
        <text
          x={padL - 4}
          y={padT + plotH}
          textAnchor="end"
          fill="#64748b"
          fontSize={8.5}
          fontFamily="JetBrains Mono, monospace"
        >
          0
        </text>

        {leftPath && (
          <path d={leftPath} fill="none" stroke="#0284c7" strokeWidth={1.2} strokeDasharray="3 2" />
        )}
        {rightPath && (
          <path d={rightPath} fill="none" stroke="#d97706" strokeWidth={1.2} strokeDasharray="3 2" />
        )}
        <path d={meanPath} fill="none" stroke="#15803D" strokeWidth={2} strokeLinejoin="round" />
      </svg>
      {(leftPath || rightPath) && (
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#575652]">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-[#15803D]" /> Trung bình
          </span>
          {leftPath && (
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-[#0284c7]" /> Bán cầu trái
            </span>
          )}
          {rightPath && (
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-[#d97706]" /> Bán cầu phải
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function MetricInfoDrawer({
  metricKey,
  onClose,
}: {
  metricKey: MetricDetailKey;
  onClose: () => void;
}) {
  const info = METRIC_INFO_DETAILS[metricKey];
  return (
    <div className="mt-2 rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] p-3 text-[11px] text-[#262624] space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <strong className="text-[#141413]">{info.fullName}</strong>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng chi tiết chỉ số"
          className="text-[#6E6D68] hover:text-[#141413]"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      <p>{info.definition}</p>
      <p className="font-mono text-[10.5px] bg-white border border-[#DCE6DF] rounded px-2 py-1 text-[#141413]">
        {info.formula}
      </p>
      <p>
        <strong className="text-[#141413]">Đơn vị:</strong> {info.unit}
      </p>
      <p>
        <strong className="text-[#141413]">Kênh &amp; Cửa sổ:</strong> {info.channelsAndWindow}
      </p>
      <p className="text-[#575652]">
        <strong className="text-[#141413]">Dẫn chứng &amp; Giới hạn:</strong> {info.evidenceAndLimits}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clinical A4 Report Exporter (7 Mandatory Phase 7 Sections)
// ---------------------------------------------------------------------------

function serializeWaveformSvgForPrint(svgEl: SVGSVGElement | null): string {
  if (!svgEl) {
    return '<div style="padding:16px;border:1px dashed #cbd5e1;color:#64748b;font-size:12px;">Không chụp được ảnh SVG sóng não từ khung hiển thị.</div>';
  }
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute('class');
  clone.setAttribute(
    'style',
    'width:100%;height:auto;display:block;background:#ffffff;border:1px solid #cbd5e1;border-radius:4px;',
  );
  return new XMLSerializer().serializeToString(clone);
}

function openClinicalEegReportWindow(params: {
  analysis: QeegAnalysisResponse;
  subjectCode: string;
  isDemonstrationData: boolean;
  dataOriginLabel: string;
  recordedChannels: string[];
  unavailableChannels: string[];
  totalDurationSec: number;
  usableDurationSec: number;
  filterDescription: string;
  channelQuality: BrainWaveformChannelQuality[];
  allAnnotations: PhysicianAnnotationItem[];
  bsiPairs: QeegBsiPair[];
  review: PhysicianReviewState;
  reviewerName: string;
  reviewerUsername: string;
  isVerifiedReviewer: boolean;
  svgElement: SVGSVGElement | null;
}) {
  const {
    analysis,
    subjectCode,
    isDemonstrationData,
    dataOriginLabel,
    recordedChannels,
    unavailableChannels,
    totalDurationSec,
    usableDurationSec,
    filterDescription,
    channelQuality,
    allAnnotations,
    bsiPairs,
    review,
    reviewerName,
    reviewerUsername,
    isVerifiedReviewer,
    svgElement,
  } = params;

  const svgMarkup = serializeWaveformSvgForPrint(svgElement);
  const generatedAt = new Date().toLocaleString('vi-VN');
  const isConfirmed = Boolean(review.confirmedAt);
  const confirmedAtStr = review.confirmedAt
    ? new Date(review.confirmedAt).toLocaleString('vi-VN')
    : 'Chưa xác nhận';

  const bandNormBasis = analysis.psdCurve?.bandNormalizationBasis ?? '0.5–30 Hz';
  const gammaRatio = analysis.psdCurve?.gammaRelRatio;
  const hasValidChannels = channelQuality.some(
    (c) => c.isRecorded && c.status !== 'DROPOUT' && c.status !== 'SATURATED',
  );
  const isQualitySuppressed =
    Boolean(analysis.signalQuality?.aiSuppressedByQuality) ||
    usableDurationSec < 1.5 ||
    !hasValidChannels;
  const suppressionReason =
    analysis.signalQuality?.suppressionReasons?.join(' ') ||
    'Tín hiệu nhiễu nặng / mất kênh / bão hòa biên độ — Không đủ điều kiện diễn giải EEG.';

  const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Báo cáo Đọc Điện Não Đồ & QEEG Lâm Sàng - ${escapeHtml(subjectCode)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; background: #ffffff; margin: 0; padding: 20px; font-size: 12px; line-height: 1.45; }
    .page { max-width: 820px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #15803d; padding-bottom: 10px; margin-bottom: 12px; }
    .brand { font-size: 16px; font-weight: 800; color: #15803d; }
    .subtitle { font-size: 11px; color: #475569; }
    .demo-banner { border: 1.5px solid #d97706; background: #fffbeb; color: #92400e; font-weight: 700; padding: 8px 10px; border-radius: 6px; margin-bottom: 12px; font-size: 11px; text-align: center; }
    .draft-banner { border: 1.5px dashed #b91c1c; background: #fef2f2; color: #991b1b; font-weight: 800; padding: 8px 10px; border-radius: 6px; margin-bottom: 12px; text-align: center; font-size: 12px; }
    h2 { font-size: 13px; font-weight: 700; color: #0f172a; border-left: 3px solid #16a34a; padding-left: 8px; margin: 14px 0 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 11px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 700; color: #1e293b; }
    .mono { font-family: Consolas, "Courier New", monospace; }
    .box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; background: #f8fafc; }
    .physician-box { border: 1.5px solid #16a34a; border-radius: 6px; padding: 10px; background: #f0fdf4; }
    .muted { color: #475569; font-size: 11px; }
    .print-actions { display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 12px; }
    .btn { padding: 7px 14px; border-radius: 6px; border: 1px solid #16a34a; background: #16a34a; color: #fff; font-weight: 600; cursor: pointer; font-size: 12px; }
    @media print { .print-actions { display: none; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="print-actions">
      <button class="btn" onclick="window.print()">In / Lưu PDF (A4)</button>
    </div>

    <div class="header">
      <div>
        <div class="brand">NEUROLINK · BÁO CÁO ĐỌC ĐIỆN NÃO ĐỒ &amp; QEEG LÂM SÀNG</div>
        <div class="subtitle">Hệ thống Trợ giúp Phân tích Sóng não 6 Kênh &amp; Hồ sơ Nhận định Bác sĩ</div>
      </div>
      <div class="mono" style="text-align:right;font-size:10.5px;">
        <div>Mã đối tượng: <strong>${escapeHtml(subjectCode)}</strong></div>
        <div>Mã ca / Tệp: ${escapeHtml(analysis.caseId)}</div>
        <div>Xuất báo cáo: ${escapeHtml(generatedAt)}</div>
      </div>
    </div>

    ${
      isDemonstrationData
        ? '<div class="demo-banner">DỮ LIỆU MÔ PHỎNG – KHÔNG DÙNG CHO QUYẾT ĐỊNH LÂM SÀNG (DEMONSTRATION DATA – NOT FOR CLINICAL DECISION-MAKING)</div>'
        : ''
    }

    ${
      !isConfirmed
        ? '<div class="draft-banner">BẢN NHÁP CHƯA CÓ CHỮ KÝ XÁC NHẬN CỦA BÁC SĨ</div>'
        : ''
    }

    ${
      isQualitySuppressed
        ? `<div class="demo-banner" style="border-color:#d97706;background:#fffbeb;color:#92400e;">TÍN HIỆU KHÔNG ĐẠT CHUẨN KỸ THUẬT — Không đủ điều kiện diễn giải EEG (${escapeHtml(suppressionReason)})</div>`
        : ''
    }

    <h2>1. Thông tin Định danh &amp; Metadata Bản ghi</h2>
    <table>
      <tbody>
        <tr>
          <th style="width:22%">Nguồn dữ liệu</th>
          <td style="width:28%">${escapeHtml(dataOriginLabel)}</td>
          <th style="width:22%">Thời điểm bản ghi</th>
          <td style="width:28%">${escapeHtml(analysis.recordingTimestamp ? new Date(analysis.recordingTimestamp).toLocaleString('vi-VN') : generatedAt)}</td>
        </tr>
        <tr>
          <th>Thời lượng / Khả dụng</th>
          <td class="mono">${totalDurationSec.toFixed(1)} s (Khả dụng: ${usableDurationSec.toFixed(1)} s)</td>
          <th>Tần số lấy mẫu</th>
          <td class="mono">${analysis.samplingRateHz} Hz</td>
        </tr>
        <tr>
          <th>Số kênh &amp; Montage</th>
          <td>${recordedChannels.length} kênh đo (${escapeHtml(recordedChannels.join(', '))}) · Hệ 10–20 rút gọn${unavailableChannels.length ? `<br/><span class="muted">Không đo: ${escapeHtml(unavailableChannels.join(', '))}</span>` : ''}</td>
          <th>Tham chiếu (Reference)</th>
          <td>${escapeHtml(analysis.filterConfig?.reference || 'CAR')} · Tham chiếu vật lý gốc: ${escapeHtml(analysis.filterConfig?.physicalReference || 'Chưa có dữ liệu')}</td>
        </tr>
        <tr>
          <th>Cấu hình lọc</th>
          <td>${escapeHtml(filterDescription)}</td>
          <th>Trở kháng điện cực</th>
          <td>Chưa có dữ liệu (Not available)</td>
        </tr>
        <tr>
          <th>Last Known Well</th>
          <td colspan="3">${escapeHtml(review.lastKnownWellText.trim() || 'Chưa có dữ liệu')} <span class="muted">[Thông tin lâm sàng do bác sĩ nhập — Không tự động kết luận chỉ định tPA]</span></td>
        </tr>
      </tbody>
    </table>

    <h2>2. Đánh giá Chất lượng Tín hiệu Từng Kênh</h2>
    <table>
      <thead>
        <tr>
          <th>Kênh</th>
          <th>Vùng giải phẫu</th>
          <th>Trạng thái</th>
          <th>RMS (µV)</th>
          <th>Đỉnh–Đỉnh (µVpp)</th>
        </tr>
      </thead>
      <tbody>
        ${channelQuality
          .map((ch) => {
            const st = getChannelStatusBadge(ch.status);
            return `<tr>
              <td class="mono"><strong>${escapeHtml(ch.channel)}</strong></td>
              <td>${escapeHtml(CHANNEL_ANATOMY_MAP[ch.channel.toUpperCase()] ?? 'Đạo trình 10–20')}</td>
              <td>${escapeHtml(ch.noteVi || st.label)}</td>
              <td class="mono">${ch.rmsUv !== null && ch.rmsUv !== undefined ? ch.rmsUv.toFixed(1) : '—'}</td>
              <td class="mono">${ch.ptpUv !== null && ch.ptpUv !== undefined ? ch.ptpUv.toFixed(1) : '—'}</td>
            </tr>`;
          })
          .join('')}
      </tbody>
    </table>

    <h2>3. Ảnh chụp Đoạn Sóng EEG &amp; Các Đoạn Đánh dấu</h2>
    <div>${svgMarkup}</div>
    ${
      allAnnotations.length > 0
        ? `<table style="margin-top:8px;">
            <thead><tr><th>Khoảng thời gian</th><th>Kênh</th><th>Phân loại</th><th>Nhãn / Mô tả</th></tr></thead>
            <tbody>
              ${allAnnotations
                .map(
                  (a) => `<tr>
                    <td class="mono">${a.startSec.toFixed(2)}s – ${a.endSec.toFixed(2)}s</td>
                    <td class="mono">${escapeHtml(a.channels?.join(', ') || 'Toàn bộ')}</td>
                    <td>${a.source === 'physician' ? 'Bác sĩ đánh dấu' : a.kind === 'ARTIFACT' ? 'Nhiễu gợi ý' : 'Đoạn bất thường gợi ý'}</td>
                    <td>${escapeHtml(a.label)}</td>
                  </tr>`,
                )
                .join('')}
            </tbody>
          </table>`
        : '<p class="muted">Không có đoạn sóng đánh dấu riêng.</p>'
    }

    <h2>4. Bảng Chỉ số QEEG Định lượng (Lưu ý giới hạn 6 kênh)</h2>
    <table>
      <thead>
        <tr>
          <th>Chỉ số</th>
          <th>Giá trị</th>
          <th>Đơn vị &amp; Cơ sở tính</th>
          <th>Lưu ý giới hạn lâm sàng</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>DAR</strong> (Delta/Alpha)</td>
          <td class="mono">${isQualitySuppressed ? (!hasValidChannels ? 'N/A — Tín hiệu hỏng' : `${analysis.biomarkers.meanDar.toFixed(2)} (Không tin cậy)`) : analysis.biomarkers.meanDar.toFixed(2)}</td>
          <td>Không thứ nguyên · 0.5–4 Hz / 8–13 Hz</td>
          <td>${isQualitySuppressed ? 'Không tin cậy (Lỗi tín hiệu).' : 'Chưa chuẩn hóa lâm sàng cho 6 kênh; tăng cũng gặp trong buồn ngủ, động kinh, nhiễu.'}</td>
        </tr>
        <tr>
          <td><strong>BSI</strong> (Brain Symmetry Index)</td>
          <td class="mono">${isQualitySuppressed ? (!hasValidChannels ? 'N/A — Tín hiệu hỏng' : `${analysis.biomarkers.meanBsi.toFixed(3)} (Không tin cậy)`) : analysis.biomarkers.meanBsi.toFixed(3)}</td>
          <td>[0, 1] · ${escapeHtml(bsiPairs.map((p) => `${p.pair}: ${p.bsi.toFixed(3)}`).join(' · '))}${analysis.pdBsi1To25Hz !== undefined ? ` · pdBSI(1–25Hz): ${analysis.pdBsi1To25Hz.toFixed(3)}` : ''}</td>
          <td>${isQualitySuppressed ? 'Không tin cậy (Lỗi tín hiệu).' : 'Nhạy với nhiễu EMG/tiếp xúc lệch; BSI thấp không loại trừ đột quỵ tuần hoàn sau hay ổ khuyết.'}</td>
        </tr>
        <tr>
          <td><strong>Alpha Peak</strong> (O1, O2)</td>
          <td class="mono">${isQualitySuppressed && (!hasValidChannels || analysis.biomarkers.alphaPeakHz <= 0) ? 'N/A — Tín hiệu hỏng' : `${analysis.biomarkers.alphaPeakHz.toFixed(1)} Hz${isQualitySuppressed ? ' (Không tin cậy)' : ''}`}</td>
          <td>Hz · Dải 8–13 Hz</td>
          <td>${isQualitySuppressed ? 'Không tin cậy (Lỗi tín hiệu).' : analysis.bandPowers.alpha < 0.2 || analysis.bandPowers.delta > 0.5 ? 'Biên độ Alpha thấp / bị lấn át bởi sóng chậm.' : 'Phản ánh đỉnh phổ vùng chẩm khi nhắm mắt.'}</td>
        </tr>
        <tr>
          <td><strong>PSD Band Powers</strong></td>
          <td class="mono">${isQualitySuppressed && !hasValidChannels ? 'N/A — Tín hiệu hỏng' : `δ ${(analysis.bandPowers.delta * 100).toFixed(1)}% · θ ${(analysis.bandPowers.theta * 100).toFixed(1)}% · α ${(analysis.bandPowers.alpha * 100).toFixed(1)}% · β ${(analysis.bandPowers.beta * 100).toFixed(1)}%${isQualitySuppressed ? ' (Không tin cậy)' : ''}`}</td>
          <td>Chuẩn hóa 100% trên ${escapeHtml(bandNormBasis)}${gammaRatio !== undefined ? ` · Gamma(30–45Hz): ${(gammaRatio * 100).toFixed(1)}%` : ''}</td>
          <td>${isQualitySuppressed ? 'Không tin cậy (Lỗi tín hiệu).' : 'Tách Gamma để hạn chế nhiễu EMG ảnh hưởng tỷ trọng 4 dải cơ bản.'}</td>
        </tr>
        <tr>
          <td><strong>TAR / PRI / wPLI</strong></td>
          <td class="mono">${isQualitySuppressed && !hasValidChannels ? 'N/A — Tín hiệu hỏng' : `TAR ${analysis.biomarkers.meanTar.toFixed(2)} · PRI ${analysis.biomarkers.pri.toFixed(2)} · wPLI ${analysis.biomarkers.wpli.toFixed(2)}${isQualitySuppressed ? ' (Không tin cậy)' : ''}`}</td>
          <td>Các chỉ số phụ trợ trên 6 kênh</td>
          <td>${isQualitySuppressed ? 'Không tin cậy (Lỗi tín hiệu).' : 'wPLI bị thiên lệch trên mẫu ngắn và thưa điện cực (6 kênh).'}</td>
        </tr>
      </tbody>
    </table>

    <h2>5. Gợi ý Mô hình Thực nghiệm (Chưa xác thực lâm sàng)</h2>
    <div class="box">
      ${
        isQualitySuppressed
          ? `<div style="font-weight:700;color:#92400e;">KHÓA PHÂN LOẠI TỰ ĐỘNG — TÍN HIỆU KHÔNG ĐẠT CHUẨN KỸ THUẬT</div>
             <div class="muted" style="margin-top:4px;">${escapeHtml(suppressionReason)}</div>`
          : `<div style="font-weight:700;margin-bottom:4px;">Điểm mô hình thực nghiệm — Chưa hiệu chuẩn xác suất lâm sàng</div>
             <div class="mono" style="font-size:11px;">
               Sinh lý tham chiếu: ${(analysis.probabilities.control * 100).toFixed(1)}% |
               Mẫu mạch máu (nhồi máu): ${(analysis.probabilities.ischemic * 100).toFixed(1)}% |
               Mẫu sóng chậm biên độ cao (ICH): ${(analysis.probabilities.hemorrhagic * 100).toFixed(1)}% |
               Dạng động kinh: ${(analysis.probabilities.epileptiform * 100).toFixed(1)}% |
               Giảm cảnh tỉnh: ${(analysis.probabilities.cognitiveFatigue * 100).toFixed(1)}%
             </div>
             <div class="muted" style="margin-top:4px;">
               Cảnh báo: 5 nhóm gộp các phạm trù khác nhau. EEG không phân biệt được nhồi máu vs xuất huyết nội sọ khi chưa chụp CT.
             </div>`
      }
    </div>

    <h2>6. Nhận định Chuyên môn của Bác sĩ &amp; Xác nhận</h2>
    <div class="physician-box">
      <p><strong>Mô tả nền &amp; hoạt động bất thường:</strong><br/>${escapeHtml(review.backgroundAndFindings.trim() || '(Chưa nhập nhận định)')}</p>
      <p><strong>Đánh giá nhiễu &amp; giới hạn kỹ thuật (6 kênh):</strong><br/>${escapeHtml(review.artifactAndTechnicalLimits.trim() || '(Chưa nhập đánh giá kỹ thuật)')}</p>
      <p><strong>Kết luận &amp; Đề xuất lâm sàng:</strong><br/>${escapeHtml(review.conclusionAndPlan.trim() || '(Chưa nhập kết luận)')}</p>
      <hr style="border:none;border-top:1px solid #bbf7d0;margin:8px 0;" />
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:11px;">
        <div>
          <strong>Người đọc bản ghi:</strong> ${escapeHtml(review.confirmedByName || reviewerName)} (@${escapeHtml(review.confirmedByUsername || reviewerUsername)})
          ${isVerifiedReviewer ? ' · Đã xác minh chuyên môn' : ''}
        </div>
        <div>
          <strong>Trạng thái ký xác nhận:</strong> ${isConfirmed ? `Đã xác nhận lúc ${escapeHtml(confirmedAtStr)}` : 'BẢN NHÁP CHƯA CÓ CHỮ KÝ XÁC NHẬN CỦA BÁC SĨ'}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=960,height=840');
  if (!win) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neurolink-eeg-report-${subjectCode.replace(/[^a-zA-Z0-9_-]/g, '_')}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isOnEegHub = location.pathname.startsWith('/eeg-hub') || location.pathname === '/eeg';
  const fullscreenParam = searchParams.get('fullscreen');
  const [isFullscreenMode, setIsFullscreenMode] = useState<boolean>(
    () => fullscreenParam === '1',
  );

  useEffect(() => {
    if (fullscreenParam === '1') {
      setIsFullscreenMode(true);
    }
  }, [fullscreenParam]);

  const exitFullscreenMode = useCallback(() => {
    setIsFullscreenMode(false);
    if (searchParams.get('fullscreen') === '1') {
      const next = new URLSearchParams(searchParams);
      next.delete('fullscreen');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [sourceMode, setSourceMode] = useState<'sample' | 'csv'>('sample');
  const [selectedCaseId, setSelectedCaseId] = useState<string>('case_healthy_alpha');
  const [timeWindowSec, setTimeWindowSec] = useState<number>(6);
  const [notch50Hz, setNotch50Hz] = useState<boolean>(true);
  // Safe default: 0 (no acute symptoms recorded) to prevent false alarms
  const [fastScore, setFastScore] = useState<number>(0);

  const [waveformMode] = useState<'filtered' | 'raw'>('filtered');
  const [topomapMetricMode, setTopomapMetricMode] = useState<TopomapMetricMode>('DELTA_REL');

  // CSV Upload state
  const [csvFilename, setCsvFilename] = useState<string>('');
  const [csvText, setCsvText] = useState<string>('');
  const [csvSamplingRateMode, setCsvSamplingRateMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [csvSamplingRate, setCsvSamplingRate] = useState<number>(500);
  const [csvCategory, setCsvCategory] = useState<ClinicalCategory>('VASCULAR_STROKE');

  const [analysis, setAnalysis] = useState<QeegAnalysisResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Metric info drawer & secondary sections
  const [openMetricInfo, setOpenMetricInfo] = useState<MetricDetailKey | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showReviewPanel, setShowReviewPanel] = useState<boolean>(true);
  const [showAdditionalReviewFields, setShowAdditionalReviewFields] = useState<boolean>(false);

  // Waveform selection & annotation builder state
  const [selectedInterval, setSelectedInterval] = useState<BrainWaveformInterval | null>(null);
  const [showAddAnnForm, setShowAddAnnForm] = useState(false);
  const [newAnnStartSec, setNewAnnStartSec] = useState('1.0');
  const [newAnnEndSec, setNewAnnEndSec] = useState('2.5');
  const [newAnnChannel, setNewAnnChannel] = useState('F3-C3');
  const [newAnnLabel, setNewAnnLabel] = useState('');
  const [newAnnKind, setNewAnnKind] = useState<BrainWaveformAnnotation['kind']>('PHYSICIAN');

  // Physician Clinical Review state (NEVER pre-filled with AI diagnosis!)
  const [reviewState, setReviewState] = useState<PhysicianReviewState>({
    backgroundAndFindings: '',
    artifactAndTechnicalLimits: '',
    conclusionAndPlan: '',
    lastKnownWellText: '',
    confirmedAt: null,
    confirmedByName: null,
    confirmedByUsername: null,
    annotations: [],
  });
  const [reviewFeedback, setReviewFeedback] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

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
  const [saveFeedback, setSaveFeedback] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  // Tabbed clinical reading workspace state (default: waveform Hero view)
  const [activeSection, setActiveSection] = useState<ClinicalSectionTab>('waveform');
  const [viewAllSections, setViewAllSections] = useState<boolean>(false);
  const [focusReviewTick, setFocusReviewTick] = useState<number>(0);

  // Secondary menu + filter panel + sample popover
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSampleMenu, setShowSampleMenu] = useState(false);

  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const filterPanelRef = useRef<HTMLDivElement | null>(null);
  const sampleMenuRef = useRef<HTMLDivElement | null>(null);
  const tabBarRef = useRef<HTMLDivElement | null>(null);
  const waveformSvgRef = useRef<SVGSVGElement | null>(null);
  const waveformContainerRef = useRef<HTMLDivElement | null>(null);
  const reviewSectionRef = useRef<HTMLDivElement | null>(null);
  const reviewFindingsInputRef = useRef<HTMLTextAreaElement | null>(null);

  const casesQuery = useQuery({
    queryKey: ['qeeg-cases'],
    queryFn: () => qeegApi.getCases(),
    enabled: Boolean(user),
  });

  const cases = casesQuery.data?.cases?.length ? casesQuery.data.cases : FALLBACK_CASES;

  const loadPersistedReviewForCase = useCallback((caseId: string) => {
    try {
      const raw = localStorage.getItem(`neurolink_eeg_review_${caseId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PhysicianReviewState>;
        const nextBg = parsed.backgroundAndFindings ?? '';
        const nextArt = parsed.artifactAndTechnicalLimits ?? '';
        const nextConc = parsed.conclusionAndPlan ?? '';
        setReviewState({
          backgroundAndFindings: nextBg,
          artifactAndTechnicalLimits: nextArt,
          conclusionAndPlan: nextConc,
          lastKnownWellText: parsed.lastKnownWellText ?? '',
          confirmedAt: parsed.confirmedAt ?? null,
          confirmedByName: parsed.confirmedByName ?? null,
          confirmedByUsername: parsed.confirmedByUsername ?? null,
          annotations: Array.isArray(parsed.annotations) ? parsed.annotations : [],
        });
        setShowAdditionalReviewFields(Boolean(nextArt.trim() || nextConc.trim()));
        return;
      }
    } catch {
      // Ignore storage errors
    }
    setReviewState({
      backgroundAndFindings: '',
      artifactAndTechnicalLimits: '',
      conclusionAndPlan: '',
      lastKnownWellText: '',
      confirmedAt: null,
      confirmedByName: null,
      confirmedByUsername: null,
      annotations: [],
    });
    setShowAdditionalReviewFields(false);
  }, []);

  const persistReviewForCase = useCallback(
    (caseId: string, nextState: PhysicianReviewState) => {
      try {
        localStorage.setItem(`neurolink_eeg_review_${caseId}`, JSON.stringify(nextState));
      } catch {
        // Ignore storage quota errors
      }
    },
    [],
  );

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
      setReviewFeedback(null);
      setSelectedInterval(null);
      loadPersistedReviewForCase(res.caseId);
      const matched = cases.find((c) => c.id === res.caseId);
      setSaveTitle(matched ? `qEEG · ${matched.name}` : `Bản ghi qEEG (${res.caseId})`);
      setSaveSubjectCode(matched?.subjectId ?? `NL-${Date.now().toString().slice(-4)}`);
      setSaveCategory(res.clinicalCategory);
      setSaveLabel(res.classificationLabel);
      setSaveNote('');
      setDeidentifiedConfirmed(true);
    },
    onError: (err) => {
      setAnalysisError(errorMessage(err));
    },
  });

  const analyzeCsvMutation = useMutation({
    mutationFn: (
      override?:
        | {
            filename: string;
            csvText: string;
            samplingRateHz?: number;
            forceSamplingRate?: boolean;
            clinicalCategory: ClinicalCategory;
          }
        | void,
    ) => {
      const resolvedSamplingRate = override
        ? override.samplingRateHz
        : csvSamplingRateMode === 'MANUAL'
          ? csvSamplingRate
          : undefined;
      const resolvedForce = override
        ? override.forceSamplingRate
        : csvSamplingRateMode === 'MANUAL'
          ? true
          : undefined;

      return qeegApi.analyzeCsv({
        filename: override ? override.filename : csvFilename || 'uploaded_eeg.csv',
        csvText: override ? override.csvText : csvText,
        ...(resolvedSamplingRate !== undefined ? { samplingRateHz: resolvedSamplingRate } : {}),
        ...(resolvedForce ? { forceSamplingRate: true } : {}),
        clinicalCategory: override ? override.clinicalCategory : csvCategory,
      });
    },
    onSuccess: (res, vars) => {
      const resolvedFilename = vars ? vars.filename : csvFilename;
      setAnalysis(res);
      setAnalysisError(null);
      setSavedSampleId(null);
      setSavedDatasetId(null);
      setSaveFeedback(null);
      setReviewFeedback(null);
      setSelectedInterval(null);
      loadPersistedReviewForCase(res.caseId);
      setSaveTitle(`CSV qEEG · ${resolvedFilename || 'Bản ghi tải lên'}`);
      setSaveSubjectCode(`CSV-${Date.now().toString().slice(-4)}`);
      setSaveCategory(res.clinicalCategory);
      setSaveLabel(res.classificationLabel);
      setSaveNote('');
      setDeidentifiedConfirmed(true);
    },
    onError: (err) => {
      setAnalysisError(errorMessage(err));
    },
  });

  const saveToPlatformMutation = useMutation({
    mutationFn: () => {
      if (!analysis) throw new Error('Chưa có kết quả phân tích để lưu.');
      const confirmedPhysicianSummary = reviewState.confirmedAt
        ? `[Nhận định Bác sĩ xác nhận ${new Date(reviewState.confirmedAt).toLocaleString('vi-VN')}] ${reviewState.backgroundAndFindings} | ${reviewState.conclusionAndPlan}`
        : undefined;
      return qeegApi.saveToPlatform({
        title: saveTitle.trim(),
        clinicalCategory: saveCategory,
        groundTruthLabel: saveLabel,
        split: saveSplit,
        subjectCode: saveSubjectCode.trim() || undefined,
        clinicalNote:
          saveNote.trim() ||
          confirmedPhysicianSummary ||
          'Bản ghi QEEG chờ bác sĩ xác nhận nhận định.',
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

  // Automatically run initial analysis on mount
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

  useEffect(() => {
    if (isProfessional) setShowReviewPanel(true);
  }, [isProfessional]);

  // Lock background scroll while in Fullscreen Reading Mode
  useEffect(() => {
    if (!isFullscreenMode) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreenMode]);

  // Close modal & dropdowns on Escape / outside click; exit fullscreen on Escape when no child modal is open
  useEffect(() => {
    if (
      !showSaveModal &&
      !showMoreMenu &&
      !showFilterMenu &&
      !showSampleMenu &&
      !openMetricInfo &&
      !showAddAnnForm &&
      !isFullscreenMode
    ) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (
          showSaveModal ||
          showMoreMenu ||
          showFilterMenu ||
          showSampleMenu ||
          openMetricInfo ||
          showAddAnnForm
        ) {
          setShowSaveModal(false);
          setShowMoreMenu(false);
          setShowFilterMenu(false);
          setShowSampleMenu(false);
          setOpenMetricInfo(null);
          setShowAddAnnForm(false);
          return;
        }
        if (isFullscreenMode) {
          exitFullscreenMode();
        }
      }
    };
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (showMoreMenu && moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setShowMoreMenu(false);
      }
      if (showSampleMenu && sampleMenuRef.current && !sampleMenuRef.current.contains(target)) {
        setShowSampleMenu(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [
    showSaveModal,
    showMoreMenu,
    showFilterMenu,
    showSampleMenu,
    openMetricInfo,
    showAddAnnForm,
    isFullscreenMode,
    exitFullscreenMode,
  ]);

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
      ...(csvSamplingRateMode === 'MANUAL'
        ? { samplingRateHz: csvSamplingRate, forceSamplingRate: true }
        : {}),
      clinicalCategory: csvCategory,
    });
    e.target.value = '';
  };

  const handleOpenSaveModal = () => {
    setSaveFeedback(null);
    if (reviewState.confirmedAt && !saveNote.trim()) {
      setSaveNote(
        `[BS ${reviewState.confirmedByName ?? user?.displayName ?? 'Chuyên gia'} xác nhận] ${reviewState.backgroundAndFindings.trim()} — ${reviewState.conclusionAndPlan.trim()}`.trim(),
      );
    }
    setShowSaveModal(true);
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

  const isBusy = analyzeCaseMutation.isPending || analyzeCsvMutation.isPending;

  const derivedContext = useMemo(() => {
    if (!analysis) return null;

    const recordedChannels =
      analysis.recordedChannels && analysis.recordedChannels.length > 0
        ? analysis.recordedChannels
        : analysis.waveforms.channels.length > 0
          ? analysis.waveforms.channels
          : [...STANDARD_6_CHANNELS];

    const unavailableChannels =
      analysis.unavailableChannels ??
      STANDARD_6_CHANNELS.filter((ch) => !recordedChannels.includes(ch));

    const timeArr = analysis.waveforms.time;
    const computedDur =
      timeArr.length >= 2
        ? Number((timeArr[timeArr.length - 1]! - timeArr[0]!).toFixed(1))
        : timeWindowSec;
    const totalDurationSec =
      analysis.durationSec ?? analysis.signalQuality?.totalDurationSec ?? computedDur;

    const qualityScore =
      analysis.signalQuality?.overallScore ?? analysis.biomarkers.signalQualityScore ?? 0.92;
    const usableDurationSec =
      analysis.usableDurationSec ??
      analysis.signalQuality?.usableDurationSec ??
      Number((totalDurationSec * Math.max(0.4, Math.min(1, qualityScore))).toFixed(1));

    const isDemonstrationData =
      analysis.isDemonstrationData !== undefined
        ? analysis.isDemonstrationData
        : sourceMode === 'sample';

    const dataOriginLabel =
      analysis.dataOrigin === 'USER_UPLOADED_CSV' || sourceMode === 'csv'
        ? 'CSV tải lên'
        : analysis.dataOrigin === 'HARDWARE_SAMPLE_CSV' ||
            analysis.caseId === 'case_ads1299_hardware'
          ? 'Mẫu phần cứng ADS1299'
          : 'Mẫu mô phỏng';

    const filterDescription = formatFilterDescription(analysis, waveformMode, notch50Hz);

    const qualityAssessment = computeFallbackChannelQuality(
      analysis,
      recordedChannels,
      notch50Hz,
    );

    const validChannelsCount = qualityAssessment.channels.filter(
      (c) => c.status === 'GOOD',
    ).length;
    const hasValidChannels = qualityAssessment.channels.some(
      (c) => c.isRecorded && c.status !== 'DROPOUT' && c.status !== 'SATURATED',
    );

    const aiSuppressedByQuality =
      Boolean(analysis.signalQuality?.aiSuppressedByQuality) ||
      usableDurationSec < 1.5 ||
      validChannelsCount < 2 ||
      qualityScore < 0.35;

    const suppressionReasonVi =
      analysis.signalQuality?.suppressionReasons?.join(' ') ||
      'Tín hiệu nhiễu / mất kênh — Đã khóa gợi ý phân loại tự động để tránh diễn giải sai.';

    const psdData = buildFallbackPsdCurve(analysis);
    const bsiPairs = computeBsiPairs(analysis);
    const patternPresentation = getCautiousPatternPresentation(
      analysis,
      isProfessional,
      aiSuppressedByQuality,
      qualityAssessment.channels,
    );

    const systemAnnotations: PhysicianAnnotationItem[] = [
      ...(analysis.signalQuality?.abnormalSegments ?? []).map((s, idx) => ({
        id: `sys-abn-${idx}`,
        startSec: s.startSec,
        endSec: s.endSec,
        kind: 'ABNORMAL' as const,
        channels: s.channels,
        label: s.labelVi || s.type,
        source: 'system' as const,
      })),
      ...(analysis.signalQuality?.artifactSegments ?? []).map((s, idx) => ({
        id: `sys-art-${idx}`,
        startSec: s.startSec,
        endSec: s.endSec,
        kind: 'ARTIFACT' as const,
        channels: s.channels,
        label: s.labelVi || s.type,
        source: 'system' as const,
      })),
    ];

    const allAnnotations: PhysicianAnnotationItem[] = [
      ...systemAnnotations,
      ...reviewState.annotations,
    ];

    const alphaBandLowOrMasked =
      analysis.bandPowers.alpha < 0.2 || analysis.bandPowers.delta > 0.5;

    const isVerifiedReviewer = Boolean(
      user?.professionalProfiles?.some((p) => p.verificationStatus === 'VERIFIED'),
    );

    return {
      recordedChannels,
      unavailableChannels,
      totalDurationSec,
      usableDurationSec,
      isDemonstrationData,
      dataOriginLabel,
      filterDescription,
      qualityAssessment,
      hasValidChannels,
      aiSuppressedByQuality,
      suppressionReasonVi,
      psdData,
      bsiPairs,
      patternPresentation,
      allAnnotations,
      alphaBandLowOrMasked,
      isVerifiedReviewer,
    };
  }, [
    analysis,
    sourceMode,
    timeWindowSec,
    waveformMode,
    notch50Hz,
    isProfessional,
    reviewState.annotations,
    user,
  ]);

  const handleAddAnnotationFromSelection = useCallback(
    (interval: BrainWaveformInterval) => {
      setSelectedInterval(interval);
      setNewAnnStartSec(interval.startSec.toFixed(2));
      setNewAnnEndSec(interval.endSec.toFixed(2));
      setNewAnnKind('PHYSICIAN');
      setShowAddAnnForm(true);
      setShowReviewPanel(true);
    },
    [],
  );

  const handleSubmitManualAnnotation = (e: FormEvent) => {
    e.preventDefault();
    if (!analysis || !derivedContext) return;
    const s = Math.max(0, Number(newAnnStartSec) || 0);
    const en = Math.min(
      derivedContext.totalDurationSec,
      Math.max(s + 0.2, Number(newAnnEndSec) || s + 1),
    );
    const parsedChannels = newAnnChannel
      .split(/[,\-\s]+/)
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c.length > 0 && c !== 'TOÀN' && c !== 'BỘ');

    const item: PhysicianAnnotationItem = {
      id: `phys-${Date.now()}`,
      startSec: Number(s.toFixed(2)),
      endSec: Number(en.toFixed(2)),
      channels: parsedChannels.length > 0 ? parsedChannels : undefined,
      label: newAnnLabel.trim() || 'Đoạn sóng bác sĩ đánh dấu',
      kind: newAnnKind,
      source: 'physician',
    };
    const nextState: PhysicianReviewState = {
      ...reviewState,
      annotations: [...reviewState.annotations, item],
    };
    setReviewState(nextState);
    persistReviewForCase(analysis.caseId, nextState);
    setSelectedInterval({ startSec: item.startSec, endSec: item.endSec });
    setNewAnnLabel('');
    setShowAddAnnForm(false);
  };

  const handleDeletePhysicianAnnotation = (annId: string) => {
    if (!analysis) return;
    const nextState: PhysicianReviewState = {
      ...reviewState,
      annotations: reviewState.annotations.filter((a) => a.id !== annId),
    };
    setReviewState(nextState);
    persistReviewForCase(analysis.caseId, nextState);
  };

  const handleConfirmPhysicianReview = () => {
    if (!analysis) return;
    if (
      reviewState.backgroundAndFindings.trim().length < 5 &&
      reviewState.conclusionAndPlan.trim().length < 5
    ) {
      setReviewFeedback({
        tone: 'error',
        text: 'Vui lòng nhập Mô tả nền/hoạt động bất thường hoặc Kết luận lâm sàng trước khi xác nhận.',
      });
      return;
    }
    const nextState: PhysicianReviewState = {
      ...reviewState,
      confirmedAt: new Date().toISOString(),
      confirmedByName: user?.displayName ?? 'Bác sĩ đọc ca',
      confirmedByUsername: user?.username ?? 'physician',
    };
    setReviewState(nextState);
    persistReviewForCase(analysis.caseId, nextState);
    setReviewFeedback({
      tone: 'success',
      text: `Đã xác nhận nhận định lâm sàng lúc ${new Date(nextState.confirmedAt!).toLocaleString('vi-VN')}.`,
    });
  };

  const handleExportClinicalReport = () => {
    if (!analysis || !derivedContext) return;
    const svgEl =
      waveformSvgRef.current ??
      waveformContainerRef.current?.querySelector('svg') ??
      null;

    openClinicalEegReportWindow({
      analysis,
      subjectCode: saveSubjectCode || analysis.caseId,
      isDemonstrationData: derivedContext.isDemonstrationData,
      dataOriginLabel: derivedContext.dataOriginLabel,
      recordedChannels: derivedContext.recordedChannels,
      unavailableChannels: derivedContext.unavailableChannels,
      totalDurationSec: derivedContext.totalDurationSec,
      usableDurationSec: derivedContext.usableDurationSec,
      filterDescription: derivedContext.filterDescription,
      channelQuality: derivedContext.qualityAssessment.channels,
      allAnnotations: derivedContext.allAnnotations,
      bsiPairs: derivedContext.bsiPairs,
      review: reviewState,
      reviewerName: user?.displayName ?? 'Bác sĩ đọc ca',
      reviewerUsername: user?.username ?? 'physician',
      isVerifiedReviewer: derivedContext.isVerifiedReviewer,
      svgElement: svgEl,
    });
    setShowMoreMenu(false);
  };

  const toggleMetricInfo = (key: MetricDetailKey) => {
    setOpenMetricInfo((curr) => (curr === key ? null : key));
  };

  const groupedSampleCases = useMemo(() => {
    const mapCase = (c: QeegCaseItem) => {
      const meta = SAMPLE_CASE_DISPLAY_META[c.id];
      const fallbackMatch = FALLBACK_CASES.find((fc) => fc.id === c.id);
      const group: 'SIMULATED' | 'HARDWARE' =
        meta?.group ?? (c.clinicalCategory === 'HARDWARE_BCI' ? 'HARDWARE' : 'SIMULATED');
      const label =
        meta?.label ?? (fallbackMatch ? fallbackMatch.name : sanitizeNarrative(c.name));
      return { item: c, group, label };
    };

    const mapped = cases.map(mapCase);
    const simulated = mapped
      .filter((x) => x.group === 'SIMULATED')
      .sort((a, b) => {
        const ia = SIMULATED_CASE_ORDER.indexOf(
          a.item.id as (typeof SIMULATED_CASE_ORDER)[number],
        );
        const ib = SIMULATED_CASE_ORDER.indexOf(
          b.item.id as (typeof SIMULATED_CASE_ORDER)[number],
        );
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
    const hardware = mapped.filter((x) => x.group === 'HARDWARE');
    return { simulated, hardware };
  }, [cases]);

  const activeSampleLabel = useMemo(() => {
    const meta = SAMPLE_CASE_DISPLAY_META[selectedCaseId];
    if (meta) return meta.label;
    const found = cases.find((c) => c.id === selectedCaseId);
    return found ? sanitizeNarrative(found.name) : 'Chọn mẫu';
  }, [cases, selectedCaseId]);

  useEffect(() => {
    if (focusReviewTick > 0) {
      reviewFindingsInputRef.current?.focus();
    }
  }, [focusReviewTick, activeSection, viewAllSections]);

  const selectClinicalSection = useCallback(
    (tab: ClinicalSectionTab, options?: { focusReview?: boolean; forceSingleTab?: boolean }) => {
      if (options?.forceSingleTab !== false) {
        setViewAllSections(false);
      }
      setActiveSection(tab);
      if (tab === 'review') {
        setShowReviewPanel(true);
      }
      if (options?.focusReview) {
        setFocusReviewTick((n) => n + 1);
      }
      if (viewAllSections && options?.forceSingleTab === false) {
        const elId = `sec-${tab}`;
        requestAnimationFrame(() => {
          document.getElementById(elId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    },
    [viewAllSections],
  );

  const openRecordingSettingsInline = useCallback(() => {
    setShowFilterMenu(true);
    requestAnimationFrame(() => {
      filterPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, []);

  const handleJumpToWaveformSegment = useCallback(
    (interval: BrainWaveformInterval, openForm = false) => {
      setSelectedInterval(interval);
      setNewAnnStartSec(interval.startSec.toFixed(2));
      setNewAnnEndSec(interval.endSec.toFixed(2));
      if (openForm) {
        setShowAddAnnForm(true);
      }
      if (viewAllSections) {
        requestAnimationFrame(() => {
          waveformContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      } else {
        setActiveSection('waveform');
      }
    },
    [viewAllSections],
  );

  const viewerOptionalProps = {
    hideInternalHeader: true,
    onOpenRecordingSettings: openRecordingSettingsInline,
  };

  return (
    <div
      className={cn(
        isFullscreenMode
          ? 'fixed inset-0 z-50 bg-[#F4F8F5] overflow-y-auto p-4 sm:p-6 space-y-3.5'
          : 'space-y-3.5',
      )}
    >
      {isFullscreenMode && (
        <div className="rounded-xl bg-[#14532D] border border-[#166534] text-white px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <Activity className="size-4 text-emerald-300 shrink-0" aria-hidden />
            <span className="text-xs sm:text-sm font-bold tracking-tight truncate">
              NeuroLink · Trạm qEEG Lâm sàng Toàn màn hình
            </span>
            <span className="hidden sm:inline-flex items-center rounded-md bg-white/10 px-2 py-0.5 text-[10.5px] font-medium text-emerald-100">
              {isProfessional ? 'Chế độ Chuyên môn' : 'Chế độ Phổ thông'}
            </span>
          </div>
          <button
            type="button"
            onClick={exitFullscreenMode}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 px-3 py-1 text-xs font-semibold text-white transition-colors cursor-pointer shrink-0"
          >
            <Minimize2 className="size-3.5" aria-hidden />
            <span>Thu gọn (ESC)</span>
          </button>
        </div>
      )}

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

      {/* ===================================================================== */}
      {/* Workspace Action Bar (1-Row Desktop Layout)                           */}
      {/* ===================================================================== */}
      <div className="rounded-xl border border-[#DCE6DF] bg-white px-3 py-2 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2">
        {/* Left: Primary CSV Upload + Demo Library Dropdown */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 min-w-0">
          <Button
            type="button"
            size="sm"
            variant={sourceMode === 'csv' ? 'primary' : 'outline'}
            loading={analyzeCsvMutation.isPending}
            onClick={() => document.getElementById('qeeg-csv-upload')?.click()}
            className={cn(
              'h-8 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap shrink-0',
              sourceMode === 'csv'
                ? ''
                : 'border-[#16A34A] text-[#15803D] hover:bg-[#F5FAF7]',
            )}
            icon={<FileUp className="size-3.5" aria-hidden />}
          >
            <span>Tải tệp EEG (CSV)</span>
          </Button>

          {sourceMode === 'csv' && csvFilename && (
            <span
              title={csvFilename}
              className="inline-flex items-center rounded-md border border-[#BBF7D0] bg-[#ECFDF3] px-2 py-1 font-mono text-[11px] font-medium text-[#15803D] max-w-[140px] truncate shrink-0"
            >
              {csvFilename}
            </span>
          )}

          <div ref={sampleMenuRef} className="relative min-w-0">
            <button
              type="button"
              aria-expanded={showSampleMenu}
              aria-haspopup="menu"
              onClick={() => setShowSampleMenu((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs transition-colors cursor-pointer whitespace-nowrap',
                sourceMode === 'sample'
                  ? 'border-[#DCE6DF] bg-[#F5FAF7] text-[#141413] font-medium hover:bg-[#E2EFE6]'
                  : 'border-[#DCE6DF] bg-white text-[#575652] hover:bg-[#F5FAF7]',
              )}
            >
              <span>Kho mẫu</span>
              {sourceMode === 'sample' && (
                <span className="hidden sm:inline font-semibold text-[#15803D] max-w-[180px] xl:max-w-[230px] truncate">
                  · {activeSampleLabel}
                </span>
              )}
              <ChevronDown className="size-3.5 text-[#6E6D68] shrink-0" aria-hidden />
            </button>

            {showSampleMenu && (
              <div
                role="menu"
                className="absolute left-0 top-full mt-1.5 z-40 w-80 sm:w-96 rounded-xl border border-[#DCE6DF] bg-white shadow-lg p-2.5 space-y-2.5 text-xs"
              >
                <div>
                  <div className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#6E6D68]">
                    Tình huống mẫu mô phỏng (Không phải phân loại chẩn đoán)
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {groupedSampleCases.simulated.map(({ item, label }) => {
                      const active = sourceMode === 'sample' && selectedCaseId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="menuitem"
                          data-case-id={item.id}
                          disabled={isBusy}
                          onClick={() => {
                            handleSelectCase(item.id);
                            setShowSampleMenu(false);
                          }}
                          className={cn(
                            'w-full text-left flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg transition-colors cursor-pointer',
                            active
                              ? 'bg-[#ECFDF3] text-[#15803D] font-semibold'
                              : 'text-[#262624] hover:bg-[#F5FAF7]',
                          )}
                        >
                          <span className="truncate">{label}</span>
                          {active && <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {groupedSampleCases.hardware.length > 0 && (
                  <div className="pt-2 border-t border-[#EFF6F1]">
                    <div className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#6E6D68]">
                      Mẫu tệp phần cứng
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {groupedSampleCases.hardware.map(({ item, label }) => {
                        const active = sourceMode === 'sample' && selectedCaseId === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="menuitem"
                            data-case-id={item.id}
                            disabled={isBusy}
                            onClick={() => {
                              handleSelectCase(item.id);
                              setShowSampleMenu(false);
                            }}
                            className={cn(
                              'w-full text-left flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg transition-colors cursor-pointer',
                              active
                                ? 'bg-[#ECFDF3] text-[#15803D] font-semibold'
                                : 'text-[#262624] hover:bg-[#F5FAF7]',
                            )}
                          >
                            <span className="truncate">{label}</span>
                            {active && <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Recording Settings + Save + More Actions */}
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-1.5 min-w-0 max-w-full lg:shrink-0">
          <button
            type="button"
            aria-expanded={showFilterMenu}
            onClick={() => setShowFilterMenu((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap',
              showFilterMenu
                ? 'border-[#16A34A] bg-[#ECFDF3] text-[#15803D]'
                : 'border-[#DCE6DF] bg-white text-[#262624] hover:bg-[#F5FAF7]',
            )}
          >
            <SlidersHorizontal className="size-3.5" aria-hidden />
            <span>Cài đặt đọc &amp; Bộ lọc</span>
            {showFilterMenu ? (
              <ChevronUp className="size-3.5" aria-hidden />
            ) : (
              <ChevronDown className="size-3.5 text-[#6E6D68]" aria-hidden />
            )}
          </button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!analysis}
            onClick={handleOpenSaveModal}
            className="h-8 border-[#DCE6DF] bg-white text-[#141413] px-2.5 whitespace-nowrap"
          >
            {savedDatasetId ? 'Đã lưu ✓' : 'Lưu bản ghi'}
          </Button>

          <div ref={moreMenuRef} className="relative">
            <button
              type="button"
              aria-expanded={showMoreMenu}
              aria-haspopup="menu"
              onClick={() => setShowMoreMenu((v) => !v)}
              className="inline-flex items-center gap-1 h-8 rounded-lg border border-[#DCE6DF] bg-white px-2.5 text-xs font-medium text-[#575652] hover:bg-[#F5FAF7] hover:text-[#141413] transition-colors cursor-pointer whitespace-nowrap"
            >
              <MoreHorizontal className="size-4" aria-hidden />
              <span>Tác vụ khác ▾</span>
            </button>

            {showMoreMenu && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1.5 z-40 w-56 rounded-xl border border-[#DCE6DF] bg-white shadow-lg py-1 text-xs"
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={!analysis}
                  onClick={handleExportClinicalReport}
                  className="w-full text-left flex items-center gap-2 px-3.5 py-2 text-[#262624] hover:bg-[#F5FAF7] disabled:opacity-50"
                >
                  <FileDown className="size-3.5 text-[#15803D]" aria-hidden />
                  <span>Xuất báo cáo PDF / In</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    if (isFullscreenMode) {
                      exitFullscreenMode();
                    } else {
                      setIsFullscreenMode(true);
                    }
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left flex items-center gap-2 px-3.5 py-2 text-[#262624] hover:bg-[#F5FAF7] cursor-pointer"
                >
                  {isFullscreenMode ? (
                    <>
                      <Minimize2 className="size-3.5 text-[#575652]" aria-hidden />
                      <span>Thu gọn (ESC)</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="size-3.5 text-[#575652]" aria-hidden />
                      <span>Toàn màn hình</span>
                    </>
                  )}
                </button>
                {!isOnEegHub && (
                  <Link
                    role="menuitem"
                    to="/eeg-hub?view=workspace"
                    onClick={() => setShowMoreMenu(false)}
                    className="flex items-center gap-2 px-3.5 py-2 text-[#262624] hover:bg-[#F5FAF7]"
                  >
                    <Activity className="size-3.5 text-[#575652]" aria-hidden />
                    <span>Mở Trạm qEEG</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* Tabbed Clinical Reading Strip + Ultra-Slim Context Summary            */}
      {/* ===================================================================== */}
      {analysis && derivedContext && (
        <div
          ref={tabBarRef}
          className="rounded-xl border border-[#DCE6DF] bg-white overflow-hidden shadow-2xs"
        >
          {/* Ultra-slim 1-line record context summary */}
          {(() => {
            const recordCode = sourceMode === 'csv' && csvFilename ? csvFilename : analysis.caseId;
            const qualityPct = Math.round(
              (analysis.signalQuality?.overallScore ?? analysis.biomarkers.signalQualityScore) *
                100,
            );
            const hasNoisyChannel = derivedContext.qualityAssessment.channels.some(
              (c) => c.status === 'NOISY' || c.status === 'DROPOUT' || c.status === 'SATURATED',
            );
            const qualityTextCls = derivedContext.aiSuppressedByQuality
              ? 'font-semibold text-red-700'
              : hasNoisyChannel
                ? 'font-semibold text-amber-700'
                : 'font-semibold text-[#15803D]';
            return (
              <div className="border-b border-[#EFF6F1] bg-[#FAFDFB] px-3 py-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <span
                    className="font-mono font-semibold text-[#141413] truncate max-w-[200px] sm:max-w-[280px]"
                    title={recordCode}
                  >
                    {recordCode}
                  </span>
                  <span className="text-[#9CA3AF]" aria-hidden>
                    ·
                  </span>
                  <span className="font-mono text-[#575652]">{analysis.samplingRateHz} Hz</span>
                  <span className="text-[#9CA3AF]" aria-hidden>
                    ·
                  </span>
                  <span className="font-mono text-[#575652]">
                    {derivedContext.recordedChannels.length} kênh
                  </span>
                  <span className="text-[#9CA3AF]" aria-hidden>
                    ·
                  </span>
                  <span className={qualityTextCls}>
                    Chất lượng {qualityPct}%
                    {derivedContext.aiSuppressedByQuality ? ' (Không đạt chuẩn)' : ''}
                  </span>
                  {derivedContext.isDemonstrationData !== false && (
                    <>
                      <span className="text-[#9CA3AF]" aria-hidden>
                        ·
                      </span>
                      <span className="text-amber-800 font-medium">Dữ liệu mô phỏng</span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  aria-pressed={viewAllSections}
                  onClick={() => setViewAllSections((v) => !v)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium transition-colors cursor-pointer shrink-0',
                    viewAllSections
                      ? 'bg-[#ECFDF3] text-[#15803D] font-semibold'
                      : 'text-[#575652] hover:bg-[#EFF6F1] hover:text-[#141413]',
                  )}
                >
                  <Layers className="size-3" aria-hidden />
                  <span>{viewAllSections ? 'Đang xem tất cả' : 'Xem tất cả'}</span>
                </button>
              </div>
            );
          })()}

          {/* 5-Tab Selection Bar + Direct Physician Actions */}
          <div className="px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2">
            <div
              role="tablist"
              aria-label="Các mục đọc EEG lâm sàng"
              className="flex flex-wrap items-center gap-1 text-[11.5px]"
            >
              {CLINICAL_SECTION_TABS.map((tab) => {
                const isActive = !viewAllSections && activeSection === tab.id;
                const showAiAmberDot =
                  tab.id === 'ai' &&
                  (derivedContext.patternPresentation.tone !== 'neutral' ||
                    derivedContext.aiSuppressedByQuality);
                const showReviewCheck = tab.id === 'review' && Boolean(reviewState.confirmedAt);
                return (
                  <button
                    key={tab.id}
                    id={`tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`sec-${tab.id}`}
                    onClick={() =>
                      selectClinicalSection(tab.id, {
                        focusReview: false,
                        forceSingleTab: true,
                      })
                    }
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 transition-colors cursor-pointer whitespace-nowrap',
                      isActive
                        ? 'border-[#86EFAC] bg-[#ECFDF3] text-[#15803D] font-semibold shadow-2xs'
                        : 'border-transparent text-[#575652] font-medium hover:bg-[#F5FAF7] hover:text-[#15803D]',
                    )}
                  >
                    <span>{tab.label}</span>
                    {showAiAmberDot && (
                      <span
                        className="size-1.5 rounded-full bg-amber-500 shrink-0"
                        title="Có mẫu cần lưu ý hoặc tín hiệu lỗi"
                        aria-hidden
                      />
                    )}
                    {showReviewCheck && (
                      <CheckCircle2
                        className="size-3 text-[#16A34A] shrink-0"
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() =>
                  selectClinicalSection('review', { focusReview: true, forceSingleTab: true })
                }
                className="inline-flex items-center gap-1 rounded-lg bg-[#16A34A] hover:bg-[#15803D] px-2.5 py-1 text-[11.5px] font-semibold text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                <ClipboardCheck className="size-3.5" aria-hidden />
                <span>Viết nhận định</span>
              </button>
              <button
                type="button"
                onClick={handleExportClinicalReport}
                className="inline-flex items-center gap-1 rounded-lg border border-[#DCE6DF] bg-white hover:bg-[#F5FAF7] px-2.5 py-1 text-[11.5px] font-medium text-[#141413] transition-colors cursor-pointer whitespace-nowrap"
              >
                <FileDown className="size-3.5 text-[#15803D]" aria-hidden />
                <span>Xuất báo cáo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* Inline Recording Settings & Filter Drawer (Always In-View)            */}
      {/* ===================================================================== */}
      {showFilterMenu && (
        <div
          ref={filterPanelRef}
          className="rounded-xl border border-[#86EFAC] bg-[#FAFDFB] p-3.5 space-y-3 text-xs shadow-xs"
        >
          <div className="flex items-center justify-between border-b border-[#DCE6DF] pb-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-3.5 text-[#15803D]" aria-hidden />
              <span className="font-bold text-[#141413]">Cài đặt đọc &amp; Bộ lọc EEG</span>
            </div>
            <button
              type="button"
              onClick={() => setShowFilterMenu(false)}
              aria-label="Đóng cài đặt đọc"
              className="text-[#6E6D68] hover:text-[#141413] cursor-pointer"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="space-y-1">
              <label htmlFor="qeeg-window-sec" className="font-medium text-[#262624] block">
                Cửa sổ phân tích
              </label>
              <select
                id="qeeg-window-sec"
                value={timeWindowSec}
                onChange={(e) => setTimeWindowSec(Number(e.target.value))}
                className="h-8 w-full rounded-md border border-[#DCE6DF] bg-white px-2 text-xs font-mono text-[#141413]"
              >
                <option value={4}>4 giây</option>
                <option value={6}>6 giây</option>
                <option value={8}>8 giây</option>
                <option value={10}>10 giây</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="qeeg-fast-score" className="font-medium text-[#262624] block">
                Điểm FAST (tùy chọn)
              </label>
              <select
                id="qeeg-fast-score"
                value={fastScore}
                onChange={(e) => setFastScore(Number(e.target.value))}
                className="h-8 w-full rounded-md border border-[#DCE6DF] bg-white px-2 text-xs font-mono text-[#141413]"
              >
                <option value={0}>0 · Không ghi nhận</option>
                <option value={1}>1 · Nghi ngờ nhẹ</option>
                <option value={2}>2 · Dấu hiệu cấp</option>
                <option value={3}>3 · Khẩn cấp</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="qeeg-csv-hz" className="font-medium text-[#262624] block">
                Tần số CSV
              </label>
              <select
                id="qeeg-csv-hz"
                value={csvSamplingRateMode === 'AUTO' ? 'AUTO' : String(csvSamplingRate)}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'AUTO') {
                    setCsvSamplingRateMode('AUTO');
                  } else {
                    setCsvSamplingRateMode('MANUAL');
                    setCsvSamplingRate(Number(val));
                  }
                }}
                className="h-8 w-full rounded-md border border-[#DCE6DF] bg-white px-2 text-xs font-mono text-[#141413]"
              >
                <option value="AUTO">Tự động từ cột time</option>
                <option value="250">250 Hz</option>
                <option value="256">256 Hz</option>
                <option value="500">500 Hz</option>
                <option value="1000">1000 Hz</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="qeeg-csv-cat" className="font-medium text-[#262624] block">
                Nhóm chuyên khoa CSV
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

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#DCE6DF]">
            <label
              htmlFor="qeeg-notch-50"
              className="inline-flex items-center gap-1.5 font-medium text-[#262624] cursor-pointer"
            >
              <input
                id="qeeg-notch-50"
                type="checkbox"
                checked={notch50Hz}
                onChange={(e) => setNotch50Hz(e.target.checked)}
                className="size-3.5 rounded border-[#DCE6DF] accent-[#16A34A] text-[#16A34A]"
              />
              <span>Notch 50 Hz</span>
            </label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => setShowFilterMenu(false)}
              >
                Đóng
              </Button>
              <Button
                type="button"
                size="xs"
                variant="primary"
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
        </div>
      )}

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

      {analysis && derivedContext && (
        <div className="space-y-4">
          {/* Subtle Single-line Demonstration Data Notice */}
          {derivedContext.isDemonstrationData !== false && (
            <div
              role="status"
              className="rounded-lg border border-amber-200/90 bg-amber-50/75 px-3 py-1 flex items-center gap-2 text-[11px] text-amber-900"
            >
              <ShieldAlert className="size-3.5 text-amber-700 shrink-0" aria-hidden />
              <span>
                <strong>Dữ liệu mô phỏng (Demonstration Data)</strong> — Chỉ phục vụ minh họa, không dùng cho quyết định lâm sàng.
              </span>
            </div>
          )}

          {/* ================================================================= */}
          {/* KHU VỰC 1: Tổng quan bản ghi (Record Overview & Signal Quality)    */}
          {/* ================================================================= */}
          {(viewAllSections || activeSection === 'overview') && (
            <section
              id="sec-overview"
              role="tabpanel"
              aria-labelledby="tab-overview"
              className="scroll-mt-14"
            >
            <Card className="p-4 border-[#DCE6DF] bg-white space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-[#141413]">
                  1. Tổng quan bản ghi
                </h2>
                <span className="text-[11px] font-mono text-[#575652]">
                  {derivedContext.dataOriginLabel} ·{' '}
                  {analysis.recordingTimestamp
                    ? new Date(analysis.recordingTimestamp).toLocaleString('vi-VN')
                    : 'Phiên phân tích hiện tại'}
                </span>
              </div>

              {/* Slim 6-column flat metadata grid (no nested sub-cards) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-2.5 text-xs">
                <div className="min-w-0">
                  <span className="text-[11px] text-[#6E6D68] block">Mã bản ghi</span>
                  <strong className="font-mono text-[#141413] truncate block" title={sourceMode === 'csv' && csvFilename ? csvFilename : analysis.caseId}>
                    {sourceMode === 'csv' && csvFilename ? csvFilename : analysis.caseId}
                  </strong>
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] text-[#6E6D68] block">Thời lượng / Khả dụng</span>
                  <strong className="font-mono text-[#141413]">
                    {derivedContext.totalDurationSec.toFixed(1)} s ({derivedContext.usableDurationSec.toFixed(1)} s đạt chuẩn)
                  </strong>
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] text-[#6E6D68] block">Tần số lấy mẫu</span>
                  <strong className="font-mono text-[#141413]">{analysis.samplingRateHz} Hz</strong>
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] text-[#6E6D68] block">Số kênh &amp; Montage</span>
                  <strong className="text-[#141413]">
                    {derivedContext.recordedChannels.length} kênh ({derivedContext.recordedChannels.join(', ')}) · 10–20 rút gọn
                  </strong>
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] text-[#6E6D68] block">Tham chiếu</span>
                  <strong className="text-[#141413]">
                    {analysis.filterConfig?.reference || 'CAR'} · Vật lý:{' '}
                    {analysis.filterConfig?.physicalReference || 'Chưa có dữ liệu'}
                  </strong>
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] text-[#6E6D68] block">Bộ lọc áp dụng</span>
                  <strong className="text-[#141413]">{derivedContext.filterDescription}</strong>
                </div>
              </div>

              {/* Clean Separator: Signal Quality vs Electrode Impedance */}
              <div className="pt-3 border-t border-[#DCE6DF] grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                <div className="lg:col-span-8 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-[#141413]">Chất lượng tín hiệu:</span>
                    {(() => {
                      const pct = Math.round(
                        (analysis.signalQuality?.overallScore ??
                          analysis.biomarkers.signalQualityScore) * 100,
                      );
                      const hasIssues = derivedContext.qualityAssessment.channels.some(
                        (c) => c.status === 'NOISY' || c.status === 'DROPOUT' || c.status === 'SATURATED',
                      );
                      const label = derivedContext.aiSuppressedByQuality
                        ? `Không đạt chuẩn · ${pct}%`
                        : hasIssues
                          ? `Có nhiễu · ${pct}%`
                          : `Đạt chuẩn · ${pct}%`;
                      const cls = derivedContext.aiSuppressedByQuality
                        ? 'border-red-200 bg-red-50 text-red-800'
                        : hasIssues
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : 'border-[#BBF7D0] bg-[#ECFDF3] text-[#15803D]';
                      return (
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold',
                            cls,
                          )}
                        >
                          {label}
                        </span>
                      );
                    })()}
                  </div>

                  {/* 6 ultra-compact channel chips on 1 row */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {derivedContext.qualityAssessment.channels.map((ch) => {
                      const dotCls =
                        ch.status === 'GOOD'
                          ? 'text-[#16A34A]'
                          : ch.status === 'NOISY'
                            ? 'text-amber-600'
                            : ch.status === 'DROPOUT' || ch.status === 'SATURATED'
                              ? 'text-red-600'
                              : 'text-slate-400';
                      const chipCls =
                        ch.status === 'GOOD'
                          ? 'border-[#DCE6DF] bg-[#F5FAF7] text-[#141413]'
                          : ch.status === 'NOISY'
                            ? 'border-amber-200 bg-amber-50 text-amber-900'
                            : ch.status === 'DROPOUT' || ch.status === 'SATURATED'
                              ? 'border-red-200 bg-red-50 text-red-900'
                              : 'border-slate-200 bg-slate-50 text-slate-600';
                      const detailSuffix =
                        ch.status === 'UNAVAILABLE'
                          ? ' · Không đo'
                          : ch.status === 'DROPOUT'
                            ? ' · Mất tín hiệu'
                            : ch.status === 'SATURATED'
                              ? ' · Bão hòa'
                              : ch.status === 'NOISY'
                                ? ' · Nhiễu'
                                : '';
                      const tooltipText = [
                        `${ch.channel}: ${ch.noteVi ?? getChannelStatusBadge(ch.status).label}`,
                        ch.rmsUv != null ? `RMS ${ch.rmsUv} µV` : null,
                        ch.ptpUv != null ? `PtP ${ch.ptpUv} µVpp` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ');

                      return (
                        <span
                          key={ch.channel}
                          title={tooltipText}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-mono font-semibold',
                            chipCls,
                          )}
                        >
                          <span className={dotCls} aria-hidden>
                            {ch.status === 'UNAVAILABLE' ? '○' : '●'}
                          </span>
                          <span>
                            {ch.channel}
                            {detailSuffix && (
                              <span className="font-sans font-medium">{detailSuffix}</span>
                            )}
                          </span>
                        </span>
                      );
                    })}
                  </div>

                  {(derivedContext.qualityAssessment.hasLineNoiseWarning ||
                    derivedContext.qualityAssessment.hasEmgWarning ||
                    derivedContext.qualityAssessment.hasLowFreqArtifactWarning) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-amber-800">
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <AlertTriangle className="size-3.5 text-amber-700" aria-hidden />
                        Lưu ý nhiễu:
                      </span>
                      {derivedContext.qualityAssessment.hasLineNoiseWarning && (
                        <span>Nhiễu 50 Hz trên tín hiệu gốc</span>
                      )}
                      {derivedContext.qualityAssessment.hasEmgWarning && (
                        <span>Nhiễu cơ EMG cao tần</span>
                      )}
                      {derivedContext.qualityAssessment.hasLowFreqArtifactWarning && (
                        <span>Trôi tần số thấp / chớp mắt</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-4 lg:border-l lg:border-[#DCE6DF] lg:pl-4 space-y-1 text-xs">
                  <span className="text-[11px] font-semibold text-[#575652] block">
                    Trở kháng điện cực (Electrode Impedance)
                  </span>
                  <strong className="text-[#262624] block">
                    Chưa có dữ liệu (Not available)
                  </strong>
                </div>
              </div>
            </Card>
            </section>
          )}

          {/* ================================================================= */}
          {/* KHU VỰC 2: Sóng điện não (EEG Waveform — Always Mounted)          */}
          {/* ================================================================= */}
          <section
            id="sec-waveform"
            ref={waveformContainerRef}
            role="tabpanel"
            aria-labelledby="tab-waveform"
            aria-hidden={!viewAllSections && activeSection !== 'waveform'}
            className={cn(
              'scroll-mt-14 space-y-2.5',
              viewAllSections || activeSection === 'waveform' ? 'block' : 'hidden',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-[#141413]">
                  2. Sóng điện não (EEG Waveform)
                </h2>
                {selectedInterval && (
                  <span className="rounded-md border border-[#86EFAC] bg-[#ECFDF3] px-2 py-0.5 font-mono text-[11px] text-[#15803D]">
                    Đang chọn: {selectedInterval.startSec.toFixed(2)}s –{' '}
                    {selectedInterval.endSec.toFixed(2)}s
                  </span>
                )}
              </div>
              {selectedInterval && (
                <button
                  type="button"
                  onClick={() => setShowAddAnnForm((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#16A34A] bg-white px-2.5 py-1 text-[11.5px] font-semibold text-[#15803D] hover:bg-[#F5FAF7] transition-colors cursor-pointer"
                >
                  <BookmarkPlus className="size-3.5" aria-hidden />
                  <span>+ Đánh dấu đoạn</span>
                </button>
              )}
            </div>

            <BrainWaveformViewer
              waveforms={analysis.waveforms}
              samplingRateHz={analysis.samplingRateHz}
              isProfessional={isProfessional}
              title={`Sóng điện não ${derivedContext.recordedChannels.length} kênh (${analysis.samplingRateHz} Hz)`}
              subtitle={`${derivedContext.recordedChannels.join(', ')} · ${derivedContext.filterDescription}`}
              montageLabel={`${derivedContext.recordedChannels.length} kênh · Hệ 10–20 rút gọn`}
              referenceLabel={
                analysis.filterConfig?.reference || 'CAR (Vật lý gốc: Chưa có dữ liệu)'
              }
              filterDescription={derivedContext.filterDescription}
              channelQuality={derivedContext.qualityAssessment.channels}
              annotations={derivedContext.allAnnotations}
              selectedInterval={selectedInterval}
              onSelectInterval={(interval) => {
                setSelectedInterval(interval);
                if (interval) {
                  setNewAnnStartSec(interval.startSec.toFixed(2));
                  setNewAnnEndSec(interval.endSec.toFixed(2));
                }
              }}
              onAddAnnotationFromSelection={handleAddAnnotationFromSelection}
              svgRef={waveformSvgRef}
              {...viewerOptionalProps}
            />

            {showAddAnnForm && (
              <form
                onSubmit={handleSubmitManualAnnotation}
                className="rounded-xl border border-[#DCE6DF] bg-[#F5FAF7] p-3 grid grid-cols-1 sm:grid-cols-5 gap-2 items-end text-xs"
              >
                <div>
                  <label htmlFor="ann-start" className="block text-[11px] font-semibold text-[#262624]">
                    Bắt đầu (s)
                  </label>
                  <Input
                    id="ann-start"
                    type="number"
                    step="0.1"
                    min="0"
                    value={newAnnStartSec}
                    onChange={(e) => setNewAnnStartSec(e.target.value)}
                    className="h-8 bg-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="ann-end" className="block text-[11px] font-semibold text-[#262624]">
                    Kết thúc (s)
                  </label>
                  <Input
                    id="ann-end"
                    type="number"
                    step="0.1"
                    min="0.2"
                    value={newAnnEndSec}
                    onChange={(e) => setNewAnnEndSec(e.target.value)}
                    className="h-8 bg-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="ann-ch" className="block text-[11px] font-semibold text-[#262624]">
                    Kênh
                  </label>
                  <Input
                    id="ann-ch"
                    value={newAnnChannel}
                    onChange={(e) => setNewAnnChannel(e.target.value)}
                    placeholder="F3-C3 / Toàn bộ"
                    className="h-8 bg-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="ann-cat" className="block text-[11px] font-semibold text-[#262624]">
                    Loại đánh dấu
                  </label>
                  <select
                    id="ann-cat"
                    value={newAnnKind}
                    onChange={(e) =>
                      setNewAnnKind(e.target.value as BrainWaveformAnnotation['kind'])
                    }
                    className="h-8 w-full rounded-lg border border-[#DCE6DF] bg-white px-2 text-xs text-[#141413]"
                  >
                    <option value="PHYSICIAN">Ghi chú Bác sĩ</option>
                    <option value="ABNORMAL">Bất thường</option>
                    <option value="ARTIFACT">Nhiễu kỹ thuật</option>
                  </select>
                </div>
                <div className="flex gap-1.5">
                  <Input
                    aria-label="Nhãn mô tả đoạn sóng"
                    value={newAnnLabel}
                    onChange={(e) => setNewAnnLabel(e.target.value)}
                    placeholder="Nhãn ngắn (vd: Sóng chậm F3)"
                    className="h-8 bg-white text-xs"
                  />
                  <Button type="submit" size="xs" variant="primary" className="h-8 shrink-0">
                    Thêm
                  </Button>
                </div>
              </form>
            )}
          </section>

          {/* ================================================================= */}
          {/* KHU VỰC 3: Phân tích QEEG (Primary Overview + Collapsible Adv.)   */}
          {/* ================================================================= */}
          {(viewAllSections || activeSection === 'qeeg') && (
            <section
              id="sec-qeeg"
              role="tabpanel"
              aria-labelledby="tab-qeeg"
              className="scroll-mt-14 space-y-3"
            >
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-0.5">
              <h2 className="text-sm font-bold text-[#141413]">3. Phân tích QEEG</h2>
              <span className="text-[11px] text-[#575652]">
                Dữ liệu EEG đo được → Chỉ số QEEG dẫn xuất (không tự kết luận chẩn đoán)
              </span>
            </div>

            {/* Part A: Primary Overview (2 airy columns, minimal nesting) */}
            <div className="grid gap-4 lg:grid-cols-12 items-start">
              {/* Left: Topomap 2D */}
              <div className="lg:col-span-5 min-w-0">
                <CorticalTopomap2D
                  nodes={analysis.topomap as unknown as QeegTopomapNode[]}
                  meanBsi={analysis.biomarkers.meanBsi}
                  meanDar={analysis.biomarkers.meanDar}
                  trafficLight={analysis.trafficLight}
                  isProfessional={isProfessional}
                  recordedChannels={derivedContext.recordedChannels}
                  qualitySuppressed={derivedContext.aiSuppressedByQuality}
                  channelStatuses={Object.fromEntries(
                    derivedContext.qualityAssessment.channels.map((c) => [
                      c.channel.toUpperCase(),
                      c.status,
                    ]),
                  )}
                  defaultDisplayMode="MEASURED_6CH"
                  metricMode={topomapMetricMode}
                  onMetricModeChange={setTopomapMetricMode}
                />
              </div>

              {/* Right: 3 Core Metrics in 1 Divided Row + PSD Bands & Curve */}
              <div className="lg:col-span-7 min-w-0 space-y-3">
                <div className="rounded-xl border border-[#DCE6DF] bg-white overflow-hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#DCE6DF]">
                    {/* DAR */}
                    <div className="p-3.5 space-y-1.5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-bold text-[#141413]">DAR (Delta/Alpha)</span>
                          <span className="font-mono text-base font-bold text-[#141413] tabular-nums">
                            {derivedContext.aiSuppressedByQuality && !derivedContext.hasValidChannels
                              ? 'N/A'
                              : analysis.biomarkers.meanDar.toFixed(2)}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-[#575652] leading-snug">
                          {derivedContext.aiSuppressedByQuality
                            ? derivedContext.hasValidChannels
                              ? 'Không tin cậy (Lỗi tín hiệu)'
                              : 'N/A — Tín hiệu hỏng'
                            : 'Tỷ lệ sóng chậm Delta so với nhịp Alpha'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleMetricInfo('dar')}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#15803D] hover:underline self-start cursor-pointer"
                      >
                        <Info className="size-3" aria-hidden />
                        <span>Chi tiết chỉ số</span>
                      </button>
                    </div>

                    {/* BSI */}
                    <div className="p-3.5 space-y-1.5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-bold text-[#141413]">BSI (Độ bất đối xứng)</span>
                          <span className="font-mono text-base font-bold text-[#141413] tabular-nums">
                            {derivedContext.aiSuppressedByQuality && !derivedContext.hasValidChannels
                              ? 'N/A'
                              : analysis.biomarkers.meanBsi.toFixed(3)}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-[#575652] leading-snug">
                          {derivedContext.aiSuppressedByQuality
                            ? derivedContext.hasValidChannels
                              ? 'Không tin cậy (Lỗi tín hiệu)'
                              : 'N/A — Tín hiệu hỏng'
                            : 'Chênh lệch công suất giữa bán cầu trái và phải'}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[10px] text-[#575652]">
                          {derivedContext.bsiPairs.map((pair) => (
                            <span key={pair.pair}>
                              {pair.pair}:{' '}
                              <strong className="text-[#141413]">
                                {pair.isAvailable ? pair.bsi.toFixed(2) : 'N/A'}
                              </strong>
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleMetricInfo('bsi')}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#15803D] hover:underline self-start cursor-pointer"
                      >
                        <Info className="size-3" aria-hidden />
                        <span>Chi tiết chỉ số</span>
                      </button>
                    </div>

                    {/* Alpha Peak */}
                    <div className="p-3.5 space-y-1.5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-bold text-[#141413]">Đỉnh Alpha (O1, O2)</span>
                          <span className="font-mono text-base font-bold text-[#141413] tabular-nums">
                            {derivedContext.aiSuppressedByQuality &&
                            (!derivedContext.hasValidChannels || analysis.biomarkers.alphaPeakHz <= 0)
                              ? 'N/A'
                              : `${analysis.biomarkers.alphaPeakHz.toFixed(1)} Hz`}
                          </span>
                        </div>
                        <p
                          className={cn(
                            'mt-1 text-[11px] leading-snug',
                            derivedContext.aiSuppressedByQuality || derivedContext.alphaBandLowOrMasked
                              ? 'font-medium text-amber-800'
                              : 'text-[#575652]',
                          )}
                        >
                          {derivedContext.aiSuppressedByQuality
                            ? derivedContext.hasValidChannels && analysis.biomarkers.alphaPeakHz > 0
                              ? 'Không tin cậy (Lỗi tín hiệu)'
                              : 'N/A — Tín hiệu hỏng'
                            : derivedContext.alphaBandLowOrMasked
                              ? 'Biên độ Alpha thấp / bị lấn át bởi sóng chậm'
                              : 'Đỉnh phổ nằm trong dải Alpha chuẩn (8.5–12 Hz)'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleMetricInfo('alphaPeak')}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#15803D] hover:underline self-start cursor-pointer"
                      >
                        <Info className="size-3" aria-hidden />
                        <span>Chi tiết chỉ số</span>
                      </button>
                    </div>
                  </div>

                  {(openMetricInfo === 'dar' ||
                    openMetricInfo === 'bsi' ||
                    openMetricInfo === 'alphaPeak') && (
                    <div className="px-3.5 pb-3.5 border-t border-[#DCE6DF]">
                      <MetricInfoDrawer
                        metricKey={openMetricInfo}
                        onClose={() => setOpenMetricInfo(null)}
                      />
                    </div>
                  )}
                </div>

                {/* PSD 4 Bands + Welch Spectrum Curve Side-by-Side */}
                <div className="rounded-xl border border-[#DCE6DF] bg-white p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold text-[#141413]">
                        Phổ công suất 4 dải tần &amp; Đường cong Welch PSD
                      </h3>
                      <span
                        className={cn(
                          'text-[10.5px]',
                          derivedContext.aiSuppressedByQuality
                            ? 'font-semibold text-amber-800'
                            : 'text-[#6E6D68]',
                        )}
                      >
                        {derivedContext.aiSuppressedByQuality
                          ? derivedContext.hasValidChannels
                            ? 'Không tin cậy (Lỗi tín hiệu) · '
                            : 'N/A — Tín hiệu hỏng · '
                          : ''}
                        0.5–30 Hz = 100%
                        {analysis.psdCurve?.gammaRelRatio !== undefined
                          ? ` · Gamma (30–45 Hz tách riêng): ${(analysis.psdCurve.gammaRelRatio * 100).toFixed(1)}%`
                          : ' · Gamma 30–45 Hz tách riêng'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleMetricInfo('psd')}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#15803D] hover:underline shrink-0 cursor-pointer"
                    >
                      <Info className="size-3" aria-hidden />
                      <span>Chi tiết chỉ số</span>
                    </button>
                  </div>

                  {openMetricInfo === 'psd' && (
                    <MetricInfoDrawer metricKey="psd" onClose={() => setOpenMetricInfo(null)} />
                  )}

                  <div className="grid gap-3 md:grid-cols-12 items-center">
                    <div className="md:col-span-5 space-y-2 text-xs font-mono tabular-nums">
                      {[
                        {
                          key: 'delta',
                          label: 'Delta (0.5–4 Hz)',
                          val: analysis.bandPowers.delta,
                          bar: 'bg-slate-500',
                        },
                        {
                          key: 'theta',
                          label: 'Theta (4–8 Hz)',
                          val: analysis.bandPowers.theta,
                          bar: 'bg-amber-500',
                        },
                        {
                          key: 'alpha',
                          label: 'Alpha (8–13 Hz)',
                          val: analysis.bandPowers.alpha,
                          bar: 'bg-[#16A34A]',
                        },
                        {
                          key: 'beta',
                          label: 'Beta (13–30 Hz)',
                          val: analysis.bandPowers.beta,
                          bar: 'bg-[#141413]',
                        },
                      ].map((b) => {
                        const pct = Math.max(0, Math.min(100, Math.round(b.val * 100)));
                        return (
                          <div key={b.key} className="space-y-0.5">
                            <div className="flex justify-between text-[11px]">
                              <span className="font-sans font-medium text-[#575652]">{b.label}</span>
                              <span className="font-semibold text-[#141413]">{pct}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-[#EFF6F1] overflow-hidden">
                              <div className={cn('h-full rounded-full', b.bar)} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="md:col-span-7">
                      <PsdSpectrumChart
                        curve={derivedContext.psdData.curve}
                        isEstimated={derivedContext.psdData.isEstimated}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Part B: Advanced QEEG Analysis (Collapsed by default) */}
            <div className="rounded-xl border border-[#DCE6DF] bg-[#F5FAF7]/80 overflow-hidden">
              <button
                type="button"
                aria-expanded={showDetails}
                onClick={() => setShowDetails((v) => !v)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-[#262624] hover:text-[#141413] transition-colors cursor-pointer"
              >
                <span>Phân tích nâng cao (TAR · wPLI · PRI · 80 đặc trưng)</span>
                {showDetails ? (
                  <ChevronUp className="size-4 text-[#575652]" aria-hidden />
                ) : (
                  <ChevronDown className="size-4 text-[#575652]" aria-hidden />
                )}
              </button>

              {showDetails && (
                <div className="border-t border-[#DCE6DF] bg-white">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#DCE6DF] text-xs">
                    <div className="p-3.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#141413]">TAR (Theta/Alpha)</span>
                        <button
                          type="button"
                          onClick={() => toggleMetricInfo('tar')}
                          className="text-[10.5px] font-semibold text-[#15803D] hover:underline cursor-pointer"
                        >
                          ⓘ Chi tiết chỉ số
                        </button>
                      </div>
                      <strong className="block font-mono text-base text-[#141413] tabular-nums">
                        {derivedContext.aiSuppressedByQuality && !derivedContext.hasValidChannels
                          ? 'N/A'
                          : analysis.biomarkers.meanTar.toFixed(2)}
                      </strong>
                      <p
                        className={cn(
                          'text-[10.5px]',
                          derivedContext.aiSuppressedByQuality
                            ? 'font-medium text-amber-800'
                            : 'text-[#6E6D68]',
                        )}
                      >
                        {derivedContext.aiSuppressedByQuality
                          ? derivedContext.hasValidChannels
                            ? 'Không tin cậy (Lỗi tín hiệu)'
                            : 'N/A — Tín hiệu hỏng'
                          : '4–8 Hz / 8–13 Hz · Tăng khi buồn ngủ hoặc giảm cảnh tỉnh.'}
                      </p>
                    </div>

                    <div className="p-3.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#141413]">wPLI (Vinck 2011)</span>
                        <button
                          type="button"
                          onClick={() => toggleMetricInfo('wpli')}
                          className="text-[10.5px] font-semibold text-[#15803D] hover:underline cursor-pointer"
                        >
                          ⓘ Chi tiết chỉ số
                        </button>
                      </div>
                      <strong className="block font-mono text-base text-[#141413] tabular-nums">
                        {derivedContext.aiSuppressedByQuality && !derivedContext.hasValidChannels
                          ? 'N/A'
                          : analysis.biomarkers.wpli.toFixed(2)}
                      </strong>
                      <p
                        className={cn(
                          'text-[10.5px]',
                          derivedContext.aiSuppressedByQuality
                            ? 'font-medium text-amber-800'
                            : 'text-[#6E6D68]',
                        )}
                      >
                        {derivedContext.aiSuppressedByQuality
                          ? derivedContext.hasValidChannels
                            ? 'Không tin cậy (Lỗi tín hiệu)'
                            : 'N/A — Tín hiệu hỏng'
                          : '[0, 1] · Lưu ý thiên lệch trên mẫu ngắn & thưa 6 kênh.'}
                      </p>
                    </div>

                    <div className="p-3.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#141413]">PRI (Nagata 1989)</span>
                        <button
                          type="button"
                          onClick={() => toggleMetricInfo('pri')}
                          className="text-[10.5px] font-semibold text-[#15803D] hover:underline cursor-pointer"
                        >
                          ⓘ Chi tiết chỉ số
                        </button>
                      </div>
                      <strong className="block font-mono text-base text-[#141413] tabular-nums">
                        {derivedContext.aiSuppressedByQuality && !derivedContext.hasValidChannels
                          ? 'N/A'
                          : analysis.biomarkers.pri.toFixed(2)}
                      </strong>
                      <p
                        className={cn(
                          'text-[10.5px]',
                          derivedContext.aiSuppressedByQuality
                            ? 'font-medium text-amber-800'
                            : 'text-[#6E6D68]',
                        )}
                      >
                        {derivedContext.aiSuppressedByQuality
                          ? derivedContext.hasValidChannels
                            ? 'Không tin cậy (Lỗi tín hiệu)'
                            : 'N/A — Tín hiệu hỏng'
                          : '(Delta + Theta) / (Alpha + Beta) · Chậm hóa nền không đặc hiệu.'}
                      </p>
                    </div>

                    <div className="p-3.5 space-y-1">
                      <span className="font-semibold text-[#141413] block">Vector 80 đặc trưng</span>
                      <strong className="block font-mono text-base text-[#141413] tabular-nums">
                        {analysis.featureVector80.length || 80} đặc trưng
                      </strong>
                      <p className="text-[10.5px] text-[#6E6D68]">
                        F01–F60 phổ/Hjorth 6 kênh · F61–F66 BSI · F67–F72 wPLI · F73–F80 tổng hợp ({analysis.latencyMs} ms).
                      </p>
                    </div>
                  </div>

                  {(openMetricInfo === 'tar' ||
                    openMetricInfo === 'wpli' ||
                    openMetricInfo === 'pri') && (
                    <div className="px-3.5 pb-3.5 border-t border-[#DCE6DF]">
                      <MetricInfoDrawer
                        metricKey={openMetricInfo}
                        onClose={() => setOpenMetricInfo(null)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            </section>
          )}

          {/* ================================================================= */}
          {/* KHU VỰC 4: Gợi ý hỗ trợ từ AI (Calm, Secondary Decision Support)  */}
          {/* ================================================================= */}
          {(viewAllSections || activeSection === 'ai') && (
            <section
              id="sec-ai"
              role="tabpanel"
              aria-labelledby="tab-ai"
              className="scroll-mt-14"
            >
            <Card
              className={cn(
                'p-4 space-y-3.5',
                derivedContext.patternPresentation.tone === 'quality' ||
                  derivedContext.patternPresentation.tone === 'amber'
                  ? 'border-amber-300 bg-amber-50/20'
                  : 'border-[#DCE6DF] bg-white',
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EFF6F1] pb-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-[#141413]">4. Gợi ý hỗ trợ từ AI</h2>
                    <span className="inline-flex items-center rounded-md border border-[#DCE6DF] bg-[#F5FAF7] px-2 py-0.5 text-[10.5px] font-medium text-[#575652]">
                      Công cụ hỗ trợ — Không phải chẩn đoán lâm sàng
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md border px-2 py-0.5 text-[10.5px] font-semibold',
                        derivedContext.patternPresentation.tone === 'neutral'
                          ? 'border-[#BBF7D0] bg-[#ECFDF3] text-[#15803D]'
                          : 'border-amber-300 bg-amber-50 text-amber-900',
                      )}
                    >
                      {derivedContext.patternPresentation.badgeLabel}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[#262624]">
                    {derivedContext.patternPresentation.title}
                  </p>
                </div>

                {!isProfessional && (
                  <Link
                    to={
                      savedSampleId
                        ? `/consultations?sampleId=${encodeURIComponent(savedSampleId)}${savedDatasetId ? `&datasetId=${encodeURIComponent(savedDatasetId)}` : ''}&category=${analysis.clinicalCategory}&ask=1`
                        : `/consultations?category=${analysis.clinicalCategory}&ask=1`
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#16A34A] hover:bg-[#15803D] px-3 py-1.5 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
                  >
                    <MessageSquarePlus className="size-3.5" aria-hidden />
                    <span>Gửi hỏi Bác sĩ →</span>
                  </Link>
                )}
              </div>

              {/* 4 Clearly Separated Blocks */}
              <div className="grid gap-4 md:grid-cols-2 text-xs">
                {/* 1. Quan sát đặc trưng EEG */}
                <div className="space-y-1.5">
                  <div className="font-bold text-[#141413]">1. Quan sát đặc trưng EEG</div>
                  {derivedContext.aiSuppressedByQuality ? (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[11.5px] text-amber-950 flex items-start gap-2">
                      <Lock className="size-4 text-amber-700 shrink-0 mt-0.5" aria-hidden />
                      <div>
                        <strong className="block">
                          TÍN HIỆU KHÔNG ĐẠT CHUẨN KỸ THUẬT · Không đủ điều kiện diễn giải EEG
                        </strong>
                        <span className="text-[11px] text-amber-900">
                          {derivedContext.patternPresentation.observation}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1 text-[#262624] leading-relaxed">
                      <p>{derivedContext.patternPresentation.observation}</p>
                      {analysis.decisionReason && (
                        <p className="text-[11px] text-[#575652]">
                          Ghi nhận kỹ thuật: {sanitizeNarrative(analysis.decisionReason)}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Đầu ra mô hình thực nghiệm (Chưa hiệu chuẩn xác suất) */}
                <div className="space-y-1.5">
                  <div>
                    <div className="font-bold text-[#141413]">
                      2. Đầu ra mô hình thực nghiệm (Chưa hiệu chuẩn xác suất)
                    </div>
                    <span className="text-[10.5px] text-[#6E6D68]">
                      Điểm phân loại tương đối (Experimental Uncalibrated Model Score — Không phải xác suất bệnh lý)
                    </span>
                  </div>

                  {derivedContext.aiSuppressedByQuality ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
                      <Lock className="size-3.5 text-amber-700 shrink-0 mt-0.5" aria-hidden />
                      <span>{derivedContext.suppressionReasonVi}</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5 font-mono tabular-nums text-[10.5px]">
                      {[
                        {
                          key: 'control',
                          label: 'Nền tham chiếu',
                          val: analysis.probabilities.control,
                          bar: 'bg-[#16A34A]',
                        },
                        {
                          key: 'ischemic',
                          label: 'Sóng chậm khu trú (mẫu mạch máu)',
                          val: analysis.probabilities.ischemic,
                          bar: 'bg-amber-600',
                        },
                        {
                          key: 'hemorrhagic',
                          label: 'Sóng chậm biên độ cao (mẫu ICH)',
                          val: analysis.probabilities.hemorrhagic,
                          bar: 'bg-amber-700',
                        },
                        {
                          key: 'epileptiform',
                          label: 'Mẫu dạng kịch phát',
                          val: analysis.probabilities.epileptiform,
                          bar: 'bg-amber-500',
                        },
                        {
                          key: 'cognitiveFatigue',
                          label: 'Giảm cảnh tỉnh / Buồn ngủ',
                          val: analysis.probabilities.cognitiveFatigue,
                          bar: 'bg-slate-500',
                        },
                      ].map((p) => {
                        const pct = Math.max(0, Math.min(100, Math.round(p.val * 100)));
                        return (
                          <div key={p.key} className="space-y-0.5">
                            <div className="flex justify-between">
                              <span className="font-sans text-[#575652]">{p.label}</span>
                              <span className="font-semibold text-[#141413]">
                                {(p.val * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-[#EFF6F1] overflow-hidden">
                              <div className={cn('h-full rounded-full', p.bar)} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Tình trạng xác thực & Độ tin cậy */}
                <div className="pt-3 border-t border-[#EFF6F1] space-y-1">
                  <div className="font-bold text-[#141413]">
                    3. Tình trạng xác thực &amp; Độ tin cậy
                  </div>
                  <p className="text-[11px] text-[#575652] leading-relaxed">
                    Thuật toán phân loại thực nghiệm 5 nhóm chưa qua thử nghiệm kiểm định lâm sàng đa trung tâm; 5 nhóm gộp nhiều phạm trù sinh lý/bệnh lý khác nhau.
                    {derivedContext.isDemonstrationData !== false && (
                      <>
                        {' '}
                        <strong className="text-amber-800">Dữ liệu mô phỏng</strong> — chỉ dùng minh họa quy trình.
                      </>
                    )}
                  </p>
                </div>

                {/* 4. Giới hạn & Bối cảnh lâm sàng chưa có */}
                <div className="pt-3 border-t border-[#EFF6F1] space-y-2">
                  <div className="font-bold text-[#141413]">
                    4. Giới hạn &amp; Bối cảnh lâm sàng chưa có
                  </div>
                  <p className="text-[11px] text-[#575652] leading-relaxed">
                    Hệ 6 kênh không thể chẩn đoán phân biệt đột quỵ thiếu máu/xuất huyết, tắc mạch lớn (LVO) hay tự chỉ định tPA khi chưa thăm khám thần kinh và chụp CT/CTA sọ não.
                  </p>
                  <div className="space-y-1">
                    <label htmlFor="lkw-manual-input" className="text-[11px] font-semibold text-[#262624] block">
                      Thời điểm khởi phát (Last Known Well):{' '}
                      <span className="font-normal text-[#6E6D68]">
                        {reviewState.lastKnownWellText.trim() || 'Chưa có dữ liệu'}
                      </span>
                    </label>
                    {isProfessional && (
                      <Input
                        id="lkw-manual-input"
                        value={reviewState.lastKnownWellText}
                        onChange={(e) => {
                          const nextState = { ...reviewState, lastKnownWellText: e.target.value };
                          setReviewState(nextState);
                          persistReviewForCase(analysis.caseId, nextState);
                        }}
                        placeholder="Bác sĩ nhập tay nếu có (vd: 10:30 hôm nay)"
                        className="h-8 bg-white text-[11px]"
                      />
                    )}
                  </div>
                  <p className="text-[11px] text-[#262624] rounded-md bg-[#F5FAF7] px-2.5 py-1.5 border border-[#DCE6DF]">
                    <strong>Khuyến nghị quy trình:</strong>{' '}
                    {derivedContext.aiSuppressedByQuality
                      ? 'Kiểm tra lại điện cực, nguồn nhiễu 50 Hz và ghi lại tối thiểu 4 kênh sạch >= 2 giây trước khi diễn giải.'
                      : analysis.trafficLight === 'red' ||
                          analysis.trafficLight === 'purple' ||
                          fastScore >= 2
                        ? 'Nếu có dấu hiệu thần kinh khu trú cấp tính, kích hoạt quy trình cấp cứu dưới giám sát bác sĩ và chỉ định CT sọ não không cản quang.'
                        : 'Đối chiếu triệu chứng lâm sàng, thuốc đang dùng và đo EEG chuẩn 10–20 (19 kênh) khi cần.'}
                  </p>
                </div>
              </div>
            </Card>
            </section>
          )}

          {/* ================================================================= */}
          {/* KHU VỰC 5: Nhận định Bác sĩ & Báo cáo (Physician Review & Report) */}
          {/* ================================================================= */}
          {(viewAllSections || activeSection === 'review') && (
            <section
              id="sec-review"
              ref={reviewSectionRef}
              role="tabpanel"
              aria-labelledby="tab-review"
              className="scroll-mt-14 rounded-xl border border-[#DCE6DF] bg-white overflow-hidden"
            >
            <button
              type="button"
              aria-expanded={showReviewPanel}
              onClick={() => setShowReviewPanel((v) => !v)}
              className="w-full px-4 py-3 bg-[#F5FAF7] border-b border-[#DCE6DF] flex items-center justify-between gap-2 text-left cursor-pointer"
            >
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="size-4 text-[#15803D]" aria-hidden />
                <h2 className="text-sm font-bold text-[#141413]">
                  5. Nhận định Bác sĩ &amp; Báo cáo
                </h2>
                {reviewState.confirmedAt ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-[#BBF7D0] bg-[#ECFDF3] px-2 py-0.5 text-[10.5px] font-bold text-[#15803D]">
                    <CheckCircle2 className="size-3" aria-hidden />
                    Đã xác nhận lúc {new Date(reviewState.confirmedAt).toLocaleString('vi-VN')}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800">
                    Bản nháp chưa xác nhận
                  </span>
                )}
              </div>
              {showReviewPanel ? (
                <ChevronUp className="size-4 text-[#575652]" aria-hidden />
              ) : (
                <ChevronDown className="size-4 text-[#575652]" aria-hidden />
              )}
            </button>

            {showReviewPanel && (
              <div className="p-4 space-y-4 text-xs">
                {reviewFeedback && <Alert tone={reviewFeedback.tone}>{reviewFeedback.text}</Alert>}

                {/* Segment & Event Annotations Strip */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-bold text-[#141413]">
                      Đoạn sóng &amp; Sự kiện đánh dấu ({derivedContext.allAnnotations.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddAnnForm(true);
                        if (viewAllSections) {
                          requestAnimationFrame(() => {
                            waveformContainerRef.current?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'start',
                            });
                          });
                        } else {
                          setActiveSection('waveform');
                        }
                      }}
                      className="text-[11px] font-semibold text-[#15803D] hover:underline cursor-pointer"
                    >
                      + Thêm đánh dấu
                    </button>
                  </div>

                  {derivedContext.allAnnotations.length === 0 ? (
                    <p className="text-[11px] text-[#6E6D68]">
                      Chưa có đoạn sóng nào được đánh dấu. Kéo chọn trên biểu đồ sóng ở mục 2 hoặc bấm &ldquo;+ Thêm đánh dấu&rdquo;.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {derivedContext.allAnnotations.map((ann) => {
                        const isSelected =
                          selectedInterval?.startSec === ann.startSec &&
                          selectedInterval?.endSec === ann.endSec;
                        return (
                          <div
                            key={ann.id}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                              isSelected
                                ? 'border-[#16A34A] bg-[#ECFDF3] text-[#141413]'
                                : 'border-[#DCE6DF] bg-[#F5FAF7] text-[#262624]',
                            )}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                handleJumpToWaveformSegment({
                                  startSec: ann.startSec,
                                  endSec: ann.endSec,
                                })
                              }
                              title="Bấm để chuyển sang sóng EEG và soi đoạn này"
                              className="text-left hover:underline cursor-pointer"
                            >
                              <span className="font-mono font-bold">
                                {ann.startSec.toFixed(1)}–{ann.endSec.toFixed(1)}s
                              </span>{' '}
                              <span className="text-[#575652]">
                                ({ann.channels?.join(', ') || 'Toàn bộ'})
                              </span>
                              : <span className="font-medium">{ann.label}</span>
                            </button>
                            {ann.source === 'physician' && (
                              <button
                                type="button"
                                aria-label={`Xóa đánh dấu ${ann.label}`}
                                onClick={() => handleDeletePhysicianAnnotation(ann.id)}
                                className="text-[#6E6D68] hover:text-red-700 cursor-pointer"
                              >
                                <Trash2 className="size-3" aria-hidden />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Strict Separation: Read-only Automated Summary vs Physician Interpretation */}
                <div className="grid gap-4 lg:grid-cols-12 items-start">
                  {/* Left: Compact Read-Only Automated System Summary */}
                  <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5">
                      <span className="font-bold text-slate-800">
                        Tóm tắt tự động từ hệ thống (Chỉ đọc — Chưa xác thực)
                      </span>
                    </div>
                    <ul className="space-y-1.5 text-[11.5px] text-slate-700 list-disc pl-4">
                      <li>
                        <strong>
                          {derivedContext.aiSuppressedByQuality
                            ? 'Lỗi chất lượng kỹ thuật:'
                            : 'Quan sát mẫu:'}
                        </strong>{' '}
                        {derivedContext.patternPresentation.observation}
                      </li>
                      <li>
                        <strong>QEEG:</strong>{' '}
                        {derivedContext.aiSuppressedByQuality && !derivedContext.hasValidChannels ? (
                          <span className="font-mono text-amber-800 font-semibold">
                            N/A — Tín hiệu hỏng
                          </span>
                        ) : (
                          <>
                            DAR <span className="font-mono">{analysis.biomarkers.meanDar.toFixed(2)}</span> ·
                            BSI <span className="font-mono">{analysis.biomarkers.meanBsi.toFixed(3)}</span> ·
                            Alpha{' '}
                            <span className="font-mono">
                              {analysis.biomarkers.alphaPeakHz > 0
                                ? `${analysis.biomarkers.alphaPeakHz.toFixed(1)} Hz`
                                : 'N/A'}
                            </span>
                            {derivedContext.aiSuppressedByQuality && (
                              <span className="ml-1 font-semibold text-amber-800">(Không tin cậy)</span>
                            )}
                          </>
                        )}
                      </li>
                      <li className="text-slate-500">
                        Chỉ số hỗ trợ tính toán — Không phải chẩn đoán y khoa và không thay thế đánh giá bác sĩ.
                      </li>
                    </ul>
                  </div>

                  {/* Right: Physician-Confirmed Interpretation (Never pre-filled!) */}
                  <div className="lg:col-span-7 rounded-xl border border-[#16A34A]/60 bg-white p-3.5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE6DF] pb-1.5">
                      <span className="font-bold text-[#15803D]">
                        Nhận định chuyên môn của Bác sĩ (Physician-Confirmed Interpretation)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAdditionalReviewFields((v) => !v)}
                        className="text-[11px] font-semibold text-[#15803D] hover:underline cursor-pointer"
                      >
                        {showAdditionalReviewFields
                          ? 'Thu gọn ghi chú phụ'
                          : 'Thêm ghi chú nhiễu & Đề xuất theo dõi'}
                      </button>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="rev-bg-findings" className="font-semibold text-[#141413] block">
                        Nhận định lâm sàng &amp; Mô tả điện não
                      </label>
                      <Textarea
                        ref={reviewFindingsInputRef}
                        id="rev-bg-findings"
                        rows={3}
                        value={reviewState.backgroundAndFindings}
                        onChange={(e) => {
                          const next = {
                            ...reviewState,
                            backgroundAndFindings: e.target.value,
                            confirmedAt: null,
                          };
                          setReviewState(next);
                          persistReviewForCase(analysis.caseId, next);
                        }}
                        placeholder="Bác sĩ tự mô tả nhịp nền, đáp ứng Alpha, sóng chậm hoặc hoạt động bất thường..."
                        className="bg-white text-xs"
                      />
                    </div>

                    {showAdditionalReviewFields && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label htmlFor="rev-artifacts" className="font-semibold text-[#141413] block">
                            Đánh giá nhiễu &amp; giới hạn kỹ thuật (6 kênh)
                          </label>
                          <Textarea
                            id="rev-artifacts"
                            rows={2}
                            value={reviewState.artifactAndTechnicalLimits}
                            onChange={(e) => {
                              const next = {
                                ...reviewState,
                                artifactAndTechnicalLimits: e.target.value,
                                confirmedAt: null,
                              };
                              setReviewState(next);
                              persistReviewForCase(analysis.caseId, next);
                            }}
                            placeholder="Nhiễu EMG, 50 Hz, chớp mắt, thiếu kênh T3/T4/P3/P4..."
                            className="bg-white text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <label htmlFor="rev-conclusion" className="font-semibold text-[#141413] block">
                            Kết luận &amp; Đề xuất theo dõi
                          </label>
                          <Textarea
                            id="rev-conclusion"
                            rows={2}
                            value={reviewState.conclusionAndPlan}
                            onChange={(e) => {
                              const next = {
                                ...reviewState,
                                conclusionAndPlan: e.target.value,
                                confirmedAt: null,
                              };
                              setReviewState(next);
                              persistReviewForCase(analysis.caseId, next);
                            }}
                            placeholder="Đề xuất CT/MRI, EEG chuẩn 10–20 hoặc theo dõi tiếp theo..."
                            className="bg-white text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Final Action & Signature Bar */}
                <div className="pt-3 border-t border-[#DCE6DF] flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[11px] text-[#575652]">
                    <div>
                      <strong className="text-[#141413]">
                        {user?.displayName || 'BS. CKII Nguyễn Văn Minh'}
                      </strong>
                      {user?.username ? ` (@${user.username})` : ''}
                      {(derivedContext.isVerifiedReviewer || isProfessional) && (
                        <span className="ml-1.5 inline-flex items-center rounded bg-[#ECFDF3] border border-[#BBF7D0] px-1.5 py-0.5 text-[10px] font-semibold text-[#15803D]">
                          Chuyên gia đã xác minh
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[10.5px] text-[#6E6D68]">
                      {reviewState.confirmedAt
                        ? `Đã xác nhận lúc: ${new Date(reviewState.confirmedAt).toLocaleString('vi-VN')}`
                        : 'Chưa ký xác nhận'}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={handleConfirmPhysicianReview}
                      icon={<CheckCircle2 className="size-3.5" aria-hidden />}
                    >
                      Xác nhận nhận định
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleOpenSaveModal}
                      className="border-[#DCE6DF]"
                    >
                      {savedDatasetId ? 'Đã lưu ✓' : 'Lưu bản ghi'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleExportClinicalReport}
                      className="border-[#DCE6DF]"
                      icon={<FileDown className="size-3.5 text-[#15803D]" aria-hidden />}
                    >
                      Xuất báo cáo (In / PDF)
                    </Button>
                  </div>
                </div>
              </div>
            )}
            </section>
          )}

          {/* Subtle Sequential Step Navigation Footer (Single-Tab Mode) */}
          {!viewAllSections && (() => {
            const idx = CLINICAL_SECTION_TABS.findIndex((t) => t.id === activeSection);
            const prevTab = idx > 0 ? CLINICAL_SECTION_TABS[idx - 1] : null;
            const nextTab =
              idx >= 0 && idx < CLINICAL_SECTION_TABS.length - 1
                ? CLINICAL_SECTION_TABS[idx + 1]
                : null;
            return (
              <div className="rounded-xl border border-[#DCE6DF] bg-[#FAFDFB] px-3 py-2 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  {prevTab ? (
                    <button
                      type="button"
                      onClick={() => {
                        selectClinicalSection(prevTab.id, { forceSingleTab: true });
                        requestAnimationFrame(() => {
                          tabBarRef.current?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'nearest',
                          });
                        });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE6DF] bg-white hover:bg-[#F5FAF7] px-2.5 py-1 font-medium text-[#262624] transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="size-3.5 text-[#575652]" aria-hidden />
                      <span>Bước trước: {prevTab.label}</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-[#8A8882]">Đầu quy trình đọc</span>
                  )}
                </div>

                <span className="hidden sm:inline font-mono text-[11px] text-[#6E6D68]">
                  Mục {idx + 1} / {CLINICAL_SECTION_TABS.length}
                </span>

                <div className="min-w-0">
                  {nextTab ? (
                    <button
                      type="button"
                      onClick={() => {
                        selectClinicalSection(nextTab.id, { forceSingleTab: true });
                        requestAnimationFrame(() => {
                          tabBarRef.current?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'nearest',
                          });
                        });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#BBF7D0] bg-[#ECFDF3] hover:bg-[#DCFCE7] px-2.5 py-1 font-semibold text-[#15803D] transition-colors cursor-pointer"
                    >
                      <span>Bước tiếp theo: {nextTab.label}</span>
                      <ArrowRight className="size-3.5" aria-hidden />
                    </button>
                  ) : (
                    <span className="text-[11px] font-medium text-[#15803D]">
                      Hoàn tất 5 bước đọc
                    </span>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Sequential Pop-up Modal: Lưu bản ghi vào Hồ sơ */}
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
                  Kiểm tra thông tin ẩn danh và đồng bộ ghi chú nhận định trước khi lưu.
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
                    Ghi chú lâm sàng (đồng bộ từ nhận định Bác sĩ nếu đã xác nhận)
                  </label>
                  <Textarea
                    id="save-qeeg-note"
                    rows={2}
                    value={saveNote}
                    onChange={(e) => setSaveNote(e.target.value)}
                    placeholder="Nhập ghi chú bác sĩ hoặc tóm tắt lâm sàng..."
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
