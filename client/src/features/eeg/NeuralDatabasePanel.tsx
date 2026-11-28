import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Copy,
  Database,
  Download,
  Eye,
  FileCode2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { neuralDbApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type {
  DatasetSplit,
  NeuralLabel,
  NeuralTrainingSampleItem,
} from '../../api/types';
import { Alert, Button, Card, EmptyState, Spinner, cn } from '../../components/ui';
import { useMode } from '../../context/ModeContext';
import { useAuth } from '../auth/AuthContext';
import { BrainWaveformViewer } from './BrainWaveformViewer';
import {
  CLINICAL_CATEGORY_META,
  CLINICAL_CATEGORY_ORDER,
  DATASET_SPLIT_META,
  DATASET_SPLIT_ORDER,
  NEURAL_LABEL_META,
  NEURAL_LABEL_ORDER,
  sanitizeClinicalDisplayText,
} from './eegLabels';

export interface NeuralDatabasePanelProps {
  isProfessional?: boolean;
}

const FEATURE_GROUPS = [
  { start: 0, end: 60, title: 'F01–F60 · Đặc trưng phổ, tỷ số & Hjorth trên 6 kênh' },
  { start: 60, end: 66, title: 'F61–F66 · Bất đối xứng cặp kênh' },
  { start: 66, end: 72, title: 'F67–F72 · Liên kết pha wPLI cặp kênh' },
  { start: 72, end: 80, title: 'F73–F80 · Chỉ số tổng hợp toàn cục & chất lượng tín hiệu' },
];

export function NeuralDatabasePanel({ isProfessional = false }: NeuralDatabasePanelProps) {
  const { user } = useAuth();
  const { isVerifiedHCP } = useMode();
  const queryClient = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [labelFilter, setLabelFilter] = useState<string>('');
  const [splitFilter, setSplitFilter] = useState<string>('');
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [inspectedSample, setInspectedSample] = useState<NeuralTrainingSampleItem | null>(null);
  const [verifyLabel, setVerifyLabel] = useState<NeuralLabel>('CONTROL');
  const [verifySplit, setVerifySplit] = useState<DatasetSplit>('TRAIN');
  const [copiedVector, setCopiedVector] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const statsQuery = useQuery({
    queryKey: ['neural-db-stats'],
    queryFn: () => neuralDbApi.getStats(),
    enabled: Boolean(user),
  });

  const samplesQuery = useQuery({
    queryKey: ['neural-db-samples', categoryFilter, labelFilter, splitFilter, verifiedOnly],
    queryFn: () =>
      neuralDbApi.listSamples({
        clinicalCategory: categoryFilter || undefined,
        groundTruthLabel: labelFilter || undefined,
        split: splitFilter || undefined,
        verifiedOnly: verifiedOnly || undefined,
      }),
    enabled: Boolean(user),
  });

  const verifyMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      groundTruthLabel?: NeuralLabel;
      split?: DatasetSplit;
    }) =>
      neuralDbApi.verifySample(payload.id, {
        groundTruthLabel: payload.groundTruthLabel,
        split: payload.split,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['neural-db-samples'] });
      queryClient.invalidateQueries({ queryKey: ['neural-db-stats'] });
      if (inspectedSample && inspectedSample.id === res.sample.id) {
        setInspectedSample(res.sample);
      }
      setFeedback({
        tone: 'success',
        text: `Đã xác minh nhãn chuẩn "${NEURAL_LABEL_META[res.sample.groundTruthLabel].shortLabel}" cho mẫu ${res.sample.subjectCode} (${res.sample.split}).`,
      });
    },
    onError: (err) => {
      setFeedback({ tone: 'error', text: errorMessage(err) });
    },
  });

  const openInspection = (sample: NeuralTrainingSampleItem) => {
    setInspectedSample(sample);
    setVerifyLabel(sample.groundTruthLabel);
    setVerifySplit(sample.split);
    setCopiedVector(false);
  };

  const handleCopyVector = async (vec: number[]) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(vec));
      setCopiedVector(true);
      setTimeout(() => setCopiedVector(false), 2000);
    } catch {
      // Ignore clipboard failure in constrained context
    }
  };

  const stats = statsQuery.data;
  const samples = samplesQuery.data?.samples ?? [];
  const totalCount = Math.max(stats?.totalSamples ?? 0, 1);

  const exportCsvHref = neuralDbApi.exportUrl('csv', {
    clinicalCategory: categoryFilter || undefined,
    split: splitFilter || undefined,
  });
  const exportJsonlHref = neuralDbApi.exportUrl('jsonl', {
    clinicalCategory: categoryFilter || undefined,
    split: splitFilter || undefined,
  });

  const labelDistributionSummary = stats ? (
    <details className="pt-2 border-t border-slate-100 text-xs">
      <summary className="cursor-pointer font-semibold text-slate-600 hover:text-slate-900 select-none">
        Phân bố 5 nhãn (Lớp 0 → 4) ▾
      </summary>
      <div className="grid gap-2 sm:grid-cols-5 pt-2.5">
        {NEURAL_LABEL_ORDER.map((lbl) => {
          const count = stats.byLabel[lbl] ?? 0;
          const pct = Math.round((count / totalCount) * 100);
          const meta = NEURAL_LABEL_META[lbl];
          return (
            <div key={lbl} className="rounded border border-slate-200 bg-slate-50/70 p-2 space-y-1">
              <div className="flex items-center justify-between gap-1 text-[11px]">
                <span className="font-semibold text-slate-700 truncate">
                  [{meta.numericId}] {meta.shortLabel}
                </span>
                <span className="font-mono font-bold text-slate-900 tabular-nums shrink-0">
                  {count} ({pct}%)
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-200/70 overflow-hidden">
                <div
                  className={cn('h-full rounded-full', meta.barCls)}
                  style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </details>
  ) : null;

  return (
    <div className="space-y-4">
      {/* Header & Direct Export Actions */}
      <Card
        className={cn(
          'p-4 space-y-3',
          isProfessional ? 'border-slate-300' : 'border-teal-200/80',
        )}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database
              className={cn('size-5', isProfessional ? 'text-[#1E3A5F]' : 'text-teal-700')}
              aria-hidden
            />
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Dữ liệu huấn luyện AI
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={exportCsvHref}
              download
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50 shadow-2xs transition-colors"
            >
              <Download className="size-3.5 text-teal-700" aria-hidden />
              <span>Xuất bảng số liệu (.csv)</span>
            </a>
            <a
              href={exportJsonlHref}
              download
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition-colors',
                isProfessional ? 'bg-[#162B47] hover:bg-[#1e3a5f]' : 'bg-teal-700 hover:bg-teal-800',
              )}
            >
              <FileCode2 className="size-3.5" aria-hidden />
              <span>Xuất dữ liệu huấn luyện</span>
            </a>
          </div>
        </div>

        {/* Unified Horizontal Summary Strip (6 KPI + 4 Splits) */}
        {stats && (
          <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono tabular-nums">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1">
                <span className="font-sans text-[11px] text-slate-500">Tổng:</span>
                <strong className="text-slate-900">{stats.totalSamples}</strong>
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50/70 px-2 py-1">
                <span className="font-sans text-[11px] text-emerald-800">Duyệt:</span>
                <strong className="text-emerald-900">
                  {stats.verifiedSamples}/{stats.totalSamples}
                </strong>
              </span>
              <span className="text-slate-700">
                DAR <strong className="text-slate-900">{stats.averages.dar.toFixed(2)}</strong>
              </span>
              <span className="text-slate-700">
                BSI <strong className="text-slate-900">{stats.averages.bsi.toFixed(3)}</strong>
              </span>
              <span className="text-slate-700">
                TAR <strong className="text-slate-900">{stats.averages.tar.toFixed(2)}</strong>
              </span>
              <span className="text-slate-700">
                wPLI <strong className="text-slate-900">{stats.averages.wpli.toFixed(2)}</strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {DATASET_SPLIT_ORDER.map((sp) => {
                const count = stats.bySplit[sp] ?? 0;
                const meta = DATASET_SPLIT_META[sp];
                return (
                  <span
                    key={sp}
                    className={cn(
                      'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10.5px] font-bold',
                      meta.badgeCls,
                    )}
                  >
                    <span>{meta.shortLabel}</span>
                    <span>{count}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {labelDistributionSummary}
      </Card>

      {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}

      {/* Filters Bar */}
      <Card className="p-4 border-slate-200/90">
        <div className="grid gap-3 sm:grid-cols-4 items-end text-xs">
          <div className="space-y-1">
            <label htmlFor="ndb-filter-cat" className="font-bold text-slate-700 block">
              Nhóm Bệnh lý
            </label>
            <select
              id="ndb-filter-cat"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800"
            >
              <option value="">Tất cả 4 nhóm chuyên khoa</option>
              {CLINICAL_CATEGORY_ORDER.map((cat) => (
                <option key={cat} value={cat}>
                  {CLINICAL_CATEGORY_META[cat].label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="ndb-filter-label" className="font-bold text-slate-700 block">
              Nhãn chuẩn
            </label>
            <select
              id="ndb-filter-label"
              value={labelFilter}
              onChange={(e) => setLabelFilter(e.target.value)}
              className="h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800"
            >
              <option value="">Tất cả 5 nhãn</option>
              {NEURAL_LABEL_ORDER.map((lbl) => (
                <option key={lbl} value={lbl}>
                  {NEURAL_LABEL_META[lbl].label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="ndb-filter-split" className="font-bold text-slate-700 block">
              Tập dữ liệu đã phân chia
            </label>
            <select
              id="ndb-filter-split"
              value={splitFilter}
              onChange={(e) => setSplitFilter(e.target.value)}
              className="h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800"
            >
              <option value="">Tất cả tập dữ liệu</option>
              {DATASET_SPLIT_ORDER.map((sp) => (
                <option key={sp} value={sp}>
                  {DATASET_SPLIT_META[sp].label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center h-9.5 px-2">
            <label htmlFor="ndb-filter-verified" className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
              <input
                id="ndb-filter-verified"
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="size-4 rounded border-slate-300 text-teal-700"
              />
              <span>Chỉ mẫu đã duyệt</span>
            </label>
          </div>
        </div>
      </Card>

      {/* Samples Table */}
      <Card className="p-0 overflow-hidden border-slate-300 shadow-2xs">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
          <h3 className="text-xs sm:text-sm font-bold text-slate-900">
            Dữ liệu sóng não chuẩn hóa ({samples.length})
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            Đã ẩn danh cá nhân
          </span>
        </div>

        {samplesQuery.isLoading ? (
          <Spinner label="Đang tải mẫu huấn luyện mạng nơ-ron..." />
        ) : samplesQuery.isError ? (
          <div className="p-4">
            <Alert tone="error">{errorMessage(samplesQuery.error)}</Alert>
          </div>
        ) : samples.length === 0 ? (
          <EmptyState
            icon={<Database className="size-6" />}
            title="Không có mẫu dữ liệu khớp bộ lọc"
            description="Đổi bộ lọc hoặc lưu mẫu mới từ tab Đo & Đọc kết quả."
          />
        ) : (
          <div
            tabIndex={0}
            role="region"
            aria-label="Bảng mẫu dữ liệu huấn luyện mạng nơ-ron có thể cuộn ngang bằng bàn phím"
            className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-[#2b4c7e]"
          >
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/80 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-2.5 px-3.5">Mã mẫu</th>
                  <th className="py-2.5 px-3.5">Nhóm bệnh lý</th>
                  <th className="py-2.5 px-3.5">Nhãn chuẩn</th>
                  <th className="py-2.5 px-3.5">Tập dữ liệu</th>
                  <th className="py-2.5 px-3.5 text-right">DAR</th>
                  <th className="py-2.5 px-3.5 text-right">BSI</th>
                  <th className="py-2.5 px-3.5 text-right">TAR</th>
                  <th className="py-2.5 px-3.5 text-right">wPLI</th>
                  <th className="py-2.5 px-3.5">Xác minh</th>
                  <th className="py-2.5 px-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {samples.map((sample) => {
                  const catMeta = CLINICAL_CATEGORY_META[sample.clinicalCategory];
                  const lblMeta = NEURAL_LABEL_META[sample.groundTruthLabel];
                  const splitMeta = DATASET_SPLIT_META[sample.split];
                  return (
                    <tr key={sample.id} className="hover:bg-slate-50/90">
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="font-mono font-bold text-[#1E3A5F]">{sample.subjectCode}</div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {sample.channelsCount}ch · {sample.samplingRateHz}Hz · Q={(sample.signalQualityScore * 100).toFixed(0)}%
                        </div>
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex rounded border px-2 py-0.5 text-[10.5px] font-bold',
                            catMeta.badgeCls,
                          )}
                        >
                          {catMeta.shortLabel}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex rounded border px-2 py-0.5 text-[10.5px] font-bold',
                            lblMeta.badgeCls,
                          )}
                        >
                          {lblMeta.shortLabel}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex rounded border px-2 py-0.5 text-[10.5px] font-mono font-bold',
                            splitMeta.badgeCls,
                          )}
                        >
                          {splitMeta.shortLabel}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {sample.dar.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-slate-800 tabular-nums">
                        {sample.bsi.toFixed(3)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono text-slate-700 tabular-nums">
                        {sample.tar.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono text-slate-700 tabular-nums">
                        {sample.wpli.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        {sample.verifiedBy ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10.5px] font-bold text-emerald-800">
                            <CheckCircle2 className="size-3" aria-hidden />
                            @{sample.verifiedBy.username}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Chờ duyệt nhãn</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={() => openInspection(sample)}
                            icon={<Eye className="size-3" aria-hidden />}
                          >
                            Xem chi tiết mẫu
                          </Button>
                          {isVerifiedHCP && !sample.verifiedById && (
                            <Button
                              type="button"
                              size="xs"
                              variant="accent"
                              loading={verifyMutation.isPending}
                              onClick={() => verifyMutation.mutate({ id: sample.id })}
                              icon={<ShieldCheck className="size-3" aria-hidden />}
                            >
                              Xác minh
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 80-Feature Vector & Sample Inspection Modal */}
      {inspectedSample && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="neural-sample-dialog-title"
        >
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-slate-300 bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-[#162B47] px-5 py-3.5 text-white">
              <div>
                <h3 id="neural-sample-dialog-title" className="text-sm sm:text-base font-bold">
                  Chi tiết mẫu sóng não: {sanitizeClinicalDisplayText(inspectedSample.subjectCode)}
                </h3>
                <p className="text-[11px] text-slate-300 font-mono">
                  {inspectedSample.montage} · {inspectedSample.samplingRateHz} Hz · Dữ liệu sóng não chuẩn hóa
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedSample(null)}
                aria-label="Đóng hộp thoại kiểm tra đặc trưng"
                className="rounded-md p-1.5 text-slate-200 hover:bg-white/10 hover:text-white"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Metadata + Spectral Bands */}
              <div className="grid gap-3 sm:grid-cols-4 text-xs font-mono tabular-nums">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <span className="block text-[10px] font-sans text-slate-500">Delta (0.5–4 Hz)</span>
                  <strong className="text-sm text-slate-900">
                    {(inspectedSample.spectralBands.delta * 100).toFixed(1)}%
                  </strong>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <span className="block text-[10px] font-sans text-slate-500">Theta (4–8 Hz)</span>
                  <strong className="text-sm text-slate-900">
                    {(inspectedSample.spectralBands.theta * 100).toFixed(1)}%
                  </strong>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <span className="block text-[10px] font-sans text-slate-500">Alpha (8–13 Hz)</span>
                  <strong className="text-sm text-teal-700">
                    {(inspectedSample.spectralBands.alpha * 100).toFixed(1)}%
                  </strong>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <span className="block text-[10px] font-sans text-slate-500">Beta (13–30 Hz)</span>
                  <strong className="text-sm text-slate-900">
                    {(inspectedSample.spectralBands.beta * 100).toFixed(1)}%
                  </strong>
                </div>
              </div>

              {/* Waveform Preview */}
              {inspectedSample.waveformPreview &&
                inspectedSample.waveformPreview.time.length > 1 && (
                  <BrainWaveformViewer
                    waveforms={inspectedSample.waveformPreview}
                    samplingRateHz={inspectedSample.samplingRateHz}
                    isProfessional={isProfessional}
                    title={`Đoạn sóng trích xuất (${inspectedSample.subjectCode})`}
                  />
                )}

              {/* Expert Verification Panel (for Verified Professionals) */}
              {isVerifiedHCP && (
                <div className="rounded-lg border border-teal-200 bg-[#F0FDFA] p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-teal-950">
                    <ShieldCheck className="size-4 text-teal-700" aria-hidden />
                    <span>Thẩm định nhãn chuyên gia</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 items-end text-xs">
                    <div className="space-y-1">
                      <label htmlFor="verify-label-select" className="font-bold text-slate-700 block">
                        Nhãn Chuẩn
                      </label>
                      <select
                        id="verify-label-select"
                        value={verifyLabel}
                        onChange={(e) => setVerifyLabel(e.target.value as NeuralLabel)}
                        className="h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900"
                      >
                        {NEURAL_LABEL_ORDER.map((lbl) => (
                          <option key={lbl} value={lbl}>
                            {NEURAL_LABEL_META[lbl].label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="verify-split-select" className="font-bold text-slate-700 block">
                        Tập dữ liệu đã phân chia
                      </label>
                      <select
                        id="verify-split-select"
                        value={verifySplit}
                        onChange={(e) => setVerifySplit(e.target.value as DatasetSplit)}
                        className="h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900"
                      >
                        {DATASET_SPLIT_ORDER.map((sp) => (
                          <option key={sp} value={sp}>
                            {DATASET_SPLIT_META[sp].label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="accent"
                      loading={verifyMutation.isPending}
                      onClick={() =>
                        verifyMutation.mutate({
                          id: inspectedSample.id,
                          groundTruthLabel: verifyLabel,
                          split: verifySplit,
                        })
                      }
                      icon={<CheckCircle2 className="size-3.5" aria-hidden />}
                    >
                      Xác nhận & Khóa Nhãn Chuẩn
                    </Button>
                  </div>
                </div>
              )}

              {/* 80-Feature Vector Matrix */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                    Dữ liệu sóng não chuẩn hóa ({inspectedSample.featureVector.length} chỉ số)
                  </h4>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => handleCopyVector(inspectedSample.featureVector)}
                    icon={<Copy className="size-3" aria-hidden />}
                  >
                    {copiedVector ? 'Đã sao chép dữ liệu' : 'Sao chép dữ liệu mẫu'}
                  </Button>
                </div>

                <div className="space-y-3">
                  {FEATURE_GROUPS.map((grp) => {
                    const slice = inspectedSample.featureVector.slice(grp.start, grp.end);
                    if (slice.length === 0) return null;
                    return (
                      <div key={grp.title} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                        <div className="text-[11px] font-bold text-slate-700">{grp.title}</div>
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-10 gap-1.5 font-mono tabular-nums text-[10.5px]">
                          {slice.map((val, offset) => {
                            const fIndex = grp.start + offset + 1;
                            return (
                              <div
                                key={fIndex}
                                className="rounded border border-slate-200 bg-white px-1.5 py-1 text-center"
                                title={`Feature ${fIndex}: ${val}`}
                              >
                                <span className="block text-[9px] text-slate-400">
                                  F{String(fIndex).padStart(2, '0')}
                                </span>
                                <span className="font-semibold text-slate-900">
                                  {Number(val).toFixed(3)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
