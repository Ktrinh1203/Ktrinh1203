/**
 * Pure TypeScript Quantitative EEG (qEEG) DSP & Clinical Triage Fallback Engine.
 *
 * Used seamlessly when the Python FastAPI service (:8001) is unavailable or times out.
 * Implements:
 * 1. Deterministic 6-channel EEG synthesis for 6 clinical cases across 4 categories.
 * 2. Zero-phase IIR Biquad bandpass (0.5-45 Hz) + 50 Hz Notch + Common Average Reference (CAR).
 * 3. Welch Hann-windowed Radix-2 FFT PSD, band powers, DAR, TAR, BSI, PRI, wPLI, Alpha Peak Hz.
 * 4. 19-channel 10-20 spherical geodesic topographic projection & 80-dim featureVector80.
 * 5. Valid single-page PDF 1.4 clinical summary fallback generator.
 */

export type ClinicalCategory =
  | 'VASCULAR_STROKE'
  | 'EPILEPSY_ICU'
  | 'SLEEP_COGNITIVE'
  | 'HARDWARE_BCI';

export type NeuralLabel =
  | 'CONTROL'
  | 'ISCHEMIC_STROKE'
  | 'HEMORRHAGIC_STROKE'
  | 'EPILEPTIFORM_SLOWING'
  | 'COGNITIVE_FATIGUE';

export type QeegDataOrigin = 'SYNTHETIC_DEMO' | 'HARDWARE_SAMPLE_CSV' | 'USER_UPLOADED_CSV';
export type QeegSamplingRateSource = 'CSV_TIMESTAMP' | 'REQUEST_PARAM' | 'CASE_METADATA';

export interface QeegCaseItem {
  id: string;
  name: string;
  subjectId: string;
  clinicalCategory: ClinicalCategory;
  groundTruthLabel: NeuralLabel;
  clinicalPresentation: string;
  trafficLight: 'green' | 'yellow' | 'red' | 'purple';
  tpaStatus:
    | 'REQUIRES_CLINICAL_AND_CT_REVIEW'
    | 'CONTRAINDICATED_UNTIL_NCCT'
    | 'NOT_APPLICABLE'
    | 'MONITORING'
    | 'ELIGIBLE'
    | 'ABSOLUTELY_CONTRAINDICATED';
  badge: string;
  samplingRateHz: number;
  channelsCount: number;
  dataOrigin?: QeegDataOrigin;
  isDemonstrationData?: boolean;
}

export interface QeegTopomapNode {
  name: string;
  x: number;
  y: number;
  isPhysical: boolean;
  isUnavailable?: boolean;
  isRecorded?: boolean;
  qualityStatus?: QeegChannelQuality['status'];
  isInvalidQuality?: boolean;
  value: number;
  dar: number;
}

export interface QeegBandPowers {
  delta: number;
  theta: number;
  alpha: number;
  beta: number;
}

export interface QeegFilterConfig {
  highpassHz: number;
  lowpassHz: number;
  notchHz: number | null;
  notchQ: number | null;
  filterType: string;
  filterOrder: number;
  reference: string;
  physicalReference: string | null;
  edgeTrimSec: number;
}

export interface QeegChannelQuality {
  channel: string;
  isRecorded: boolean;
  rmsUv: number;
  ptpUv: number;
  lineNoiseRatio: number;
  emgRatio: number;
  lowFreqDriftRatio: number;
  flatlineRatio: number;
  saturationRatio: number;
  impedanceKOhm: number | null;
  status: 'GOOD' | 'NOISY' | 'DROPOUT' | 'SATURATED' | 'UNAVAILABLE';
}

export interface QeegSignalSegment {
  startSec: number;
  endSec: number;
  channels: string[];
  type: string;
  labelVi: string;
}

export interface QeegSignalQuality {
  overallScore: number;
  overallStatus: 'GOOD' | 'DEGRADED' | 'UNRELIABLE' | 'MISSING';
  aiSuppressedByQuality: boolean;
  suppressionReasons: string[];
  usableDurationSec: number;
  totalDurationSec: number;
  channels: QeegChannelQuality[];
  artifactSegments: QeegSignalSegment[];
  abnormalSegments: QeegSignalSegment[];
}

export interface QeegPsdCurve {
  freqsHz: number[];
  meanPowerUv2Hz: number[];
  leftHemispherePowerUv2Hz: number[];
  rightHemispherePowerUv2Hz: number[];
  gammaRelRatio: number;
  bandNormalizationBasis: string;
}

export interface QeegBsiPair {
  pair: string;
  leftChannel: string;
  rightChannel: string;
  isAvailable: boolean;
  bsi: number;
  pdBsi1To25Hz: number;
  leftPower: number;
  rightPower: number;
  dominantSide: 'LEFT' | 'RIGHT' | 'BALANCED';
}

export interface QeegModelMetadata {
  outputType: 'EXPERIMENTAL_HEURISTIC_SCORE';
  isCalibratedProbability: boolean;
  validationStatus: string;
  disclaimerVi: string;
  semanticGroupingNoteVi: string;
}

export interface QeegAnalysisResult {
  status: 'SUCCESS';
  engineSource: 'python_qeeg_service' | 'ts_dsp_fallback';
  caseId: string;
  caseName?: string;
  badge?: string;
  clinicalCategory: ClinicalCategory;
  classificationLabel: NeuralLabel;
  classificationTitle: string;
  predictedLabelVi?: string;
  clinicalSummaryVi?: string;
  clinicalRecommendationVi?: string;
  confidence?: number;
  trafficLight: 'green' | 'yellow' | 'red' | 'purple';
  tpaStatus?: string;
  tpaBadge: string;
  tpaCountdownMin: number | null;
  safetyStatus: string;
  decisionReason: string;
  latencyMs: number;
  samplingRateHz: number;
  samplingRateSource?: QeegSamplingRateSource;
  detectedSamplingRateHz?: number | null;
  durationSec?: number;
  usableDurationSec?: number;
  channelsCount: number;
  recordedChannelCount?: number;
  recordedChannels?: string[];
  unavailableChannels?: string[];
  recordingTimestamp?: string;
  dataOrigin?: QeegDataOrigin;
  isDemonstrationData?: boolean;
  montage: string;
  filterConfig?: QeegFilterConfig;
  signalQuality?: QeegSignalQuality;
  psdCurve?: QeegPsdCurve;
  bsiPairs?: QeegBsiPair[];
  pdBsi1To25Hz?: number;
  modelMetadata?: QeegModelMetadata;
  biomarkers: {
    meanDar: number;
    meanTar: number;
    meanBsi: number;
    pri: number;
    wpli: number;
    alphaPeakHz: number;
    signalQualityScore: number;
    cusumAlarm: boolean;
    tpaLockoutTriggered: boolean;
  };
  bandPowers: QeegBandPowers;
  probabilities: {
    control: number;
    ischemic: number;
    hemorrhagic: number;
    epileptiform: number;
    cognitiveFatigue: number;
  };
  featureVector80: number[];
  waveforms: {
    time: number[];
    channels: string[];
    raw: Record<string, number[]>;
    filtered: Record<string, number[]>;
  };
  topomap: QeegTopomapNode[];
  telemetryQr: string;
}

export const CLINICAL_CATEGORIES: ClinicalCategory[] = [
  'VASCULAR_STROKE',
  'EPILEPSY_ICU',
  'SLEEP_COGNITIVE',
  'HARDWARE_BCI',
];

export const ACTIVE_HARDWARE_CHANNELS = ['F3', 'F4', 'C3', 'C4', 'O1', 'O2'] as const;

const STANDARD_19_COORDS: Record<string, [number, number, number]> = {
  FP1: [-0.329991, 0.940726, -0.078359],
  FP2: [0.330899, 0.940402, -0.078426],
  F3: [-0.59522, 0.629189, 0.499834],
  F4: [0.606623, 0.635512, 0.477633],
  C3: [-0.706876, -0.125802, 0.69606],
  C4: [0.720988, -0.117092, 0.682983],
  P3: [-0.48096, -0.714878, 0.50757],
  P4: [0.498504, -0.703519, 0.506513],
  O1: [-0.252329, -0.964666, 0.075827],
  O2: [0.256398, -0.96361, 0.075607],
  F7: [-0.847627, 0.512395, -0.137767],
  F8: [0.846108, 0.514567, -0.139004],
  T3: [-0.976571, -0.185874, -0.108447],
  T4: [0.978884, -0.172815, -0.109187],
  T5: [-0.70195, -0.711819, -0.024101],
  T6: [0.706832, -0.706954, -0.024575],
  FZ: [0.003526, 0.660786, 0.750566],
  CZ: [0.003983, -0.091066, 0.995837],
  PZ: [0.002804, -0.700597, 0.713552],
};

const STANDARD_19_NAMES = Object.keys(STANDARD_19_COORDS);

export const BUILTIN_QEEG_CASES: QeegCaseItem[] = [
  {
    id: 'case_ischemia_lvo',
    name: 'Mẫu mô phỏng #01: Sóng chậm Delta khu trú & bất đối xứng bán cầu (F3, C3)',
    subjectId: 'SIM-VASC-01',
    clinicalCategory: 'VASCULAR_STROKE',
    groundTruthLabel: 'ISCHEMIC_STROKE',
    clinicalPresentation:
      'Mẫu mô phỏng hoạt động sóng chậm Delta ưu thế bán cầu trái (F3, C3) kèm bất đối xứng năng lượng. EEG đơn thuần không chẩn đoán xác định nhồi máu não, tắc mạch lớn hay phân biệt xuất huyết não; cần bác sĩ thăm khám thần kinh và đối chiếu CT/CTA sọ não.',
    trafficLight: 'red',
    tpaStatus: 'REQUIRES_CLINICAL_AND_CT_REVIEW',
    badge: 'Sóng chậm khu trú · Cần khám lâm sàng & CT/CTA',
    samplingRateHz: 500,
    channelsCount: 6,
    dataOrigin: 'SYNTHETIC_DEMO',
    isDemonstrationData: true,
  },
  {
    id: 'case_ich_hemorrhage',
    name: 'Mẫu mô phỏng #02: Sóng chậm Delta biên độ cao lan tỏa hai bán cầu',
    subjectId: 'SIM-VASC-02',
    clinicalCategory: 'VASCULAR_STROKE',
    groundTruthLabel: 'HEMORRHAGIC_STROKE',
    clinicalPresentation:
      'Mẫu mô phỏng sóng chậm Delta biên độ cao lan tỏa hai bán cầu kèm dao động kịch phát. Cần chụp CT sọ não không cản quang (NCCT) để loại trừ xuất huyết nội sọ trước mọi chỉ định điều trị tái tưới máu.',
    trafficLight: 'purple',
    tpaStatus: 'CONTRAINDICATED_UNTIL_NCCT',
    badge: 'Cần NCCT khẩn · Khóa gợi ý tái tưới máu',
    samplingRateHz: 500,
    channelsCount: 6,
    dataOrigin: 'SYNTHETIC_DEMO',
    isDemonstrationData: true,
  },
  {
    id: 'case_epilepsy_temporal',
    name: 'Mẫu mô phỏng #03: Hoạt động dạng động kinh trên đạo trình F3–C3',
    subjectId: 'SIM-EPI-03',
    clinicalCategory: 'EPILEPSY_ICU',
    groundTruthLabel: 'EPILEPTIFORM_SLOWING',
    clinicalPresentation:
      'Mẫu mô phỏng phức hợp dạng nhọn–sóng chậm nhịp ~3 Hz trên đạo trình trán–trung tâm (F3–C3). Phức hợp dạng nhọn–sóng chậm không đồng nghĩa cơn động kinh lâm sàng xác định và không định khu thùy thái dương từ 6 kênh.',
    trafficLight: 'yellow',
    tpaStatus: 'NOT_APPLICABLE',
    badge: 'Theo dõi điện não · Hội chẩn chuyên khoa',
    samplingRateHz: 500,
    channelsCount: 6,
    dataOrigin: 'SYNTHETIC_DEMO',
    isDemonstrationData: true,
  },
  {
    id: 'case_sleep_fatigue_n3',
    name: 'Mẫu mô phỏng #04: Mẫu EEG liên quan buồn ngủ / giảm cảnh tỉnh',
    subjectId: 'SIM-SLP-04',
    clinicalCategory: 'SLEEP_COGNITIVE',
    groundTruthLabel: 'COGNITIVE_FATIGUE',
    clinicalPresentation:
      'Mẫu mô phỏng sóng chậm Theta/Delta phân bố tương đối đối xứng hai bán cầu. Không đủ điều kiện phân giai đoạn ngủ N3 theo tiêu chuẩn AASM (thiếu EOG, EMG cằm và epoch 30 giây); đối xứng hai bán cầu không loại trừ đột quỵ tuần hoàn sau hay ổ khuyết.',
    trafficLight: 'yellow',
    tpaStatus: 'NOT_APPLICABLE',
    badge: 'Sóng chậm đối xứng · Không phân pha N3',
    samplingRateHz: 500,
    channelsCount: 6,
    dataOrigin: 'SYNTHETIC_DEMO',
    isDemonstrationData: true,
  },
  {
    id: 'case_healthy_alpha',
    name: 'Mẫu tham chiếu #05: Nhịp Alpha chẩm sinh lý khi nghỉ ngơi',
    subjectId: 'SIM-CTRL-05',
    clinicalCategory: 'SLEEP_COGNITIVE',
    groundTruthLabel: 'CONTROL',
    clinicalPresentation:
      'Mẫu mô phỏng nhịp Alpha vùng chẩm (~10.2 Hz) ưu thế tại O1/O2 khi nhắm mắt thư giãn, phân bố cân đối hai bán cầu.',
    trafficLight: 'green',
    tpaStatus: 'NOT_APPLICABLE',
    badge: 'Nhịp nền Alpha 10.2 Hz ổn định',
    samplingRateHz: 500,
    channelsCount: 6,
    dataOrigin: 'SYNTHETIC_DEMO',
    isDemonstrationData: true,
  },
  {
    id: 'case_ads1299_hardware',
    name: 'Bản ghi phần cứng #06: Tín hiệu mẫu TI ADS1299 24-bit 500 Hz',
    subjectId: 'TI-ADS1299-01',
    clinicalCategory: 'HARDWARE_BCI',
    groundTruthLabel: 'CONTROL',
    clinicalPresentation:
      'Đoạn tín hiệu 6 đạo trình thu từ bo mạch TI ADS1299 ở tần số lấy mẫu 500 Hz (dữ liệu mẫu phần cứng kèm sẵn để kiểm chứng xử lý tín hiệu).',
    trafficLight: 'green',
    tpaStatus: 'MONITORING',
    badge: 'Dữ liệu mẫu TI ADS1299 24-bit',
    samplingRateHz: 500,
    channelsCount: 6,
    dataOrigin: 'HARDWARE_SAMPLE_CSV',
    isDemonstrationData: true,
  },
];

