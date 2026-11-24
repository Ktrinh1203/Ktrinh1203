import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  FileDown,
  FileUp,
  MessageSquarePlus,
  RefreshCw,
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
} from '../../api/types';
import { Alert, Button, Card, Input, Spinner, Textarea, cn } from '../../components/ui';
import { useAuth } from '../auth/AuthContext';
import { BrainWaveformViewer } from './BrainWaveformViewer';
import { CorticalTopomap2D } from './CorticalTopomap2D';
import {
  CLINICAL_CATEGORY_META,
  CLINICAL_CATEGORY_ORDER,
  DATASET_SPLIT_META,
  DATASET_SPLIT_ORDER,
  NEURAL_LABEL_META,
  NEURAL_LABEL_ORDER,
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

function trafficBannerStyle(trafficLight: QeegAnalysisResult['trafficLight']) {
  if (trafficLight === 'purple') {
    return {
      dot: 'bg-red-700',
      label: 'CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI tPA · KHÓA AN TOÀN',
    };
  }
  if (trafficLight === 'red') {
    return {
      dot: 'bg-red-600',
      label: 'CẢNH BÁO ĐỘT QUỴ CẤP · CHỤP CT SỌ NÃO KHẨN',
    };
  }
  if (trafficLight === 'yellow') {
    return {
      dot: 'bg-amber-500',
      label: 'BẤT THƯỜNG KHÔNG ĐỘT QUỴ / THEO DÕI CHUYÊN KHOA',
    };
  }
  return {
    dot: 'bg-[#16A34A]',
    label: 'ĐIỆN NÃO ĐỒ SINH LÝ ỔN ĐỊNH',
  };
}

const GENERAL_CASE_PRESETS = [
  { id: 'case_healthy_alpha', label: 'Ổn định' },
  { id: 'case_sleep_fatigue_n3', label: 'Thiếu ngủ' },
  { id: 'case_epilepsy_temporal', label: 'Động kinh' },
  { id: 'case_ischemia_lvo', label: 'Đột quỵ' },
] as const;

function generalStatusLabel(trafficLight: QeegAnalysisResult['trafficLight']) {
  if (trafficLight === 'green') return 'Ổn định';
  if (trafficLight === 'yellow') return 'Cần lưu ý';
  if (trafficLight === 'red') return 'Cảnh báo khẩn';
  return 'Cảnh báo xuất huyết';
}

function plainSummaryByTrafficLight(trafficLight: QeegAnalysisResult['trafficLight']) {
  if (trafficLight === 'green') {
    return 'Nhịp Alpha cân đối và ổn định, phù hợp làm việc hoặc nghỉ ngơi.';
  }
  if (trafficLight === 'yellow') {
    return 'Có dấu hiệu sóng chậm nhẹ, nên nghỉ ngơi và theo dõi thêm.';
  }
  if (trafficLight === 'red') {
    return 'Mẫu minh họa thiếu máu não cấp; nếu có triệu chứng thật, gọi 115.';
  }
  return 'Mẫu minh họa xuất huyết não — cần cấp cứu 115 và chụp CT.';
}

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

  // Save to Platform (Neural DB + Personal Dataset) Drawer
  const [showSaveDrawer, setShowSaveDrawer] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveSubjectCode, setSaveSubjectCode] = useState('');
  const [saveCategory, setSaveCategory] = useState<ClinicalCategory>('VASCULAR_STROKE');
  const [saveLabel, setSaveLabel] = useState<NeuralLabel>('ISCHEMIC_STROKE');
  const [saveSplit, setSaveSplit] = useState<DatasetSplit>('TRAIN');
  const [saveNote, setSaveNote] = useState('');
  const [deidentifiedConfirmed, setDeidentifiedConfirmed] = useState(false);
  const [savedSampleId, setSavedSampleId] = useState<string | null>(null);
  const [savedDatasetId, setSavedDatasetId] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

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
      setSaveNote(res.decisionReason);
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
      setSaveNote(res.decisionReason);
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
      setShowSaveDrawer(false);
      setSaveFeedback({
        tone: 'success',
        text: `Đã lưu mẫu ${res.sample.subjectCode} vào CSDL Mạng Nơ-ron (Neural DB) và Hồ sơ EEG Cá nhân (${res.dataset.patientCode}).`,
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
        text: 'Bắt buộc xác nhận dữ liệu đã ẩn danh cá nhân trước khi lưu vào hệ thống.',
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

      {isProfessional ? (
        /* Compact Single-Row Toolbar: Case Select + CSV + Filter Popover */
        <Card className="px-3.5 py-2.5 border-[#DCE6DF]">
          <div className="flex flex-wrap items-center gap-2">
            {/* Case selector */}
            <div className="flex-1 min-w-[220px] flex items-center gap-2">
              <label htmlFor="qeeg-case-select" className="text-[11px] font-semibold text-[#6E6D68] uppercase tracking-wider shrink-0">
                Ca lâm sàng
              </label>
              <select
                id="qeeg-case-select"
                value={selectedCaseId}
                disabled={isBusy}
                onChange={(e) => handleSelectCase(e.target.value)}
                className="h-8 flex-1 min-w-0 rounded-md border border-[#DCE6DF] bg-white px-2.5 text-xs font-medium text-[#141413]"
              >
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* CSV Upload trigger */}
            <div className="shrink-0">
              <Button
                type="button"
                size="xs"
                variant="outline"
                className="h-8 px-2.5 text-xs border-[#DCE6DF]"
                onClick={() => document.getElementById('qeeg-csv-upload')?.click()}
                icon={<FileUp className="size-3.5" aria-hidden />}
              >
                {csvFilename ? csvFilename.slice(0, 16) + (csvFilename.length > 16 ? '…' : '') : 'Tải tệp CSV'}
              </Button>
            </div>

            {/* CSV analyze button (shown only when file picked) */}
            {csvText && (
              <Button
                type="button"
                size="xs"
                variant="primary"
                className="h-8 px-2.5 text-xs"
                loading={analyzeCsvMutation.isPending}
                onClick={() => analyzeCsvMutation.mutate()}
                icon={<FileUp className="size-3.5" aria-hidden />}
              >
                Phân tích CSV
              </Button>
            )}

            {/* DSP Cấu hình toggle */}
            <div className="shrink-0">
              <details className="relative group">
                <summary className="list-none cursor-pointer inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-[#DCE6DF] bg-white text-xs font-medium text-[#262624] hover:bg-[#F5FAF7] transition-colors">
                  Cấu hình lọc ▾
                </summary>
                <div className="absolute left-0 top-full mt-1 z-20 w-72 rounded-xl border border-[#DCE6DF] bg-white shadow-sm p-4 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label htmlFor="qeeg-window-sec" className="font-medium text-[#262624] block">
                        Cửa sổ (giây)
                      </label>
                      <select
                        id="qeeg-window-sec"
                        value={timeWindowSec}
                        onChange={(e) => setTimeWindowSec(Number(e.target.value))}
                        className="h-9 w-full rounded-md border border-[#DCE6DF] bg-white px-2.5 text-xs font-mono text-[#141413]"
                      >
                        <option value={5}>5 giây</option>
                        <option value={6}>6 giây</option>
                        <option value={10}>10 giây</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="qeeg-fast-score" className="font-medium text-[#262624] block">
                        Thang FAST (0–3)
                      </label>
                      <select
                        id="qeeg-fast-score"
                        value={fastScore}
                        onChange={(e) => setFastScore(Number(e.target.value))}
                        className="h-9 w-full rounded-md border border-[#DCE6DF] bg-white px-2.5 text-xs font-mono text-[#141413]"
                      >
                        <option value={0}>0 · Bình thường</option>
                        <option value={1}>1 · Nhẹ</option>
                        <option value={2}>2 · Nghi ngờ rõ</option>
                        <option value={3}>3 · Nặng / Khẩn</option>
                      </select>
                    </div>
                  </div>
                  <label htmlFor="qeeg-notch-50" className="inline-flex items-center gap-2 font-medium text-[#262624] cursor-pointer">
                    <input
                      id="qeeg-notch-50"
                      type="checkbox"
                      checked={notch50Hz}
                      onChange={(e) => setNotch50Hz(e.target.checked)}
                      className="size-4 rounded border-[#DCE6DF] accent-[#16A34A] text-[#16A34A]"
                    />
                    <span>Lọc nhiễu 50 Hz Notch</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label htmlFor="qeeg-csv-hz" className="font-medium text-[#262624] block">
                        Tần số CSV (Hz)
                      </label>
                      <select
                        id="qeeg-csv-hz"
                        value={csvSamplingRate}
                        onChange={(e) => setCsvSamplingRate(Number(e.target.value))}
                        className="h-9 w-full rounded-md border border-[#DCE6DF] bg-white px-2 text-xs font-mono text-[#141413]"
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
                        className="h-9 w-full rounded-md border border-[#DCE6DF] bg-white px-2 text-xs text-[#141413]"
                      >
                        {CLINICAL_CATEGORY_ORDER.map((cat) => (
                          <option key={cat} value={cat}>
                            {CLINICAL_CATEGORY_META[cat].shortLabel}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="w-full"
                    loading={analyzeCaseMutation.isPending}
                    onClick={() =>
                      analyzeCaseMutation.mutate({
                        caseId: selectedCaseId,
                        timeWindowSec,
                        notch50Hz,
                        fastScore,
                      })
                    }
                    icon={<RefreshCw className="size-3" aria-hidden />}
                  >
                    Tính lại với tham số mới
                  </Button>
                </div>
              </details>
            </div>
          </div>

          {/* Selected case presentation (shown below toolbar for the active case) */}
          {(() => {
            const activeCase = cases.find((c) => c.id === selectedCaseId);
            return activeCase ? (
              <p
                className="mt-2 text-[11px] text-[#6E6D68] leading-snug border-t border-[#DCE6DF] pt-2 truncate"
                title={activeCase.clinicalPresentation}
              >
                <span className={cn(
                  'inline-block size-2 rounded-full mr-1.5 align-middle',
                  activeCase.trafficLight === 'red' ? 'bg-red-600' :
                  activeCase.trafficLight === 'purple' ? 'bg-red-700' :
                  activeCase.trafficLight === 'yellow' ? 'bg-amber-500' : 'bg-[#16A34A]',
                )} aria-hidden />
                <strong className="text-[#141413] font-semibold">{activeCase.subjectId}</strong> · {activeCase.clinicalPresentation}
              </p>
            ) : null;
          })()}
        </Card>
      ) : (
        /* General Mode Single-Row Compact Toolbar */
        <Card className="px-3.5 py-2.5 border-[#DCE6DF]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="xs"
                variant="primary"
                loading={analyzeCsvMutation.isPending}
                onClick={() => document.getElementById('qeeg-csv-upload')?.click()}
                className="h-8 rounded-lg px-3 text-xs"
                icon={<FileUp className="size-3.5" aria-hidden />}
              >
                Tải CSV
              </Button>

              {GENERAL_CASE_PRESETS.map((preset) => {
                const isActive = sourceMode === 'sample' && selectedCaseId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={isBusy}
                    aria-pressed={isActive}
                    onClick={() => handleSelectCase(preset.id)}
                    className={cn(
                      'h-8 rounded-lg px-3 text-xs transition-colors',
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

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-medium text-[#6E6D68]">
                {sourceMode === 'csv' ? csvFilename.slice(0, 14) : 'Mẫu thử'}
              </span>

              <details className="relative">
                <summary className="list-none cursor-pointer inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-[#DCE6DF] bg-white text-xs font-medium text-[#262624] hover:bg-[#F5FAF7]">
                  Tùy chọn ▾
                </summary>
                <div className="absolute right-0 top-full mt-1 z-20 w-72 rounded-xl border border-[#DCE6DF] bg-white shadow-sm p-3.5 space-y-3 text-xs">
                  <div className="space-y-1">
                    <label htmlFor="qeeg-case-select" className="font-medium text-[#262624] block">
                      Chọn ca mẫu
                    </label>
                    <select
                      id="qeeg-case-select"
                      value={selectedCaseId}
                      disabled={isBusy}
                      onChange={(e) => handleSelectCase(e.target.value)}
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

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <label htmlFor="qeeg-notch-50" className="inline-flex items-center gap-1.5 font-medium text-[#262624] cursor-pointer">
                      <input
                        id="qeeg-notch-50"
                        type="checkbox"
                        checked={notch50Hz}
                        onChange={(e) => setNotch50Hz(e.target.checked)}
                        className="size-3.5 rounded border-[#DCE6DF] accent-[#16A34A] text-[#16A34A]"
                      />
                      <span>Lọc 50 Hz</span>
                    </label>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      loading={analyzeCaseMutation.isPending}
                      onClick={() => {
                        setSourceMode('sample');
                        analyzeCaseMutation.mutate({
                          caseId: selectedCaseId,
                          timeWindowSec,
                          notch50Hz,
                          fastScore,
                        });
                      }}
                      icon={<RefreshCw className="size-3" aria-hidden />}
                    >
                      Tính lại
                    </Button>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </Card>
      )}

      {analysisError && <Alert tone="error">{analysisError}</Alert>}
      {saveFeedback && (
        <Alert tone={saveFeedback.tone}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{saveFeedback.text}</span>
            {saveFeedback.tone === 'success' && onSwitchTab && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSwitchTab('neural-db')}
                  className="underline font-bold text-xs"
                >
                  Mở Neural DB
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchTab('personal')}
                  className="underline font-bold text-xs"
                >
                  Xem Hồ sơ Cá nhân
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
          {/* Clinical Decision & Safety Banner */}
          <div className="rounded-xl border border-[#DCE6DF] bg-white px-4 py-3.5 space-y-2.5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn('size-2 rounded-full shrink-0', banner.dot)} aria-hidden />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[#6E6D68]">
                    {isProfessional
                      ? banner.label
                      : `${generalStatusLabel(analysis.trafficLight)}${sourceMode === 'sample' ? ' · Mẫu thử' : ''}`}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-[#141413]">
                  {analysis.classificationTitle}
                </h3>
                <p className="text-xs leading-snug line-clamp-1 text-[#575652]">
                  {isProfessional ? (
                    <>
                      <span className="font-semibold text-[#141413]">{analysis.tpaBadge}</span> · {analysis.decisionReason}
                    </>
                  ) : (
                    plainSummaryByTrafficLight(analysis.trafficLight)
                  )}
                </p>
              </div>

              {analysis.tpaCountdownMin > 0 && isProfessional && (
                <div className="rounded-lg bg-[#F5FAF7] text-[#141413] border border-[#DCE6DF] px-3 py-1.5 text-center shrink-0">
                  <span className="block text-[9.5px] font-semibold uppercase tracking-wider text-red-700">
                    Cửa sổ vàng cấp cứu
                  </span>
                  <span className="font-mono text-lg font-bold tabular-nums text-[#141413] leading-tight">
                    {analysis.tpaCountdownMin} phút
                  </span>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="pt-2.5 border-t border-[#DCE6DF] flex flex-wrap items-center gap-2">
              <Link
                to={
                  savedSampleId
                    ? `/consultations?sampleId=${encodeURIComponent(savedSampleId)}${savedDatasetId ? `&datasetId=${encodeURIComponent(savedDatasetId)}` : ''}&category=${analysis.clinicalCategory}&ask=1`
                    : `/consultations?category=${analysis.clinicalCategory}${!isProfessional ? '&ask=1' : ''}`
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#16A34A] hover:bg-[#15803D] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16A34A]"
              >
                <MessageSquarePlus className="size-3.5" aria-hidden />
                <span>Hỏi Bác sĩ →</span>
              </Link>

              <button
                type="button"
                onClick={() => setShowSaveDrawer((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE6DF] bg-white px-3 py-1.5 text-xs font-medium text-[#262624] hover:bg-[#F5FAF7] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16A34A]"
              >
                <Database className="size-3.5 text-[#575652]" aria-hidden />
                <span>Lưu</span>
              </button>

              <a
                href={`/api/qeeg/export-pdf-summary?caseId=${encodeURIComponent(analysis.caseId)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE6DF] bg-white px-3 py-1.5 text-xs font-medium text-[#262624] hover:bg-[#F5FAF7] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16A34A]"
              >
                <FileDown className="size-3.5 text-[#575652]" aria-hidden />
                <span>PDF</span>
              </a>

              <a
                href={`/clinical-workstation?mode=${isProfessional ? 'professional' : 'general'}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE6DF] bg-white px-3 py-1.5 text-xs font-medium text-[#262624] hover:bg-[#F5FAF7] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16A34A]"
              >
                <ExternalLink className="size-3.5 text-[#575652]" aria-hidden />
                <span>Toàn màn hình</span>
              </a>
            </div>
          </div>

          {/* Save to Platform (Neural DB + Personal Dataset) Form */}
          {showSaveDrawer && (
            <Card className="p-5 border-[#DCE6DF] bg-[#F5FAF7] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[#141413]">
                  Lưu kết quả đo sóng não
                </h4>
                <button
                  type="button"
                  onClick={() => setShowSaveDrawer(false)}
                  className="text-xs font-medium text-[#6E6D68] hover:text-[#141413]"
                >
                  Đóng
                </button>
              </div>
              <form onSubmit={handleSaveSubmit} className="grid gap-3 sm:grid-cols-4 text-xs">
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
                    Mã Đối tượng Ẩn danh
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
                    Tập Chia (Split)
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

                <div className="sm:col-span-2 space-y-1">
                  <label htmlFor="save-qeeg-cat" className="font-semibold text-[#262624] block">
                    Nhóm Chuyên khoa
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

                <div className="sm:col-span-2 space-y-1">
                  <label htmlFor="save-qeeg-label" className="font-semibold text-[#262624] block">
                    Nhãn Chuẩn Đề xuất (Ground Truth)
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

                <div className="sm:col-span-4 space-y-1">
                  <label htmlFor="save-qeeg-note" className="font-semibold text-[#262624] block">
                    Ghi chú Lâm sàng
                  </label>
                  <Textarea
                    id="save-qeeg-note"
                    rows={2}
                    value={saveNote}
                    onChange={(e) => setSaveNote(e.target.value)}
                    className="bg-white"
                  />
                </div>

                <div className="sm:col-span-4 flex flex-wrap items-center justify-between gap-3 pt-1">
                  <label htmlFor="save-qeeg-deid" className="inline-flex items-center gap-2 font-medium text-[#262624] cursor-pointer">
                    <input
                      id="save-qeeg-deid"
                      type="checkbox"
                      checked={deidentifiedConfirmed}
                      onChange={(e) => setDeidentifiedConfirmed(e.target.checked)}
                      className="size-4 rounded border-[#DCE6DF] accent-[#16A34A] text-[#16A34A]"
                    />
                    <span>
                      Xác nhận đã ẩn danh bệnh nhân (thông tin cá nhân)
                    </span>
                  </label>

                  <Button
                    type="submit"
                    size="sm"
                    variant="primary"
                    loading={saveToPlatformMutation.isPending}
                    icon={<CheckCircle2 className="size-3.5" aria-hidden />}
                  >
                    Xác nhận Lưu
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* 12-col grid: waveform (8 cols) + topomap+biomarkers (4 cols) */}
          <div className="grid gap-4 lg:grid-cols-12 items-start">
            {/* Left 8 cols: Waveform */}
            <div className="lg:col-span-8 min-w-0">
              <BrainWaveformViewer
                waveforms={analysis.waveforms}
                samplingRateHz={analysis.samplingRateHz}
                isProfessional={isProfessional}
                title={`Tín hiệu Điện não ${analysis.channelsCount} Kênh (${analysis.samplingRateHz} Hz)`}
                subtitle={`${analysis.channelsCount} kênh · ${analysis.samplingRateHz} Hz`}
              />
            </div>

            {/* Right 4 cols: Topomap + 3 plain-language biomarker cards */}
            <div className="lg:col-span-4 min-w-0 space-y-3">
              <CorticalTopomap2D
                nodes={analysis.topomap}
                meanBsi={analysis.biomarkers.meanBsi}
                meanDar={analysis.biomarkers.meanDar}
                trafficLight={analysis.trafficLight}
                isProfessional={isProfessional}
              />

              {/* 1 grouped clinical biomarker card */}
              <div className="rounded-xl border border-[#DCE6DF] bg-white divide-y divide-[#DCE6DF] text-xs">
                {/* DAR */}
                <div className="px-4 py-3 flex items-center justify-between gap-2">
                  <div>
                    <span className="block font-medium text-[#141413]">
                      {isProfessional ? 'Mức sóng chậm (DAR)' : 'Chỉ số sóng chậm'}
                    </span>
                    <span className="text-[11px] text-[#6E6D68]">
                      {isProfessional
                        ? analysis.biomarkers.meanDar > 1.5
                          ? 'Tăng cao'
                          : 'Bình thường'
                        : analysis.biomarkers.meanDar > 1.5
                          ? 'Tăng cao · Sóng chậm nhiều hơn bình thường'
                          : 'Bình thường · Hoạt động não ổn định'}
                    </span>
                  </div>
                  <span className="font-mono text-base font-semibold text-[#141413] tabular-nums">
                    {analysis.biomarkers.meanDar.toFixed(2)}
                  </span>
                </div>

                {/* BSI */}
                <div className="px-4 py-3 flex items-center justify-between gap-2">
                  <div>
                    <span className="block font-medium text-[#141413]">
                      {isProfessional ? 'Cân bằng Trái – Phải (BSI)' : 'Cân bằng 2 bán cầu'}
                    </span>
                    <span className="text-[11px] text-[#6E6D68]">
                      {isProfessional
                        ? analysis.biomarkers.meanBsi > 0.15
                          ? 'Lệch bán cầu'
                          : 'Cân đối'
                        : analysis.biomarkers.meanBsi > 0.15
                          ? 'Có chênh lệch giữa trái và phải'
                          : 'Cân đối · Hai bên não đồng đều'}
                    </span>
                  </div>
                  <span className="font-mono text-base font-semibold text-[#141413] tabular-nums">
                    {analysis.biomarkers.meanBsi.toFixed(3)}
                  </span>
                </div>

                {/* Alpha Peak */}
                <div className="px-4 py-3 flex items-center justify-between gap-2">
                  <div>
                    <span className="block font-medium text-[#141413]">
                      {isProfessional ? 'Nhịp Tỉnh táo Alpha' : 'Nhịp thư thái'}
                    </span>
                    <span className="text-[11px] text-[#6E6D68]">
                      {isProfessional
                        ? analysis.biomarkers.alphaPeakHz >= 9
                          ? 'Tốt'
                          : 'Đang mỏi não'
                        : analysis.biomarkers.alphaPeakHz >= 9
                          ? 'Tốt · Nhịp nghỉ ngơi rõ nét'
                          : 'Đang mỏi não · Nhịp thư giãn chậm'}
                    </span>
                  </div>
                  <span className="font-mono text-base font-semibold text-[#141413] tabular-nums">
                    {analysis.biomarkers.alphaPeakHz.toFixed(1)} Hz
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Deep metrics — collapsed by default in General, open in Professional */}
          <details open={isProfessional} className="rounded-xl border border-[#DCE6DF] bg-[#F5FAF7]">
            <summary className="cursor-pointer px-4 py-2.5 text-xs font-semibold text-[#262624] hover:text-[#141413] rounded-xl">
              Thông số chuyên sâu ▾
            </summary>
            <div className="px-4 pb-4 pt-2 space-y-4">
              {/* Full biomarker numbers */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono tabular-nums">
                {(isProfessional
                  ? [
                      { label: 'DAR', val: analysis.biomarkers.meanDar.toFixed(2), sub: 'Chuẩn < 1.50' },
                      { label: 'BSI', val: analysis.biomarkers.meanBsi.toFixed(3), sub: 'Ngưỡng > 0.150' },
                      { label: 'TAR', val: analysis.biomarkers.meanTar.toFixed(2), sub: 'Mệt mỏi nhận thức' },
                      { label: 'wPLI', val: analysis.biomarkers.wpli.toFixed(2), sub: `PRI: ${analysis.biomarkers.pri.toFixed(2)}` },
                      { label: 'Alpha IAF', val: `${analysis.biomarkers.alphaPeakHz.toFixed(1)} Hz`, sub: `Chất lượng: ${(analysis.biomarkers.signalQualityScore * 100).toFixed(0)}%` },
                      {
                        label: 'Khóa tPA / CT khẩn',
                        val: analysis.biomarkers.tpaLockoutTriggered
                          ? 'Khóa an toàn'
                          : analysis.biomarkers.cusumAlarm
                            ? 'Cảnh báo sớm'
                            : 'Bình thường',
                        sub: analysis.safetyStatus,
                      },
                    ]
                  : [
                      {
                        label: 'Chỉ số sóng chậm',
                        val: analysis.biomarkers.meanDar.toFixed(2),
                        sub: analysis.biomarkers.meanDar > 1.5 ? 'Tăng cao (chuẩn < 1.50)' : 'Ổn định (chuẩn < 1.50)',
                      },
                      {
                        label: 'Cân bằng 2 bán cầu',
                        val: analysis.biomarkers.meanBsi.toFixed(3),
                        sub: analysis.biomarkers.meanBsi > 0.15 ? 'Có chênh lệch trái – phải' : 'Hai bên cân đối',
                      },
                      {
                        label: 'Chỉ số mệt mỏi',
                        val: analysis.biomarkers.meanTar.toFixed(2),
                        sub: 'Tỷ lệ sóng buồn ngủ / tập trung',
                      },
                      {
                        label: 'Kết nối vùng não',
                        val: analysis.biomarkers.wpli.toFixed(2),
                        sub: 'Độ đồng bộ tín hiệu giữa các vùng',
                      },
                      {
                        label: 'Nhịp thư thái',
                        val: `${analysis.biomarkers.alphaPeakHz.toFixed(1)} Hz`,
                        sub: `Độ rõ tín hiệu: ${(analysis.biomarkers.signalQualityScore * 100).toFixed(0)}%`,
                      },
                      {
                        label: 'An toàn',
                        val: analysis.biomarkers.tpaLockoutTriggered
                          ? 'Khóa an toàn'
                          : analysis.biomarkers.cusumAlarm
                            ? 'Cảnh báo sớm'
                            : 'Bình thường',
                        sub: analysis.safetyStatus,
                      },
                    ]
                ).map((b) => (
                  <div key={b.label} className="rounded-lg border border-[#DCE6DF] bg-white p-3">
                    <span className="block text-[10px] font-sans font-medium text-[#6E6D68]">{b.label}</span>
                    <strong className="text-base font-semibold text-[#141413]">{b.val}</strong>
                    <span className="block text-[10px] font-sans text-[#6E6D68]">{b.sub}</span>
                  </div>
                ))}
              </div>

              {/* Band powers + probabilities */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="p-4 border-[#DCE6DF] space-y-2.5 text-xs">
                  <h4 className="font-semibold text-[#141413]">Phổ Công suất 4 Dải tần (PSD)</h4>
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

              {analysis.biomarkers.tpaLockoutTriggered && (
                <div className="rounded-lg border border-red-200 bg-red-50/70 px-3.5 py-2.5 flex items-start gap-2 text-xs text-red-900">
                  <AlertTriangle className="size-4 text-red-700 shrink-0 mt-0.5" aria-hidden />
                  <span>
                    Cảnh báo An toàn: Cổng kiểm soát xuất huyết não đã kích hoạt khóa tPA đơn độc. Mọi quyết định tiêu sợi huyết bắt buộc đối chiếu CT sọ não không cản quang tại bệnh viện.
                  </span>
                </div>
              )}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