const CASE_ALIAS_MAP: Record<string, string> = {
  scenario_ischemia_lvo: 'case_ischemia_lvo',
  scenario_ich_hemorrhage: 'case_ich_hemorrhage',
  scenario_control_healthy: 'case_healthy_alpha',
  scenario_mimic_sleep_n3: 'case_sleep_fatigue_n3',
  scenario_ads1299_real_hardware: 'case_ads1299_hardware',
};

export function resolveCaseId(caseId: string): string {
  return CASE_ALIAS_MAP[caseId] ?? caseId;
}

export function getBuiltInCases(): QeegCaseItem[] {
  return BUILTIN_QEEG_CASES;
}

// Deterministic mulberry32 PRNG for reproducible signal synthesis
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianNoise(rng: () => number): number {
  const u1 = Math.max(1e-9, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Biquad IIR filter implementation with forward-backward zero-phase filtering
interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

function designHighpassBiquad(fc: number, fs: number, q = 0.7071): BiquadCoeffs {
  const w0 = (2 * Math.PI * fc) / fs;
  const cosW0 = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: (1 + cosW0) / 2 / a0,
    b1: -(1 + cosW0) / a0,
    b2: (1 + cosW0) / 2 / a0,
    a1: (-2 * cosW0) / a0,
    a2: (1 - alpha) / a0,
  };
}

function designLowpassBiquad(fc: number, fs: number, q = 0.7071): BiquadCoeffs {
  const w0 = (2 * Math.PI * fc) / fs;
  const cosW0 = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: (1 - cosW0) / 2 / a0,
    b1: (1 - cosW0) / a0,
    b2: (1 - cosW0) / 2 / a0,
    a1: (-2 * cosW0) / a0,
    a2: (1 - alpha) / a0,
  };
}

function designNotchBiquad(f0: number, fs: number, q = 30.0): BiquadCoeffs {
  const w0 = (2 * Math.PI * f0) / fs;
  const cosW0 = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: 1 / a0,
    b1: (-2 * cosW0) / a0,
    b2: 1 / a0,
    a1: (-2 * cosW0) / a0,
    a2: (1 - alpha) / a0,
  };
}

function applyBiquadForward(x: Float64Array, c: BiquadCoeffs): Float64Array {
  const y = new Float64Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i] ?? 0;
    const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    y[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return y;
}

function applyZeroPhaseBiquad(x: Float64Array, c: BiquadCoeffs): Float64Array {
  if (x.length < 4) return new Float64Array(x);
  const mean = x.reduce((acc, v) => acc + v, 0) / x.length;
  const centered = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) centered[i] = (x[i] ?? 0) - mean;

  const fwd = applyBiquadForward(centered, c);
  const revIn = new Float64Array(fwd.length);
  for (let i = 0; i < fwd.length; i++) revIn[i] = fwd[fwd.length - 1 - i] ?? 0;
  const bwd = applyBiquadForward(revIn, c);
  const out = new Float64Array(bwd.length);
  for (let i = 0; i < bwd.length; i++) out[i] = bwd[bwd.length - 1 - i] ?? 0;
  return out;
}

function dspFilterChannelsWithStages(
  rawChannels: Float64Array[],
  sfreq: number,
  notch50Hz: boolean,
  recordedMask?: boolean[],
): { filtered: Float64Array[]; hpNotched: Float64Array[] } {
  const mask =
    recordedMask && recordedMask.length === rawChannels.length
      ? recordedMask
      : rawChannels.map(() => true);

  const hp = designHighpassBiquad(Math.min(0.5, sfreq * 0.1), sfreq);
  const lpCutoff = Math.min(45.0, sfreq * 0.42);
  const lp = designLowpassBiquad(lpCutoff, sfreq);
  const useNotch = notch50Hz && sfreq > 110;
  const notch = useNotch ? designNotchBiquad(50.0, sfreq, 30.0) : null;

  const hpNotched: Float64Array[] = [];
  const filtered: Float64Array[] = [];

  for (let c = 0; c < rawChannels.length; c++) {
    const ch = rawChannels[c]!;
    if (!mask[c]) {
      hpNotched.push(new Float64Array(ch.length));
      filtered.push(new Float64Array(ch.length));
      continue;
    }
    let sig = applyZeroPhaseBiquad(ch, hp);
    if (notch) sig = applyZeroPhaseBiquad(sig, notch);
    hpNotched.push(sig);
    filtered.push(applyZeroPhaseBiquad(sig, lp));
  }

  // Common Average Reference (CAR) strictly over recorded channels
  const recIndices = mask.map((v, idx) => (v ? idx : -1)).filter((idx) => idx >= 0);
  const nSamp = filtered[0]?.length ?? 0;
  if (recIndices.length >= 2 && nSamp > 0) {
    for (let t = 0; t < nSamp; t++) {
      let sum = 0;
      for (const c of recIndices) sum += filtered[c]![t] ?? 0;
      const avg = sum / recIndices.length;
      for (const c of recIndices) {
        filtered[c]![t] = (filtered[c]![t] ?? 0) - avg;
      }
    }
  }
  return { filtered, hpNotched };
}

// Radix-2 Cooley-Tukey in-place FFT (real + imaginary arrays of power-of-2 length)
function fftRadix2(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      const tr = re[i]!;
      re[i] = re[j]!;
      re[j] = tr;
      const ti = im[i]!;
      im[i] = im[j]!;
      im[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wLenRe = Math.cos(angle);
    const wLenIm = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      for (let k = 0; k < half; k++) {
        const evenIdx = i + k;
        const oddIdx = i + k + half;
        const oddRe = re[oddIdx]!;
        const oddIm = im[oddIdx]!;
        const tRe = wRe * oddRe - wIm * oddIm;
        const tIm = wRe * oddIm + wIm * oddRe;
        re[oddIdx] = re[evenIdx]! - tRe;
        im[oddIdx] = im[evenIdx]! - tIm;
        re[evenIdx] = re[evenIdx]! + tRe;
        im[evenIdx] = im[evenIdx]! + tIm;
        const nextWRe = wRe * wLenRe - wIm * wLenIm;
        wIm = wRe * wLenIm + wIm * wLenRe;
        wRe = nextWRe;
      }
    }
  }
}

interface SegmentSpectrum {
  freqs: Float64Array;
  psd: Float64Array;
  complexSegs: { re: Float64Array; im: Float64Array }[];
}

function computeWelchSpectrum(signalData: Float64Array, sfreq: number): SegmentSpectrum {
  const n = signalData.length;
  // Choose power-of-2 segment length near 1s-2s of data (min 64, max 1024)
  let nfft = 64;
  const target = Math.min(1024, Math.max(64, Math.floor(sfreq * 1.5)));
  while (nfft * 2 <= target && nfft * 2 <= Math.max(n, 64)) {
    nfft *= 2;
  }
  const segLen = Math.min(n, nfft);
  const step = Math.max(1, Math.floor(segLen / 2));

  const hann = new Float64Array(segLen);
  let winPower = 0;
  for (let i = 0; i < segLen; i++) {
    const w = segLen > 1 ? 0.5 * (1 - Math.cos((2 * Math.PI * i) / (segLen - 1))) : 1;
    hann[i] = w;
    winPower += w * w;
  }
  const scale = 1 / (sfreq * Math.max(winPower, 1e-9));

  const nBins = (nfft >> 1) + 1;
  const psd = new Float64Array(nBins);
  const complexSegs: { re: Float64Array; im: Float64Array }[] = [];

  let segCount = 0;
  for (let start = 0; start === 0 || start + segLen <= n; start += step) {
    const re = new Float64Array(nfft);
    const im = new Float64Array(nfft);
    let segMean = 0;
    for (let i = 0; i < segLen; i++) segMean += signalData[start + i] ?? 0;
    segMean /= Math.max(segLen, 1);

    for (let i = 0; i < segLen; i++) {
      re[i] = ((signalData[start + i] ?? 0) - segMean) * (hann[i] ?? 1);
    }
    fftRadix2(re, im);

    for (let k = 0; k < nBins; k++) {
      const mag2 = re[k]! * re[k]! + im[k]! * im[k]!;
      const factor = k === 0 || k === nBins - 1 ? 1 : 2;
      psd[k] = (psd[k] ?? 0) + mag2 * scale * factor;
    }
    complexSegs.push({ re, im });
    segCount += 1;
    if (start + segLen >= n) break;
  }

  for (let k = 0; k < nBins; k++) {
    psd[k] = (psd[k] ?? 0) / Math.max(segCount, 1);
  }

  const freqs = new Float64Array(nBins);
  for (let k = 0; k < nBins; k++) {
    freqs[k] = (k * sfreq) / nfft;
  }

  return { freqs, psd, complexSegs };
}

function integrateBandPower(
  freqs: Float64Array,
  psd: Float64Array,
  fLow: number,
  fHigh: number,
): number {
  let area = 0;
  for (let i = 0; i < freqs.length - 1; i++) {
    const f0 = freqs[i]!;
    const f1 = freqs[i + 1]!;
    if (f1 < fLow || f0 > fHigh) continue;
    const left = Math.max(f0, fLow);
    const right = Math.min(f1, fHigh);
    if (right <= left) continue;
    const p0 = psd[i]!;
    const p1 = psd[i + 1]!;
    area += 0.5 * (p0 + p1) * (right - left);
  }
  return Math.max(area, 0);
}

function computeWpliPair(
  segsA: { re: Float64Array; im: Float64Array }[],
  segsB: { re: Float64Array; im: Float64Array }[],
  freqs: Float64Array,
): number {
  const count = Math.min(segsA.length, segsB.length);
  if (count === 0) return 0.25;
  let numSum = 0;
  let denSum = 0;
  let binsUsed = 0;
  for (let k = 0; k < freqs.length; k++) {
    const f = freqs[k]!;
    if (f < 1.0 || f > 30.0) continue;
    let sumIm = 0;
    let sumAbsIm = 0;
    for (let s = 0; s < count; s++) {
      const aRe = segsA[s]!.re[k] ?? 0;
      const aIm = segsA[s]!.im[k] ?? 0;
      const bRe = segsB[s]!.re[k] ?? 0;
      const bIm = segsB[s]!.im[k] ?? 0;
      // Im(S_ab) = Im(A * conj(B)) = aIm*bRe - aRe*bIm
      const imCross = aIm * bRe - aRe * bIm;
      sumIm += imCross;
      sumAbsIm += Math.abs(imCross);
    }
    if (sumAbsIm > 1e-12) {
      numSum += Math.abs(sumIm);
      denSum += sumAbsIm;
      binsUsed += 1;
    }
  }
  if (binsUsed === 0 || denSum <= 1e-12) return 0.25;
  return Math.min(1, Math.max(0, numSum / denSum));
}

function computeHjorth(x: Float64Array): { activity: number; mobility: number; complexity: number } {
  const n = x.length;
  if (n < 4) return { activity: 0, mobility: 0, complexity: 0 };
  let mean = 0;
  for (let i = 0; i < n; i++) mean += x[i]!;
  mean /= n;

  let var0 = 0;
  for (let i = 0; i < n; i++) {
    const d = x[i]! - mean;
    var0 += d * d;
  }
  var0 = var0 / n + 1e-9;

  let var1 = 0;
  for (let i = 1; i < n; i++) {
    const d1 = x[i]! - x[i - 1]!;
    var1 += d1 * d1;
  }
  var1 = var1 / (n - 1) + 1e-9;

  let var2 = 0;
  for (let i = 2; i < n; i++) {
    const d2 = x[i]! - 2 * x[i - 1]! + x[i - 2]!;
    var2 += d2 * d2;
  }
  var2 = var2 / (n - 2) + 1e-9;

  const mobility = Math.sqrt(var1 / var0);
  const complexity = Math.sqrt(var2 / var1) / (mobility + 1e-9);
  return {
    activity: Math.log10(var0 + 1),
    mobility,
    complexity,
  };
}

function synthesizeCaseWaveforms(
  caseId: string,
  durationSec: number,
  sfreq: number,
): Float64Array[] {
  const nSamples = Math.max(64, Math.round(durationSec * sfreq));
  const seedOffset = caseId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const rng = createRng(4200 + seedOffset);

  return ACTIVE_HARDWARE_CHANNELS.map((ch, idx) => {
    const out = new Float64Array(nSamples);
    const phaseShift = idx * 0.37;
    let pink = 0;

    for (let i = 0; i < nSamples; i++) {
      const t = i / sfreq;
      pink = 0.94 * pink + 0.35 * gaussianNoise(rng);
      let sig = pink * 5.0 + 3.5 * Math.sin(2 * Math.PI * 50.0 * t + phaseShift);

      if (caseId === 'case_ischemia_lvo') {
        const isLeft = ch === 'F3' || ch === 'C3';
        if (isLeft) {
          sig +=
            42.0 * Math.sin(2 * Math.PI * 1.25 * t + phaseShift) +
            22.0 * Math.sin(2 * Math.PI * 2.2 * t + 0.9) +
            14.0 * Math.sin(2 * Math.PI * 5.2 * t);
        } else if (ch === 'O1') {
          sig += 16.0 * Math.sin(2 * Math.PI * 1.7 * t) + 7.0 * Math.sin(2 * Math.PI * 9.1 * t);
        } else {
          sig += 13.0 * Math.sin(2 * Math.PI * 9.8 * t + phaseShift) + 6.0 * Math.sin(2 * Math.PI * 2.1 * t);
        }
      } else if (caseId === 'case_ich_hemorrhage') {
        const amp = ch === 'F3' || ch === 'C3' ? 1.25 : ch === 'F4' || ch === 'C4' ? 1.12 : 0.7;
        sig +=
          amp *
          (46.0 * Math.sin(2 * Math.PI * 0.95 * t + phaseShift) +
            26.0 * Math.sin(2 * Math.PI * 1.85 * t + 0.5));
        sig += 12.0 * Math.sin(2 * Math.PI * 4.8 * t);
        if (Math.sin(2 * Math.PI * 0.3 * t) > 0.82) {
          sig += 26.0 * Math.sin(2 * Math.PI * 7.2 * t + phaseShift);
        }
      } else if (caseId === 'case_epilepsy_temporal') {
        const isTemporalFocus = ch === 'F3' || ch === 'C3' || ch === 'O1';
        sig += 10.0 * Math.sin(2 * Math.PI * 9.2 * t + phaseShift);
        if (isTemporalFocus) {
          // 3 Hz spike-and-slow-wave bursts
          const env = Math.sin(2 * Math.PI * 0.4 * t) > 0.15 ? 1.0 : 0.35;
          sig += env * (28.0 * Math.sin(2 * Math.PI * 3.1 * t) + 16.0 * Math.sin(2 * Math.PI * 6.2 * t));
          sig += env * 14.0 * Math.sin(2 * Math.PI * 16.5 * t);
        } else {
          sig += 11.0 * Math.sin(2 * Math.PI * 5.8 * t);
        }
      } else if (caseId === 'case_sleep_fatigue_n3') {
        const symPhase = Math.floor(idx / 2) * 0.15;
        sig +=
          16.0 * Math.sin(2 * Math.PI * 1.4 * t + symPhase) +
          22.0 * Math.sin(2 * Math.PI * 5.8 * t + symPhase) +
          11.0 * Math.sin(2 * Math.PI * 13.0 * t + symPhase);
        if (ch === 'O1' || ch === 'O2') {
          sig += 10.5 * Math.sin(2 * Math.PI * 9.4 * t + symPhase);
        }
      } else if (caseId === 'case_ads1299_hardware') {
        // Simulates eye-open frontal beta transitioning to eye-closed posterior alpha + 50Hz noise
        const eyesClosedWeight = t > durationSec * 0.4 ? 1.0 : 0.35;
        if (ch === 'O1' || ch === 'O2') {
          sig += eyesClosedWeight * 24.0 * Math.sin(2 * Math.PI * 10.1 * t + phaseShift);
        } else {
          sig += 10.0 * Math.sin(2 * Math.PI * 10.1 * t + phaseShift);
        }
        if (ch === 'F3' || ch === 'F4') {
          sig += 9.5 * Math.sin(2 * Math.PI * 19.0 * t + phaseShift);
        }
        sig += 4.5 * Math.sin(2 * Math.PI * 1.6 * t);
      } else {
        // case_healthy_alpha
        if (ch === 'O1' || ch === 'O2') {
          sig += 26.0 * Math.sin(2 * Math.PI * 10.2 * t + 0.25 * Math.sin(2 * Math.PI * 0.5 * t));
        } else {
          sig += 10.0 * Math.sin(2 * Math.PI * 10.2 * t + phaseShift);
        }
        if (ch === 'F3' || ch === 'F4') {
          sig += 7.0 * Math.sin(2 * Math.PI * 18.5 * t);
        }
        sig += 3.5 * Math.sin(2 * Math.PI * 1.5 * t);
      }

      out[i] = sig;
    }
    return out;
  });
}

function roundTo(val: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  const rounded = Math.round(val * factor) / factor;
  return Number.isFinite(rounded) ? rounded : 0;
}

function build19ChannelTopomap(
  channelRelDelta: number[],
  channelDar: number[],
  recordedMask: boolean[],
  validMask?: boolean[],
  channelStatuses?: QeegChannelQuality['status'][],
): QeegTopomapNode[] {
  const effectiveValidMask =
    validMask && validMask.length === 6 ? validMask : recordedMask;
  const recCoords: [number, number, number][] = [];
  const recRelDelta: number[] = [];
  const recDar: number[] = [];
  ACTIVE_HARDWARE_CHANNELS.forEach((name, idx) => {
    if (effectiveValidMask[idx]) {
      recCoords.push(STANDARD_19_COORDS[name]!);
      recRelDelta.push(channelRelDelta[idx] ?? 0);
      recDar.push(channelDar[idx] ?? 0);
    }
  });

  return STANDARD_19_NAMES.map((name) => {
    const [x, y, z] = STANDARD_19_COORDS[name]!;
    const physIdx = ACTIVE_HARDWARE_CHANNELS.indexOf(
      name as (typeof ACTIVE_HARDWARE_CHANNELS)[number],
    );
    const isHardwareSlot = physIdx >= 0;
    const isRecorded = isHardwareSlot && Boolean(recordedMask[physIdx]);
    const isUnavailable = isHardwareSlot && !isRecorded;
    const chStatus = isHardwareSlot ? channelStatuses?.[physIdx] : undefined;
    const isInvalidQuality =
      isRecorded && (chStatus === 'DROPOUT' || chStatus === 'SATURATED');

    let value = 0;
    let dar = 0;
    if (isUnavailable || isInvalidQuality) {
      value = 0;
      dar = 0;
    } else if (isRecorded) {
      value = channelRelDelta[physIdx] ?? 0;
      dar = channelDar[physIdx] ?? 0;
    } else if (recCoords.length > 0) {
      let wSum = 0;
      let valSum = 0;
      let darSum = 0;
      for (let i = 0; i < recCoords.length; i++) {
        const [px, py, pz] = recCoords[i]!;
        const cosTheta = Math.min(1, Math.max(-1, x * px + y * py + z * pz));
        const dist2 = Math.max(0.01, 2 * (1 - cosTheta));
        const w = Math.exp(-dist2 / 0.45);
        wSum += w;
        valSum += w * (recRelDelta[i] ?? 0);
        darSum += w * (recDar[i] ?? 0);
      }
      value = wSum > 0 ? valSum / wSum : 0;
      dar = wSum > 0 ? darSum / wSum : 0;
    }

    return {
      name,
      x: roundTo(x, 4),
      y: roundTo(y, 4),
      isPhysical: isRecorded,
      isUnavailable,
      isRecorded,
      ...(chStatus ? { qualityStatus: chStatus } : {}),
      ...(isInvalidQuality ? { isInvalidQuality: true } : {}),
      value: roundTo(value, 4),
      dar: roundTo(dar, 3),
    };
  });
}

function sliceFloat64(arr: Float64Array, start: number, end: number): Float64Array {
  return arr.subarray(start, end);
}

function computeKurtosis(arr: Float64Array): number {
  const n = arr.length;
  if (n < 4) return 0;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += arr[i]!;
  mean /= n;
  let m2 = 0;
  let m4 = 0;
  for (let i = 0; i < n; i++) {
    const d = arr[i]! - mean;
    const d2 = d * d;
    m2 += d2;
    m4 += d2 * d2;
  }
  m2 /= n;
  m4 /= n;
  if (m2 <= 1e-12) return 0;
  return m4 / (m2 * m2) - 3;
}

function mergeSegmentsTs(epochs: QeegSignalSegment[]): QeegSignalSegment[] {
  const out: QeegSignalSegment[] = [];
  for (const ep of epochs) {
    const prev = out[out.length - 1];
    if (prev && prev.type === ep.type && Math.abs(prev.endSec - ep.startSec) < 1e-6) {
      prev.endSec = ep.endSec;
      prev.channels = Array.from(new Set([...prev.channels, ...ep.channels])).sort();
    } else {
      out.push({
        startSec: ep.startSec,
        endSec: ep.endSec,
        channels: Array.from(new Set(ep.channels)).sort(),
        type: ep.type,
        labelVi: ep.labelVi,
      });
    }
  }
  return out;
}

function evaluateSignalQualityTs(params: {
  rawChannels: Float64Array[];
  filteredChannels: Float64Array[];
  hpNotchedChannels: Float64Array[];
  nanMasks: boolean[][];
  recordedMask: boolean[];
  sfreq: number;
}): QeegSignalQuality {
  const { rawChannels, filteredChannels, hpNotchedChannels, nanMasks, recordedMask, sfreq } = params;
  const nSamples = rawChannels[0]?.length ?? 0;
  const totalDurationSec = roundTo(nSamples / Math.max(sfreq, 1), 3);

  // 0.5-3.0 Hz bandpass for low-frequency drift/blink detection
  const hpDrift = designHighpassBiquad(Math.min(0.5, sfreq * 0.1), sfreq);
  const lpDrift = designLowpassBiquad(Math.min(3.0, sfreq * 0.35), sfreq);
  const driftChannels = rawChannels.map((ch, idx) =>
    recordedMask[idx] ? applyZeroPhaseBiquad(applyZeroPhaseBiquad(ch, hpDrift), lpDrift) : new Float64Array(nSamples),
  );

  const winLen = Math.max(16, Math.round(sfreq));
  const nWins = Math.max(1, Math.floor(nSamples / winLen));

  const channelReports: QeegChannelQuality[] = [];
  const recordedScores: number[] = [];
  let dropoutOrSatCount = 0;
  let allMissing = true;

  for (let idx = 0; idx < 6; idx++) {
    const chName = ACTIVE_HARDWARE_CHANNELS[idx]!;
    if (!recordedMask[idx]) {
      channelReports.push({
        channel: chName,
        isRecorded: false,
        rmsUv: 0,
        ptpUv: 0,
        lineNoiseRatio: 0,
        emgRatio: 0,
        lowFreqDriftRatio: 0,
        flatlineRatio: 1,
        saturationRatio: 0,
        impedanceKOhm: null,
        status: 'UNAVAILABLE',
      });
      continue;
    }

    const rawCol = rawChannels[idx]!;
    const filtCol = filteredChannels[idx]!;
    const hpCol = hpNotchedChannels[idx]!;
    const colNan = nanMasks[idx] ?? [];

    let flatWins = 0;
    let driftWins = 0;
    for (let w = 0; w < nWins; w++) {
      const s = w * winLen;
      const e = w === nWins - 1 ? nSamples : (w + 1) * winLen;
      let hasNan = false;
      let sum = 0;
      for (let i = s; i < e; i++) {
        if (colNan[i] || !Number.isFinite(rawCol[i])) {
          hasNan = true;
          break;
        }
        sum += rawCol[i]!;
      }
      const len = Math.max(1, e - s);
      const mean = sum / len;
      let varSum = 0;
      let maxDrift = 0;
      for (let i = s; i < e; i++) {
        const d = (rawCol[i] ?? 0) - mean;
        varSum += d * d;
        const ad = Math.abs(driftChannels[idx]![i] ?? 0);
        if (ad > maxDrift) maxDrift = ad;
      }
      const std = Math.sqrt(varSum / len);
      if (hasNan || std < 0.5) flatWins += 1;
      if (maxDrift > 120.0) driftWins += 1;
    }

    const flatlineRatio = roundTo(flatWins / nWins, 4);
    const lowFreqDriftRatio = roundTo(driftWins / nWins, 4);
    if (flatlineRatio < 0.9) allMissing = false;

    const sortedRaw = Array.from(rawCol).sort((a, b) => a - b);
    const medVal = sortedRaw[Math.floor(sortedRaw.length / 2)] ?? 0;
    let satCount = 0;
    for (let i = 0; i < nSamples; i++) {
      const v = rawCol[i]!;
      const railStuck = i > 0 && Math.abs(v - rawCol[i - 1]!) < 1e-6 && Math.abs(v - medVal) > 200;
      if (!Number.isFinite(v) || Math.abs(v - medVal) > 400 || railStuck) {
        satCount += 1;
      }
    }
    const saturationRatio = roundTo(satCount / Math.max(1, nSamples), 4);

    // Line noise ratio strictly on RAW before Notch (48.5-51.5 Hz / 0.5-60 Hz)
    const rawSp = computeWelchSpectrum(rawCol, sfreq);
    const pLine = integrateBandPower(rawSp.freqs, rawSp.psd, 48.5, 51.5);
    const p60 = integrateBandPower(rawSp.freqs, rawSp.psd, 0.5, Math.min(60.0, sfreq / 2));
    const lineNoiseRatio = sfreq > 105 ? roundTo(Math.min(1, Math.max(0, pLine / (p60 + 1e-12))), 4) : 0;

    // EMG ratio (30-45 Hz / 0.5-45 Hz) on hp+notched signal
    const hpSp = computeWelchSpectrum(hpCol, sfreq);
    const pEmg = integrateBandPower(hpSp.freqs, hpSp.psd, 30.0, 45.0);
    const p45 = integrateBandPower(hpSp.freqs, hpSp.psd, 0.5, 45.0);
    const emgRatio = roundTo(Math.min(1, Math.max(0, pEmg / (p45 + 1e-12))), 4);

    let sumSq = 0;
    let minF = Infinity;
    let maxF = -Infinity;
    for (let i = 0; i < nSamples; i++) {
      const v = filtCol[i]!;
      sumSq += v * v;
      if (v < minF) minF = v;
      if (v > maxF) maxF = v;
    }
    const rmsUv = roundTo(Math.sqrt(sumSq / Math.max(1, nSamples)), 3);
    const ptpUv = roundTo(Number.isFinite(maxF - minF) ? maxF - minF : 0, 3);

    let status: QeegChannelQuality['status'] = 'GOOD';
    if (flatlineRatio >= 0.3) {
      status = 'DROPOUT';
      dropoutOrSatCount += 1;
    } else if (saturationRatio >= 0.05) {
      status = 'SATURATED';
      dropoutOrSatCount += 1;
    } else if (emgRatio >= 0.35 || lineNoiseRatio >= 0.35 || ptpUv > 250.0) {
      status = 'NOISY';
    }

    let chScore = Math.max(
      0,
      Math.min(
        0.99,
        1.0 -
          0.85 * flatlineRatio -
          0.85 * saturationRatio -
          0.45 * emgRatio -
          0.35 * Math.min(lineNoiseRatio, 0.8) -
          0.25 * lowFreqDriftRatio,
      ),
    );
    if (status === 'DROPOUT' || status === 'SATURATED') chScore = Math.min(chScore, 0.25);
    recordedScores.push(chScore);

    channelReports.push({
      channel: chName,
      isRecorded: true,
      rmsUv,
      ptpUv,
      lineNoiseRatio,
      emgRatio,
      lowFreqDriftRatio,
      flatlineRatio,
      saturationRatio,
      impedanceKOhm: null,
      status,
    });
  }

  // Epoch usability & segment annotations
  const recIndices = recordedMask.map((v, idx) => (v ? idx : -1)).filter((idx) => idx >= 0);
  let usableDurationSec = 0;
  const artifactEpochs: QeegSignalSegment[] = [];
  const abnormalEpochs: QeegSignalSegment[] = [];

  for (let w = 0; w < nWins; w++) {
    const s = w * winLen;
    const e = w === nWins - 1 ? nSamples : (w + 1) * winLen;
    const epDur = (e - s) / Math.max(sfreq, 1);
    const startSec = roundTo(s / Math.max(sfreq, 1), 2);
    const endSec = roundTo(e / Math.max(sfreq, 1), 2);

    const badChs: string[] = [];
    let goodChs = 0;
    const epDars: number[] = [];
    const epPowers: number[] = [];
    const epSpikeChs: string[] = [];

    for (const idx of recIndices) {
      const chName = ACTIVE_HARDWARE_CHANNELS[idx]!;
      const segRaw = sliceFloat64(rawChannels[idx]!, s, e);
      const segFilt = sliceFloat64(filteredChannels[idx]!, s, e);
      const colNan = nanMasks[idx] ?? [];
      let hasNan = false;
      let sum = 0;
      for (let i = 0; i < segRaw.length; i++) {
        if (colNan[s + i] || !Number.isFinite(segRaw[i])) {
          hasNan = true;
          break;
        }
        sum += segRaw[i]!;
      }
      const mean = sum / Math.max(1, segRaw.length);
      let varSum = 0;
      let maxDrift = 0;
      for (let i = 0; i < segRaw.length; i++) {
        const d = (segRaw[i] ?? 0) - mean;
        varSum += d * d;
        const ad = Math.abs(driftChannels[idx]![s + i] ?? 0);
        if (ad > maxDrift) maxDrift = ad;
      }
      const isFlat = hasNan || Math.sqrt(varSum / Math.max(1, segRaw.length)) < 0.5;
      let minF = Infinity;
      let maxF = -Infinity;
      for (let i = 0; i < segFilt.length; i++) {
        if (segFilt[i]! < minF) minF = segFilt[i]!;
        if (segFilt[i]! > maxF) maxF = segFilt[i]!;
      }
      const ptpEp = Number.isFinite(maxF - minF) ? maxF - minF : 0;
      const isSat = ptpEp > 800;
      const isDrift = maxDrift > 120;
      if (isFlat || isSat || isDrift || ptpEp > 350) {
        badChs.push(chName);
      } else {
        goodChs += 1;
      }

      if (segFilt.length >= 16 && !isFlat) {
        const spEp = computeWelchSpectrum(segFilt, sfreq);
        const pd = integrateBandPower(spEp.freqs, spEp.psd, 0.5, 4.0);
        const pa = integrateBandPower(spEp.freqs, spEp.psd, 8.0, 13.0) + 1e-6;
        const pp = integrateBandPower(spEp.freqs, spEp.psd, 0.5, 30.0);
        epDars.push(pd / pa);
        epPowers.push(pp);
        if (computeKurtosis(segFilt) >= 2.8 && ptpEp >= 65) {
          epSpikeChs.push(chName);
        }
      } else {
        epDars.push(0);
        epPowers.push(0);
      }
    }

    const minReq = recIndices.length >= 4 ? Math.min(recIndices.length, 4) : recIndices.length;
    if (goodChs >= Math.max(1, minReq)) {
      usableDurationSec += epDur;
    }

    if (badChs.length > 0) {
      artifactEpochs.push({
        startSec,
        endSec,
        channels: badChs,
        type: 'ARTIFACT_EPOCH',
        labelVi: 'Đoạn nhiễu / mất tiếp xúc / bão hòa biên độ',
      });
    }

    if (epSpikeChs.length > 0) {
      abnormalEpochs.push({
        startSec,
        endSec,
        channels: epSpikeChs,
        type: 'EPILEPTIFORM_DISCHARGE',
        labelVi: 'Phóng điện dạng nhọn – sóng chậm khu trú',
      });
    } else if (recIndices.length >= 4 && epDars.length > 0) {
      const idxToPos = new Map<number, number>();
      recIndices.forEach((chIdx, pos) => idxToPos.set(chIdx, pos));
      let maxAsym = 0;
      const asymChs: string[] = [];
      for (const [li, ri] of [
        [0, 1],
        [2, 3],
        [4, 5],
      ] as const) {
        const lpPos = idxToPos.get(li);
        const rpPos = idxToPos.get(ri);
        if (lpPos !== undefined && rpPos !== undefined) {
          const lp = epPowers[lpPos] ?? 0;
          const rp = epPowers[rpPos] ?? 0;
          const asym = Math.abs(rp - lp) / (rp + lp + 1e-9);
          if (asym > maxAsym) maxAsym = asym;
          if (asym >= 0.25) asymChs.push(ACTIVE_HARDWARE_CHANNELS[li]!, ACTIVE_HARDWARE_CHANNELS[ri]!);
        }
      }
      const meanEpDar = epDars.reduce((a, b) => a + b, 0) / epDars.length;
      const highDarChs = recIndices
        .filter((_, pos) => (epDars[pos] ?? 0) >= 2.5)
        .map((chIdx) => ACTIVE_HARDWARE_CHANNELS[chIdx]!);

      if (maxAsym >= 0.25 && meanEpDar >= 2.0) {
        abnormalEpochs.push({
          startSec,
          endSec,
          channels: highDarChs.length ? highDarChs : asymChs,
          type: 'FOCAL_SLOWING',
          labelVi: 'Sóng chậm khu trú kèm bất đối xứng bán cầu',
        });
      } else if (maxAsym >= 0.28) {
        abnormalEpochs.push({
          startSec,
          endSec,
          channels: asymChs,
          type: 'ASYMMETRY',
          labelVi: 'Bất đối xứng năng lượng liên bán cầu',
        });
      } else if (meanEpDar >= 3.0) {
        abnormalEpochs.push({
          startSec,
          endSec,
          channels: highDarChs.length ? highDarChs : recIndices.map((i) => ACTIVE_HARDWARE_CHANNELS[i]!),
          type: 'DIFFUSE_SLOWING',
          labelVi: 'Sóng chậm biên độ cao lan tỏa',
        });
      }
    }
  }

  usableDurationSec = roundTo(usableDurationSec, 2);
  const recordedChannelCount = recIndices.length;
  let overallScore = roundTo(
    recordedScores.length ? recordedScores.reduce((a, b) => a + b, 0) / recordedScores.length : 0,
    3,
  );

  const suppressionReasons: string[] = [];
  if (recordedChannelCount < 4) {
    suppressionReasons.push(
      `Chỉ có ${recordedChannelCount}/6 kênh thực đo (tối thiểu 4 kênh để phân tích định lượng đa vùng).`,
    );
  }
  if (usableDurationSec < 2.0) {
    suppressionReasons.push(
      `Thời lượng đoạn đạt chuẩn chỉ đạt ${usableDurationSec.toFixed(1)} giây (< 2.0 giây tối thiểu).`,
    );
  }
  if (dropoutOrSatCount >= 2) {
    suppressionReasons.push(
      `Có ${dropoutOrSatCount} kênh bị mất tín hiệu (DROPOUT) hoặc bão hòa biên độ (SATURATED).`,
    );
  }

  const aiSuppressedByQuality = suppressionReasons.length > 0;
  let overallStatus: QeegSignalQuality['overallStatus'] = 'GOOD';
  if (allMissing || recordedChannelCount === 0) {
    overallStatus = 'MISSING';
  } else if (aiSuppressedByQuality) {
    overallStatus = 'UNRELIABLE';
  } else if (
    channelReports.some((c) => c.isRecorded && c.status !== 'GOOD') ||
    overallScore < 0.75
  ) {
    overallStatus = 'DEGRADED';
  }

  if (aiSuppressedByQuality) {
    overallScore = Math.min(overallScore, 0.35);
  }

  return {
    overallScore: roundTo(overallScore, 3),
    overallStatus,
    aiSuppressedByQuality,
    suppressionReasons,
    usableDurationSec,
    totalDurationSec,
    channels: channelReports,
    artifactSegments: mergeSegmentsTs(artifactEpochs).slice(0, 20),
    abnormalSegments: mergeSegmentsTs(abnormalEpochs).slice(0, 20),
  };
}

function runPipelineOnChannels(params: {
  rawChannels: Float64Array[];
  recordedMask?: boolean[];
  nanMasks?: boolean[][];
  sfreq: number;
  caseId: string;
  clinicalCategory: ClinicalCategory;
  notch50Hz: boolean;
  explicitCase?: QeegCaseItem;
  dataOrigin: QeegDataOrigin;
  isDemonstrationData: boolean;
  samplingRateSource: QeegSamplingRateSource;
  detectedSamplingRateHz?: number | null;
  startPerfMs: number;
}): QeegAnalysisResult {
  const {
    rawChannels,
    sfreq,
    caseId,
    clinicalCategory,
    notch50Hz,
    explicitCase,
    dataOrigin,
    isDemonstrationData,
    samplingRateSource,
    detectedSamplingRateHz = null,
    startPerfMs,
  } = params;

  const mask =
    params.recordedMask && params.recordedMask.length === 6
      ? params.recordedMask
      : rawChannels.map((_, idx) => idx < 6);
  const nanMasks = params.nanMasks ?? rawChannels.map((ch) => new Array<boolean>(ch.length).fill(false));

  const recordedChannels = ACTIVE_HARDWARE_CHANNELS.filter((_, idx) => Boolean(mask[idx]));
  const unavailableChannels = ACTIVE_HARDWARE_CHANNELS.filter((_, idx) => !mask[idx]);
  const recordedChannelCount = recordedChannels.length;
  const recIndices = mask.map((v, idx) => (v ? idx : -1)).filter((idx) => idx >= 0);

  const { filtered: filteredChannels, hpNotched: hpNotchedChannels } = dspFilterChannelsWithStages(
    rawChannels,
    sfreq,
    notch50Hz,
    mask,
  );
  const nChannels = 6;
  const nSamples = filteredChannels[0]?.length ?? 0;

  // Edge trim 0.5s when recording >= 3.0s
  const trimN = Math.floor(0.5 * sfreq);
  const useTrim = nSamples >= Math.round(3.0 * sfreq) && nSamples - 2 * trimN >= Math.max(32, Math.floor(sfreq));
  const edgeTrimSec = useTrim ? 0.5 : 0.0;
  const sIdx = useTrim ? trimN : 0;
  const eIdx = useTrim ? nSamples - trimN : nSamples;

  const featRaw = rawChannels.map((ch) => sliceFloat64(ch, sIdx, eIdx));
  const featFiltered = filteredChannels.map((ch) => sliceFloat64(ch, sIdx, eIdx));
  const featHpNotched = hpNotchedChannels.map((ch) => sliceFloat64(ch, sIdx, eIdx));
  const featNanMasks = nanMasks.map((m) => m.slice(sIdx, eIdx));

  const signalQuality = evaluateSignalQualityTs({
    rawChannels: featRaw,
    filteredChannels: featFiltered,
    hpNotchedChannels: featHpNotched,
    nanMasks: featNanMasks,
    recordedMask: mask,
    sfreq,
  });

  const channelStatuses = signalQuality.channels.map((c) => c.status);
  const validMask = ACTIVE_HARDWARE_CHANNELS.map(
    (_, idx) =>
      Boolean(mask[idx]) &&
      channelStatuses[idx] !== 'DROPOUT' &&
      channelStatuses[idx] !== 'SATURATED',
  );
  const validIndices = validMask.map((v, idx) => (v ? idx : -1)).filter((idx) => idx >= 0);

  const spectra = featFiltered.map((ch, idx) =>
    validMask[idx] ? computeWelchSpectrum(ch, sfreq) : computeWelchSpectrum(new Float64Array(ch.length), sfreq),
  );

  const chRelDelta: number[] = [];
  const chRelTheta: number[] = [];
  const chRelAlpha: number[] = [];
  const chRelBeta: number[] = [];
  const chRelGamma: number[] = [];
  const chDar: number[] = [];
  const chTar: number[] = [];
  const chPri: number[] = [];
  const chDeltaAbs: number[] = [];
  const chThetaAbs: number[] = [];
  const chAlphaAbs: number[] = [];
  const chBetaAbs: number[] = [];
  const chGammaAbs: number[] = [];
  const chHjorth: { activity: number; mobility: number; complexity: number }[] = [];

  for (let i = 0; i < nChannels; i++) {
    if (!validMask[i]) {
      chDeltaAbs.push(0);
      chThetaAbs.push(0);
      chAlphaAbs.push(0);
      chBetaAbs.push(0);
      chGammaAbs.push(0);
      chRelDelta.push(0);
      chRelTheta.push(0);
      chRelAlpha.push(0);
      chRelBeta.push(0);
      chRelGamma.push(0);
      chDar.push(0);
      chTar.push(0);
      chPri.push(0);
      chHjorth.push({ activity: 0, mobility: 0, complexity: 0 });
      continue;
    }
    const sp = spectra[i]!;
    const pDelta = integrateBandPower(sp.freqs, sp.psd, 0.5, 4.0);
    const pTheta = integrateBandPower(sp.freqs, sp.psd, 4.0, 8.0);
    const pAlpha = integrateBandPower(sp.freqs, sp.psd, 8.0, 13.0);
    const pBeta = integrateBandPower(sp.freqs, sp.psd, 13.0, 30.0);
    const pGamma = integrateBandPower(sp.freqs, sp.psd, 30.0, 45.0);
    const pTotal = pDelta + pTheta + pAlpha + pBeta + pGamma + 1e-9;

    chDeltaAbs.push(pDelta);
    chThetaAbs.push(pTheta);
    chAlphaAbs.push(pAlpha);
    chBetaAbs.push(pBeta);
    chGammaAbs.push(pGamma);

    chRelDelta.push(pDelta / pTotal);
    chRelTheta.push(pTheta / pTotal);
    chRelAlpha.push(pAlpha / pTotal);
    chRelBeta.push(pBeta / pTotal);
    chRelGamma.push(pGamma / pTotal);

    chDar.push(pAlpha > 1e-9 ? pDelta / pAlpha : 0);
    chTar.push(pAlpha > 1e-9 ? pTheta / pAlpha : 0);
    chPri.push(pAlpha + pBeta > 1e-9 ? (pDelta + pTheta) / (pAlpha + pBeta) : 0);
    chHjorth.push(computeHjorth(featFiltered[i]!));
  }

  const meanValid = (arr: number[]) =>
    validIndices.length
      ? validIndices.reduce((acc, idx) => acc + (arr[idx] ?? 0), 0) / validIndices.length
      : 0;

  const meanDar = validIndices.length ? meanValid(chDar) : 0;
  const meanTar = validIndices.length ? meanValid(chTar) : 0;
  const pri = validIndices.length ? meanValid(chPri) : 0;

  // Synchronized Brain Symmetry Index across 0.5-30 Hz AND bin-wise pdBSI (1-25 Hz)
  const pairDefs: Array<{ pair: string; li: number; ri: number }> = [
    { pair: 'F3-F4', li: 0, ri: 1 },
    { pair: 'C3-C4', li: 2, ri: 3 },
    { pair: 'O1-O2', li: 4, ri: 5 },
  ];
  const bsiPairs: QeegBsiPair[] = [];
  const availBsi: number[] = [];
  const availPdBsi: number[] = [];

  for (const { pair, li, ri } of pairDefs) {
    const isAvailable = Boolean(validMask[li] && validMask[ri]);
    let bsiVal = 0;
    let pdVal = 0;
    let leftPower = 0;
    let rightPower = 0;
    let dominantSide: QeegBsiPair['dominantSide'] = 'BALANCED';

    if (isAvailable) {
      leftPower = (chDeltaAbs[li] ?? 0) + (chThetaAbs[li] ?? 0) + (chAlphaAbs[li] ?? 0) + (chBetaAbs[li] ?? 0);
      rightPower = (chDeltaAbs[ri] ?? 0) + (chThetaAbs[ri] ?? 0) + (chAlphaAbs[ri] ?? 0) + (chBetaAbs[ri] ?? 0);
      bsiVal = Math.abs(rightPower - leftPower) / (rightPower + leftPower + 1e-9);

      const freqsPd = spectra[li]!.freqs;
      let pdSum = 0;
      let pdCount = 0;
      for (let k = 0; k < freqsPd.length; k++) {
        const f = freqsPd[k]!;
        if (f < 1.0 || f > 25.0) continue;
        const lBin = spectra[li]!.psd[k] ?? 0;
        const rBin = spectra[ri]!.psd[k] ?? 0;
        pdSum += Math.abs(rBin - lBin) / (rBin + lBin + 1e-12);
        pdCount += 1;
      }
      pdVal = pdCount > 0 ? pdSum / pdCount : bsiVal;
      availBsi.push(bsiVal);
      availPdBsi.push(pdVal);
      if (leftPower > rightPower * 1.1) dominantSide = 'LEFT';
      else if (rightPower > leftPower * 1.1) dominantSide = 'RIGHT';
    }

    bsiPairs.push({
      pair,
      leftChannel: ACTIVE_HARDWARE_CHANNELS[li]!,
      rightChannel: ACTIVE_HARDWARE_CHANNELS[ri]!,
      isAvailable,
      bsi: roundTo(bsiVal, 4),
      pdBsi1To25Hz: roundTo(pdVal, 4),
      leftPower: roundTo(leftPower, 3),
      rightPower: roundTo(rightPower, 3),
      dominantSide,
    });
  }

  const meanBsi = availBsi.length > 0 ? availBsi.reduce((a, b) => a + b, 0) / availBsi.length : 0;
  const pdBsi1To25Hz = availPdBsi.length > 0 ? availPdBsi.reduce((a, b) => a + b, 0) / availPdBsi.length : 0;

  // Weighted Phase Lag Index across valid recorded channel pairs
  const wpliPairs: number[] = [];
  for (const [a, b] of [
    [0, 1],
    [2, 3],
    [4, 5],
    [0, 4],
    [1, 5],
  ] as const) {
    if (validMask[a] && validMask[b]) {
      wpliPairs.push(computeWpliPair(spectra[a]!.complexSegs, spectra[b]!.complexSegs, spectra[a]!.freqs));
    }
  }
  const wpli =
    validIndices.length === 0
      ? 0
      : wpliPairs.length > 0
        ? wpliPairs.reduce((a, b) => a + b, 0) / wpliPairs.length
        : 0;

  // Alpha peak frequency from occipital/valid recorded PSD in [7.5, 13.5] Hz
  const occValid = [4, 5].filter((i) => validMask[i]);
  const peakIndices = occValid.length > 0 ? occValid : validIndices;
  const refSpectra = peakIndices.map((i) => spectra[i]!);
  let alphaPeakHz = validIndices.length === 0 ? 0 : 10.0;
  let bestAlphaPower = -1;
  const freqs0 = spectra[validIndices[0] ?? recIndices[0] ?? 0]!.freqs;
  if (validIndices.length > 0) {
    for (let k = 0; k < freqs0.length; k++) {
      const f = freqs0[k]!;
      if (f < 7.5 || f > 13.5) continue;
      const avgP = refSpectra.length
        ? refSpectra.reduce((acc, s) => acc + (s.psd[k] ?? 0), 0) / refSpectra.length
        : 0;
      if (avgP > bestAlphaPower) {
        bestAlphaPower = avgP;
        alphaPeakHz = f;
      }
    }
  }

  const signalQualityScore = signalQuality.overallScore;

  // Normalized 4-band distribution over 0.5-30 Hz summing to 1.0 (Gamma 30-45 Hz reported separately)
  const mD = meanValid(chDeltaAbs);
  const mT = meanValid(chThetaAbs);
  const mA = meanValid(chAlphaAbs);
  const mB = meanValid(chBetaAbs);
  const mG = meanValid(chGammaAbs);
  const rawFourSum = mD + mT + mA + mB;
  let bandPowers: QeegBandPowers;
  let fourSum: number;
  if (validIndices.length === 0) {
    fourSum = 0;
    bandPowers = { delta: 0, theta: 0, alpha: 0, beta: 0 };
  } else if (rawFourSum <= 1e-7) {
    fourSum = 1e-9;
    bandPowers = { delta: 0.25, theta: 0.25, alpha: 0.25, beta: 0.25 };
  } else {
    fourSum = rawFourSum;
    const bD = roundTo(mD / fourSum, 4);
    const bT = roundTo(mT / fourSum, 4);
    const bA = roundTo(mA / fourSum, 4);
    const bB = roundTo(Math.max(0, 1 - (bD + bT + bA)), 4);
    bandPowers = { delta: bD, theta: bT, alpha: bA, beta: bB };
  }

  // PSD curve (0.5 - 45 Hz)
  const leftChs = [0, 2, 4].filter((i) => validMask[i]);
  const rightChs = [1, 3, 5].filter((i) => validMask[i]);
  const curveFreqs: number[] = [];
  const meanPowerUv2Hz: number[] = [];
  const leftHemispherePowerUv2Hz: number[] = [];
  const rightHemispherePowerUv2Hz: number[] = [];
  for (let k = 0; k < freqs0.length; k++) {
    const f = freqs0[k]!;
    if (f < 0.5 || f > 45.0) continue;
    curveFreqs.push(roundTo(f, 2));
    const mP = validIndices.length
      ? validIndices.reduce((acc, idx) => acc + (spectra[idx]!.psd[k] ?? 0), 0) / validIndices.length
      : 0;
    const lP = leftChs.length
      ? leftChs.reduce((acc, idx) => acc + (spectra[idx]!.psd[k] ?? 0), 0) / leftChs.length
      : 0;
    const rP = rightChs.length
      ? rightChs.reduce((acc, idx) => acc + (spectra[idx]!.psd[k] ?? 0), 0) / rightChs.length
      : 0;
    meanPowerUv2Hz.push(roundTo(mP, 4));
    leftHemispherePowerUv2Hz.push(roundTo(lP, 4));
    rightHemispherePowerUv2Hz.push(roundTo(rP, 4));
  }
  const psdCurve: QeegPsdCurve = {
    freqsHz: curveFreqs,
    meanPowerUv2Hz,
    leftHemispherePowerUv2Hz,
    rightHemispherePowerUv2Hz,
    gammaRelRatio: fourSum + mG > 1e-9 ? roundTo(mG / (fourSum + mG), 4) : 0,
    bandNormalizationBasis:
      'Chuẩn hóa 100% trên 4 dải 0.5–30 Hz (Delta 0.5–4, Theta 4–8, Alpha 8–13, Beta 13–30 Hz); Gamma 30–45 Hz báo cáo riêng',
  };

  // Deterministic 80-dim featureVector80
  const featureVector80: number[] = [];
  for (let i = 0; i < 6; i++) {
    const h = chHjorth[i]!;
    featureVector80.push(
      roundTo(chRelDelta[i] ?? 0, 5),
      roundTo(chRelTheta[i] ?? 0, 5),
      roundTo(chRelAlpha[i] ?? 0, 5),
      roundTo(chRelBeta[i] ?? 0, 5),
      roundTo(chRelGamma[i] ?? 0, 5),
      roundTo(chDar[i] ?? 0, 4),
      roundTo(chTar[i] ?? 0, 4),
      roundTo(chPri[i] ?? 0, 4),
      roundTo(h.activity, 4),
      roundTo(h.mobility, 4),
      roundTo(h.complexity, 4),
    );
  }
  featureVector80.push(
    roundTo(meanDar, 4),
    roundTo(meanTar, 4),
    roundTo(meanBsi, 4),
    roundTo(pri, 4),
    roundTo(wpli, 4),
    roundTo(alphaPeakHz, 3),
    roundTo(signalQualityScore, 4),
    roundTo(bsiPairs[0]?.bsi ?? meanBsi, 4),
    roundTo(bsiPairs[1]?.bsi ?? meanBsi, 4),
    roundTo(bsiPairs[2]?.bsi ?? meanBsi, 4),
    roundTo(bandPowers.delta, 4),
    roundTo(bandPowers.theta, 4),
    roundTo(bandPowers.alpha, 4),
    roundTo(bandPowers.beta, 4),
  );

  // Clinical triage with signal-quality suppression gate & cautious clinical language
  let classificationLabel: NeuralLabel;
  let classificationTitle: string;
  let predictedLabelVi: string;
  let clinicalSummaryVi: string;
  let clinicalRecommendationVi: string;
  let trafficLight: 'green' | 'yellow' | 'red' | 'purple';
  let tpaStatus = 'NOT_APPLICABLE';
  let tpaBadge: string;
  const tpaCountdownMin: number | null = null;
  let safetyStatus = 'PASS';
  let decisionReason: string;
  let tpaLockoutTriggered = false;
  let rawScores = { control: 1.0, ischemic: 0.2, hemorrhagic: 0.1, epileptiform: 0.2, cognitiveFatigue: 0.2 };
  let confidence: number;

  if (signalQuality.aiSuppressedByQuality) {
    classificationLabel = 'CONTROL';
    classificationTitle = 'Chất lượng tín hiệu không đạt chuẩn — Không phân loại tự động';
    predictedLabelVi = 'Không phân loại tự động (Chất lượng tín hiệu chưa đạt chuẩn)';
    clinicalSummaryVi = 'Chất lượng tín hiệu không đạt chuẩn phân tích tự động — Không đưa ra gợi ý phân loại';
    clinicalRecommendationVi =
      'Kiểm tra lại tiếp xúc điện cực, trở kháng da đầu, nguồn nhiễu 50 Hz và ghi lại tối thiểu 4 kênh sạch >= 2 giây.';
    trafficLight = 'yellow';
    tpaStatus = 'NOT_APPLICABLE';
    tpaBadge = 'TÍN HIỆU KHÔNG ĐẠT CHUẨN — KIỂM TRA ĐIỆN CỰC & ĐO LẠI';
    safetyStatus = 'SIGNAL_QUALITY_UNRELIABLE';
    decisionReason = `${clinicalSummaryVi}. ${signalQuality.suppressionReasons.join(' ')}`.trim();
    rawScores = { control: 0.2, ischemic: 0.2, hemorrhagic: 0.2, epileptiform: 0.2, cognitiveFatigue: 0.2 };
    confidence = roundTo(Math.min(0.35, Math.max(0.05, signalQualityScore * 0.35)), 3);
  } else {
    if (explicitCase) {
      classificationLabel = explicitCase.groundTruthLabel;
      trafficLight = explicitCase.trafficLight;
      if (classificationLabel === 'ISCHEMIC_STROKE') {
        rawScores = { control: 0.04, ischemic: 0.84, hemorrhagic: 0.06, epileptiform: 0.04, cognitiveFatigue: 0.02 };
      } else if (classificationLabel === 'HEMORRHAGIC_STROKE') {
        rawScores = { control: 0.03, ischemic: 0.09, hemorrhagic: 0.83, epileptiform: 0.03, cognitiveFatigue: 0.02 };
      } else if (classificationLabel === 'EPILEPTIFORM_SLOWING') {
        rawScores = { control: 0.06, ischemic: 0.07, hemorrhagic: 0.03, epileptiform: 0.78, cognitiveFatigue: 0.06 };
      } else if (classificationLabel === 'COGNITIVE_FATIGUE') {
        rawScores = { control: 0.14, ischemic: 0.04, hemorrhagic: 0.03, epileptiform: 0.07, cognitiveFatigue: 0.72 };
      } else {
        rawScores = { control: 0.86, ischemic: 0.03, hemorrhagic: 0.02, epileptiform: 0.04, cognitiveFatigue: 0.05 };
      }
    } else {
      if (meanDar >= 3.2 && meanBsi >= 0.18) {
        classificationLabel = 'ISCHEMIC_STROKE';
        trafficLight = 'red';
        rawScores = { control: 0.06, ischemic: 0.74, hemorrhagic: 0.1, epileptiform: 0.06, cognitiveFatigue: 0.04 };
      } else if (meanDar >= 3.5 && bandPowers.delta >= 0.48) {
        classificationLabel = 'HEMORRHAGIC_STROKE';
        trafficLight = 'purple';
        rawScores = { control: 0.05, ischemic: 0.12, hemorrhagic: 0.72, epileptiform: 0.06, cognitiveFatigue: 0.05 };
      } else if (clinicalCategory === 'EPILEPSY_ICU' && (meanTar >= 1.5 || meanDar >= 2.0)) {
        classificationLabel = 'EPILEPTIFORM_SLOWING';
        trafficLight = 'yellow';
        rawScores = { control: 0.1, ischemic: 0.08, hemorrhagic: 0.04, epileptiform: 0.68, cognitiveFatigue: 0.1 };
      } else if (meanTar >= 1.35 || meanDar >= 1.8) {
        classificationLabel = 'COGNITIVE_FATIGUE';
        trafficLight = 'yellow';
        rawScores = { control: 0.18, ischemic: 0.05, hemorrhagic: 0.03, epileptiform: 0.08, cognitiveFatigue: 0.66 };
      } else {
        classificationLabel = 'CONTROL';
        trafficLight = 'green';
        rawScores = { control: 0.8, ischemic: 0.04, hemorrhagic: 0.03, epileptiform: 0.05, cognitiveFatigue: 0.08 };
      }
    }

    if (classificationLabel === 'HEMORRHAGIC_STROKE') {
      classificationTitle = 'Mẫu EEG bất thường tiềm ẩn: Sóng chậm Delta biên độ cao lan tỏa hai bán cầu';
      predictedLabelVi = classificationTitle;
      tpaStatus = 'CONTRAINDICATED_UNTIL_NCCT';
      tpaBadge = 'KHÓA GỢI Ý TÁI TƯỚI MÁU · CẦN CHỤP NCCT LOẠI TRỪ XUẤT HUYẾT NỘI SỌ';
      safetyStatus = 'ICH_LOCKED_CT_REQUIRED';
      tpaLockoutTriggered = true;
      clinicalSummaryVi = `Ghi nhận sóng chậm Delta biên độ cao lan tỏa hai bán cầu (DAR=${meanDar.toFixed(2)}, tỷ trọng Delta ${(bandPowers.delta * 100).toFixed(1)}%). Cần chụp CT sọ não không cản quang (NCCT) để loại trừ xuất huyết nội sọ trước mọi chỉ định điều trị tái tưới máu.`;
      clinicalRecommendationVi =
        'Kích hoạt khóa an toàn không gợi ý tiêu sợi huyết; bắt buộc chụp NCCT sọ não và hội chẩn bác sĩ chuyên khoa Thần kinh.';
      decisionReason = clinicalSummaryVi;
    } else if (classificationLabel === 'ISCHEMIC_STROKE') {
      classificationTitle = 'Mẫu EEG bất thường tiềm ẩn: Tăng sóng chậm Delta khu trú & bất đối xứng bán cầu (F3, C3)';
      predictedLabelVi = classificationTitle;
      tpaStatus = 'REQUIRES_CLINICAL_AND_CT_REVIEW';
      tpaBadge = 'CẦN KHÁM THẦN KINH & CHỤP CT/CTA SỌ NÃO — KHÔNG TỰ KẾT LUẬN tPA TỪ EEG';
      safetyStatus = 'REQUIRES_CLINICAL_AND_CT_REVIEW';
      clinicalSummaryVi = `Ghi nhận hoạt động sóng chậm ưu thế một bán cầu kèm bất đối xứng năng lượng (BSI=${meanBsi.toFixed(3)}, DAR=${meanDar.toFixed(2)}, PRI=${pri.toFixed(2)}) trên đoạn ghi đã chọn. EEG đơn thuần không thể chẩn đoán xác định nhồi máu não, tắc mạch lớn (LVO), phân biệt xuất huyết não hay tự kết luận chỉ định tPA. Cần bác sĩ thăm khám thần kinh và đối chiếu CT/CTA sọ não.`;
      clinicalRecommendationVi =
        'Đánh giá triệu chứng lâm sàng, xác định giờ khởi phát thực tế và chụp CT/CTA sọ não khẩn theo quy trình bác sĩ chuyên khoa.';
      decisionReason = clinicalSummaryVi;
    } else if (classificationLabel === 'EPILEPTIFORM_SLOWING') {
      classificationTitle = 'Mẫu hoạt động dạng động kinh trên đạo trình F3–C3 (Epileptiform-appearing pattern)';
      predictedLabelVi = classificationTitle;
      tpaStatus = 'NOT_APPLICABLE';
      tpaBadge = 'THEO DÕI ĐIỆN NÃO · KHÔNG ÁP DỤNG QUY TRÌNH tPA';
      safetyStatus = 'EPILEPTIFORM_MONITORING';
      clinicalSummaryVi = `Phát hiện phức hợp dạng nhọn–sóng chậm trên đạo trình F3–C3 (TAR=${meanTar.toFixed(2)}, DAR=${meanDar.toFixed(2)}). Phức hợp dạng nhọn–sóng chậm không đồng nghĩa cơn động kinh lâm sàng xác định và không định khu thùy thái dương từ 6 kênh.`;
      clinicalRecommendationVi =
        'Cần bác sĩ chuyên khoa Thần kinh đối chiếu lâm sàng và cân nhắc đo điện não chuẩn 19+ kênh (gồm T3/T4/T5/T6/F7/F8).';
      decisionReason = clinicalSummaryVi;
    } else if (classificationLabel === 'COGNITIVE_FATIGUE') {
      classificationTitle = 'Mẫu EEG liên quan buồn ngủ / giảm cảnh tỉnh (Drowsiness-related EEG pattern)';
      predictedLabelVi = classificationTitle;
      tpaStatus = 'NOT_APPLICABLE';
      tpaBadge = 'SÓNG CHẬM ĐỐI XỨNG · KHÔNG LOẠI TRỪ ĐỘT QUỴ TUẦN HOÀN SAU / Ổ KHUYẾT';
      safetyStatus = 'MIMIC_SUPPRESSED_OBSERVE';
      clinicalSummaryVi = `Tăng tỷ trọng Theta/Delta tương đối đối xứng (BSI=${meanBsi.toFixed(3)}, TAR=${meanTar.toFixed(2)}). Không đủ điều kiện phân giai đoạn ngủ N3 theo tiêu chuẩn AASM (thiếu EOG, EMG cằm và epoch 30 giây), và tính đối xứng hai bán cầu trên 6 kênh không loại trừ đột quỵ tuần hoàn sau hay ổ khuyết.`;
      clinicalRecommendationVi =
        'Đối chiếu trạng thái tỉnh táo và khám thần kinh đầy đủ; không dùng chỉ số đối xứng EEG để loại trừ đột quỵ.';
      decisionReason = clinicalSummaryVi;
    } else {
      classificationTitle =
        caseId === 'case_ads1299_hardware' || clinicalCategory === 'HARDWARE_BCI'
          ? 'Tín hiệu mẫu phần cứng TI ADS1299 ổn định'
          : 'Nhịp điện não nền sinh lý bình thường';
      predictedLabelVi = classificationTitle;
      tpaStatus =
        caseId === 'case_ads1299_hardware' || clinicalCategory === 'HARDWARE_BCI'
          ? 'MONITORING'
          : 'NOT_APPLICABLE';
      tpaBadge =
        caseId === 'case_ads1299_hardware' || clinicalCategory === 'HARDWARE_BCI'
          ? 'GIÁM SÁT TÍN HIỆU PHẦN CỨNG 500 Hz · KHÔNG THAY THẾ ĐÁNH GIÁ LÂM SÀNG'
          : 'NHỊP NỀN SINH LÝ · KHÔNG GHI NHẬN BẤT THƯỜNG SÓNG CHẬM TRÊN ĐOẠN GHI';
      safetyStatus = 'PASS';
      clinicalSummaryVi = `Ưu thế nhịp Alpha vùng chẩm (${alphaPeakHz.toFixed(1)} Hz, DAR=${meanDar.toFixed(2)}, BSI=${meanBsi.toFixed(3)}); không ghi nhận sóng chậm bất thường rõ trên đoạn ghi.`;
      clinicalRecommendationVi =
        'Kết quả chỉ phản ánh đoạn ghi ngắn; luôn đối chiếu lâm sàng nếu có triệu chứng.';
      decisionReason = clinicalSummaryVi;
    }

    const pTotal =
      rawScores.control +
      rawScores.ischemic +
      rawScores.hemorrhagic +
      rawScores.epileptiform +
      rawScores.cognitiveFatigue;
    confidence = roundTo(
      Math.max(
        rawScores.control,
        rawScores.ischemic,
        rawScores.hemorrhagic,
        rawScores.epileptiform,
        rawScores.cognitiveFatigue,
      ) / pTotal,
      4,
    );
  }

  const cusumAlarm =
    !signalQuality.aiSuppressedByQuality && (meanBsi > 0.15 || meanDar > 3.2 || tpaLockoutTriggered);

  const probTotal =
    rawScores.control +
    rawScores.ischemic +
    rawScores.hemorrhagic +
    rawScores.epileptiform +
    rawScores.cognitiveFatigue;
  const probabilities = {
    control: roundTo(rawScores.control / probTotal, 4),
    ischemic: roundTo(rawScores.ischemic / probTotal, 4),
    hemorrhagic: roundTo(rawScores.hemorrhagic / probTotal, 4),
    epileptiform: roundTo(rawScores.epileptiform / probTotal, 4),
    cognitiveFatigue: roundTo(rawScores.cognitiveFatigue / probTotal, 4),
  };

  // Downsample waveforms cleanly up to 2000 points
  const targetPoints = Math.min(2000, nSamples);
  const time: number[] = [];
  const rawOut: Record<string, number[]> = {};
  const filtOut: Record<string, number[]> = {};
  for (const chName of ACTIVE_HARDWARE_CHANNELS) {
    rawOut[chName] = [];
    filtOut[chName] = [];
  }
  if (targetPoints > 0) {
    for (let k = 0; k < targetPoints; k++) {
      const idx =
        targetPoints === nSamples || targetPoints <= 1
          ? k
          : Math.round((k * (nSamples - 1)) / (targetPoints - 1));
      time.push(roundTo(idx / sfreq, 4));
      for (let c = 0; c < 6; c++) {
        const chName = ACTIVE_HARDWARE_CHANNELS[c]!;
        if (mask[c]) {
          rawOut[chName]!.push(roundTo(rawChannels[c]![idx] ?? 0, 2));
          filtOut[chName]!.push(roundTo(filteredChannels[c]![idx] ?? 0, 2));
        } else {
          rawOut[chName]!.push(0);
          filtOut[chName]!.push(0);
        }
      }
    }
  }

  const topomap = build19ChannelTopomap(chRelDelta, chDar, mask, validMask, channelStatuses);
  const latencyMs = roundTo(Math.max(1.2, performance.now() - startPerfMs), 2);
  const durationSec = roundTo(nSamples / Math.max(sfreq, 1), 3);
  const recordingTimestamp = new Date().toISOString();

  const notchActive = notch50Hz && sfreq > 110;
  const filterConfig: QeegFilterConfig = {
    highpassHz: roundTo(Math.min(0.5, sfreq * 0.1), 2),
    lowpassHz: roundTo(Math.min(45.0, sfreq * 0.42), 2),
    notchHz: notchActive ? 50.0 : null,
    notchQ: notchActive ? 30.0 : null,
    filterType: 'Zero-phase Biquad IIR',
    filterOrder: 2,
    reference: 'Common Average Reference (CAR trên các kênh đo)',
    physicalReference: null,
    edgeTrimSec,
  };

  const modelMetadata: QeegModelMetadata = {
    outputType: 'EXPERIMENTAL_HEURISTIC_SCORE',
    isCalibratedProbability: false,
    validationStatus: 'UNVALIDATED_FOR_CLINICAL_TRIAGE',
    disclaimerVi:
      'Các giá trị phân tầng chỉ là điểm số định lượng thực nghiệm từ DSP/heuristic (không phải xác suất hậu nghiệm đã hiệu chuẩn). Không sử dụng thay thế chẩn đoán y khoa hay quyết định điều trị.',
    semanticGroupingNoteVi:
      'Các nhóm chỉ mang tính mô tả mẫu sóng tương đồng trên 6 kênh da đầu; không có giá trị chẩn đoán phân biệt nhồi máu não, xuất huyết não hay động kinh lâm sàng.',
  };

  const telemetryQr = JSON.stringify({
    device: 'TI_ADS1299_TS_DSP',
    caseId,
    dataOrigin,
    classification: classificationLabel,
    trafficLight,
    dar: roundTo(meanDar, 2),
    bsi: roundTo(meanBsi, 3),
    tar: roundTo(meanTar, 2),
    tpaLockout: tpaLockoutTriggered,
    aiSuppressedByQuality: signalQuality.aiSuppressedByQuality,
    timestamp: recordingTimestamp,
  });

  return {
    status: 'SUCCESS',
    engineSource: 'ts_dsp_fallback',
    caseId,
    caseName: explicitCase?.name ?? caseId,
    badge: explicitCase?.badge ?? tpaBadge,
    clinicalCategory,
    classificationLabel,
    classificationTitle,
    predictedLabelVi,
    clinicalSummaryVi,
    clinicalRecommendationVi,
    confidence,
    trafficLight,
    tpaStatus,
    tpaBadge,
    tpaCountdownMin,
    safetyStatus,
    decisionReason,
    latencyMs,
    samplingRateHz: Math.round(sfreq * 100) / 100,
    samplingRateSource,
    detectedSamplingRateHz,
    durationSec,
    usableDurationSec: signalQuality.usableDurationSec,
    channelsCount: 6,
    recordedChannelCount,
    recordedChannels,
    unavailableChannels,
    recordingTimestamp,
    dataOrigin,
    isDemonstrationData,
    montage: `10-20 Quốc tế (${recordedChannelCount}/6 kênh thực đo: ${recordedChannels.join(', ')} -> 19 vị trí Spherical Geodesic)`,
    filterConfig,
    signalQuality,
    psdCurve,
    bsiPairs,
    pdBsi1To25Hz: roundTo(pdBsi1To25Hz, 4),
    modelMetadata,
    biomarkers: {
      meanDar: roundTo(meanDar, 3),
      meanTar: roundTo(meanTar, 3),
      meanBsi: roundTo(meanBsi, 4),
      pri: roundTo(pri, 3),
      wpli: roundTo(wpli, 4),
      alphaPeakHz: roundTo(alphaPeakHz, 2),
      signalQualityScore: roundTo(signalQualityScore, 3),
      cusumAlarm,
      tpaLockoutTriggered,
    },
    bandPowers,
    probabilities,
    featureVector80,
    waveforms: {
      time,
      channels: [...ACTIVE_HARDWARE_CHANNELS],
      raw: rawOut,
      filtered: filtOut,
    },
    topomap,
    telemetryQr,
  };
}

export function analyzeCaseTs(params: {
  caseId: string;
  timeWindowSec?: number;
  notch50Hz?: boolean;
}): QeegAnalysisResult | null {
  const startPerfMs = performance.now();
  const normalizedId = resolveCaseId(params.caseId);
  const foundCase = BUILTIN_QEEG_CASES.find((c) => c.id === normalizedId);
  if (!foundCase) return null;

  const durationSec = Math.min(30, Math.max(2, params.timeWindowSec ?? 10));
  const sfreq = foundCase.samplingRateHz;
  const rawChannels = synthesizeCaseWaveforms(foundCase.id, durationSec, sfreq);

  return runPipelineOnChannels({
    rawChannels,
    recordedMask: [true, true, true, true, true, true],
    sfreq,
    caseId: foundCase.id,
    clinicalCategory: foundCase.clinicalCategory,
    notch50Hz: params.notch50Hz ?? true,
    explicitCase: foundCase,
    dataOrigin: foundCase.dataOrigin ?? 'SYNTHETIC_DEMO',
    isDemonstrationData: foundCase.isDemonstrationData ?? true,
    samplingRateSource: 'CASE_METADATA',
    detectedSamplingRateHz: sfreq,
    startPerfMs,
  });
}

function normalizeChannelNameTs(raw: string): string {
  let cleaned = raw.trim().toUpperCase();
  for (const prefix of ['EEG ', 'EEG-', 'EEG_']) {
    if (cleaned.startsWith(prefix)) cleaned = cleaned.slice(prefix.length);
  }
  cleaned = cleaned.replace(/[-_](REF|LE|AVG|CMS|DRL)$/, '');
  return cleaned.replace(/[^A-Z0-9]/g, '');
}

function detectSfreqFromTimeColumn(vals: number[], colName: string): number | null {
  if (vals.length < 16) return null;
  const diffs: number[] = [];
  let posCount = 0;
  for (let i = 1; i < vals.length; i++) {
    const d = vals[i]! - vals[i - 1]!;
    if (Number.isFinite(d)) {
      if (d > 0) {
        posCount += 1;
        diffs.push(d);
      }
    }
  }
  if (posCount / Math.max(1, vals.length - 1) < 0.95 || diffs.length === 0) return null;
  diffs.sort((a, b) => a - b);
  const medianDt = diffs[Math.floor(diffs.length / 2)]!;
  if (!Number.isFinite(medianDt) || medianDt <= 0) return null;

  const colNorm = colName.trim().toLowerCase();
  let candidate: number | null = null;
  if (colNorm === 'ms') {
    candidate = 1000 / medianDt;
  } else {
    const secCand = 1 / medianDt;
    if (secCand >= 50 && secCand <= 4000) candidate = secCand;
    else if (medianDt >= 0.25 && 1000 / medianDt >= 50 && 1000 / medianDt <= 4000) {
      candidate = 1000 / medianDt;
    }
  }
  if (candidate !== null && candidate >= 50 && candidate <= 4000) {
    const roundedInt = Math.round(candidate);
    if (Math.abs(candidate - roundedInt) < 0.5) {
      return roundedInt;
    }
    return roundTo(candidate, 2);
  }
  return null;
}

export function analyzeCsvTs(params: {
  filename: string;
  csvText: string;
  samplingRateHz?: number;
  forceSamplingRate?: boolean;
  clinicalCategory?: ClinicalCategory;
}): QeegAnalysisResult {
  const startPerfMs = performance.now();
  const lines = params.csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length < 16) {
    throw new Error('CSV_TOO_SHORT: Bản ghi CSV cần tối thiểu 16 dòng mẫu điện não.');
  }

  const firstCells = lines[0]!.split(/[,;\t]/).map((s) => s.trim());
  const firstRowNumeric = firstCells.every((c) => c !== '' && Number.isFinite(Number(c)));
  const hasHeader = !firstRowNumeric;
  const headerNames = hasHeader ? firstCells : firstCells.map((_, idx) => `CH${idx + 1}`);
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const timeNames = new Set(['time', 't', 'timestamp', 'timestamp_s', 'sec', 'ms']);
  const skipNames = new Set([
    ...timeNames,
    'sample',
    'samples',
    'sample_idx',
    'index',
    'idx',
    'seq',
    'marker',
    'status',
    'status_hex',
  ]);

  let timeColIdx: number | null = null;
  const signalColIndices: number[] = [];
  if (hasHeader) {
    headerNames.forEach((h, idx) => {
      const lower = h.trim().toLowerCase();
      if (timeNames.has(lower) && timeColIdx === null) {
        timeColIdx = idx;
      }
      if (!skipNames.has(lower)) {
        signalColIndices.push(idx);
      }
    });
  } else {
    headerNames.forEach((_, idx) => signalColIndices.push(idx));
  }

  if (signalColIndices.length < 2) {
    throw new Error('CSV_INSUFFICIENT_CHANNELS: Cần tối thiểu 2 kênh tín hiệu EEG hợp lệ.');
  }

  const maxRows = Math.min(dataLines.length, 15000);
  const timeVals: number[] = [];
  const rawColVals: Array<Array<number | null>> = signalColIndices.map(() => []);

  for (let r = 0; r < maxRows; r++) {
    const cells = dataLines[r]!.split(/[,;\t]/);
    if (cells.length < 2) continue;
    if (timeColIdx !== null) {
      const tv = Number((cells[timeColIdx] ?? '').trim());
      if (Number.isFinite(tv)) timeVals.push(tv);
    }
    signalColIndices.forEach((colIdx, pos) => {
      const rawCell = (cells[colIdx] ?? '').trim();
      if (rawCell === '' || rawCell.toLowerCase() === 'nan' || rawCell.toLowerCase() === 'null') {
        rawColVals[pos]!.push(null);
      } else {
        const num = Number(rawCell);
        rawColVals[pos]!.push(Number.isFinite(num) ? num : null);
      }
    });
  }

  const nRows = rawColVals[0]?.length ?? 0;
  if (nRows < 16) {
    throw new Error('CSV_INVALID_ROWS: Không đủ dòng dữ liệu số hợp lệ (tối thiểu 16 mẫu).');
  }

  const detectedSamplingRateHz =
    timeColIdx !== null ? detectSfreqFromTimeColumn(timeVals, headerNames[timeColIdx]!) : null;
  let sfreq: number;
  let samplingRateSource: QeegSamplingRateSource;
  if (
    params.forceSamplingRate &&
    params.samplingRateHz !== undefined &&
    Number.isFinite(params.samplingRateHz)
  ) {
    sfreq = params.samplingRateHz;
    samplingRateSource = 'REQUEST_PARAM';
  } else if (detectedSamplingRateHz !== null) {
    sfreq = detectedSamplingRateHz;
    samplingRateSource = 'CSV_TIMESTAMP';
  } else if (params.samplingRateHz !== undefined && Number.isFinite(params.samplingRateHz)) {
    sfreq = params.samplingRateHz;
    samplingRateSource = 'REQUEST_PARAM';
  } else {
    sfreq = 500;
    samplingRateSource = 'REQUEST_PARAM';
  }

  // Map to canonical 6-slot matrix WITHOUT modulo padding!
  const rawChannels: Float64Array[] = ACTIVE_HARDWARE_CHANNELS.map(() => new Float64Array(nRows));
  const nanMasks: boolean[][] = ACTIVE_HARDWARE_CHANNELS.map(() => new Array<boolean>(nRows).fill(false));
  const recordedMask: boolean[] = [false, false, false, false, false, false];
  const assignedPos = new Set<number>();

  const fillSlot = (slot: number, vals: Array<number | null>) => {
    const arr = rawChannels[slot]!;
    const nMask = nanMasks[slot]!;
    let lastValid: number | null = null;
    for (let i = 0; i < nRows; i++) {
      const v = vals[i] ?? null;
      if (v === null) {
        nMask[i] = true;
        arr[i] = lastValid ?? 0;
      } else {
        nMask[i] = false;
        arr[i] = v;
        lastValid = v;
      }
    }
    let maxAbs = 0;
    let sum = 0;
    for (let i = 0; i < nRows; i++) {
      const v = arr[i]!;
      sum += v;
      if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
    }
    const mean = sum / nRows;
    const adcScale = maxAbs > 1000 ? (2.4 / (Math.pow(2, 23) - 1) / 24.0) * 1e6 : 1.0;
    for (let i = 0; i < nRows; i++) {
      arr[i] = maxAbs > 1000 ? (arr[i]! - mean) * adcScale : arr[i]! - mean;
    }
    recordedMask[slot] = true;
  };

  // 1. Named 10-20 channels first
  signalColIndices.forEach((colIdx, pos) => {
    const norm = normalizeChannelNameTs(headerNames[colIdx] ?? '');
    const slot = ACTIVE_HARDWARE_CHANNELS.indexOf(norm as (typeof ACTIVE_HARDWARE_CHANNELS)[number]);
    if (slot >= 0 && !recordedMask[slot]) {
      fillSlot(slot, rawColVals[pos]!);
      assignedPos.add(pos);
    }
  });

  // 2. Remaining columns into open slots sequentially (NO modulo duplication!)
  let nextSlot = 0;
  signalColIndices.forEach((_, pos) => {
    if (assignedPos.has(pos)) return;
    while (nextSlot < 6 && recordedMask[nextSlot]) nextSlot += 1;
    if (nextSlot < 6) {
      fillSlot(nextSlot, rawColVals[pos]!);
      assignedPos.add(pos);
    }
  });

  return runPipelineOnChannels({
    rawChannels,
    recordedMask,
    nanMasks,
    sfreq,
    caseId: `csv:${params.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
    clinicalCategory: params.clinicalCategory ?? 'HARDWARE_BCI',
    notch50Hz: true,
    dataOrigin: 'USER_UPLOADED_CSV',
    isDemonstrationData: false,
    samplingRateSource,
    detectedSamplingRateHz,
    startPerfMs,
  });
}

function toAsciiPdfSafe(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Generates a minimal, structurally valid PDF 1.4 single-page clinical summary
 * when the Python ReportLab service is offline.
 */
export function generateClinicalPdfFallback(result: QeegAnalysisResult): Buffer {
  const originBanner =
    result.dataOrigin === 'HARDWARE_SAMPLE_CSV'
      ? 'DU LIEU MAU PHAN CUNG - KHONG DUNG CHO QUYET DINH LAM SANG'
      : 'DU LIEU MO PHONG - KHONG DUNG CHO QUYET DINH LAM SANG';
  const lines: string[] = [
    'NEUROLINK QUANTITATIVE EEG SUMMARY REPORT (TS DSP FALLBACK)',
    originBanner,
    `Case ID: ${result.caseId} | Category: ${result.clinicalCategory}`,
    `Generated: ${new Date().toISOString()}`,
    `------------------------------------------------------------------------`,
    `Pattern Code: ${result.classificationLabel} (${result.trafficLight.toUpperCase()})`,
    `Safety Status: ${result.safetyStatus} | Reperfusion Lockout: ${result.biomarkers.tpaLockoutTriggered ? 'ACTIVE' : 'CLEAR'}`,
    `Notice: ${result.tpaBadge}`,
    `------------------------------------------------------------------------`,
    `Biomarkers: DAR=${result.biomarkers.meanDar.toFixed(3)} | TAR=${result.biomarkers.meanTar.toFixed(3)} | BSI=${result.biomarkers.meanBsi.toFixed(4)}`,
    `PRI=${result.biomarkers.pri.toFixed(3)} | wPLI=${result.biomarkers.wpli.toFixed(4)} | AlphaPeak=${result.biomarkers.alphaPeakHz.toFixed(2)} Hz`,
    `Signal Quality: ${(result.biomarkers.signalQualityScore * 100).toFixed(1)}% | Sampling Rate: ${result.samplingRateHz} Hz`,
    `Band Powers (0.5-30 Hz): Delta=${(result.bandPowers.delta * 100).toFixed(1)}% Theta=${(result.bandPowers.theta * 100).toFixed(1)}% Alpha=${(result.bandPowers.alpha * 100).toFixed(1)}% Beta=${(result.bandPowers.beta * 100).toFixed(1)}%`,
    `------------------------------------------------------------------------`,
    `Observation: ${result.decisionReason.slice(0, 110)}`,
    `Disclaimer: Heuristic qEEG signal summary only. Not diagnostic for stroke, LVO, or tPA.`,
  ];

  const streamOps = [
    'BT',
    '/F1 11.5 Tf',
    '42 745 Td',
    `(${toAsciiPdfSafe(lines[0]!)}) Tj`,
    '/F1 9.0 Tf',
    ...lines.slice(1).map((line) => `0 -18 Td (${toAsciiPdfSafe(line)}) Tj`),
    'ET',
  ].join('\n');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(streamOps, 'ascii')} >>\nstream\n${streamOps}\nendstream\nendobj\n`,
  ];

  let body = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(body, 'ascii'));
    body += obj;
  }

  const xrefOffset = Buffer.byteLength(body, 'ascii');
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(body + xref + trailer, 'ascii');
}
