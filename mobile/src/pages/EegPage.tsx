import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Battery,
  Camera,
  Check,
  ChevronDown,
  Cpu,
  FileUp,
  Plus,
  Radio,
  Stethoscope,
  Wifi,
  X,
} from 'lucide-react';
import { devicesApi, eegDatasetsApi, qeegApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type { EegDatasetRecord, QeegAnalysisResult } from '../api/types';
import { useMode } from '../context/ModeContext';
import { CompactTopomap } from '../components/CompactTopomap';
import { CompactWaveform } from '../components/CompactWaveform';
import { BottomSheet, EmptyView, PillTabs, Spinner, cn } from '../components/ui';

type EegSubTab = 'analyze' | 'device' | 'saved';

const GENERAL_CASES = [
  { id: 'case_healthy_alpha', label: 'Ổn định' },
  { id: 'case_sleep_fatigue_n3', label: 'Thiếu ngủ' },
  { id: 'case_epilepsy_temporal', label: 'Động kinh' },
  { id: 'case_ischemia_lvo', label: 'Đột quỵ' },
];

const PRO_CASES = [
  { id: 'case_ischemia_lvo', label: 'LVO Trái' },
  { id: 'case_ich_hemorrhage', label: 'ICH · Khóa tPA' },
  { id: 'case_epilepsy_temporal', label: 'Động kinh' },
  { id: 'case_sleep_fatigue_n3', label: 'Ngủ N3' },
  { id: 'case_healthy_alpha', label: 'Alpha chuẩn' },
  { id: 'case_ads1299_hardware', label: 'ADS1299' },
];

function trafficMeta(light: QeegAnalysisResult['trafficLight'], isPro: boolean) {
  if (light === 'purple') {
    return {
      dot: 'bg-red-700',
      pill: 'bg-red-50 text-red-800 border-red-200',
      text: isPro ? 'Chống chỉ định tPA' : 'Cần cấp cứu 115',
    };
  }
  if (light === 'red') {
    return {
      dot: 'bg-red-600',
      pill: 'bg-red-50 text-red-700 border-red-200',
      text: isPro ? 'Nghi đột quỵ cấp' : 'Cảnh báo khẩn',
    };
  }
  if (light === 'yellow') {
    return {
      dot: 'bg-amber-500',
      pill: 'bg-amber-50 text-amber-800 border-amber-200',
      text: isPro ? 'Theo dõi chuyên khoa' : 'Cần lưu ý',
    };
  }
  return {
    dot: 'bg-[#16A34A]',
    pill: 'bg-[#ECFDF3] text-[#15803D] border-[#BBF7D0]',
    text: 'Ổn định',
  };
}

function buildDatasetPreview(rec: EegDatasetRecord) {
  const n = 200;
  const time = Array.from({ length: n }, (_, i) => Number(((i / (n - 1)) * 4).toFixed(3)));
  const channels = ['F3', 'F4', 'C3', 'C4', 'O1', 'O2'];
  const slow = rec.status === 'REVIEW_PENDING' || /giấc ngủ|động kinh/i.test(rec.title);
  const filtered: Record<string, number[]> = {};
  channels.forEach((ch, ci) => {
    filtered[ch] = time.map((t) =>
      Number(
        (
          (slow ? 28 : 8) * Math.sin(2 * Math.PI * 1.8 * t + ci) +
          (ch.startsWith('O') ? 24 : 13) * Math.sin(2 * Math.PI * 10.1 * t + ci * 0.4)
        ).toFixed(2),
      ),
    );
  });
  return { time, channels, filtered };
}

function buildDeviceWaveform(
  bufferedSamples: number[][] | undefined,
  sampleRateSps: number,
  pulse: number,
) {
  const channels = ['F3', 'F4', 'C3', 'C4', 'O1', 'O2'];
  if (bufferedSamples && bufferedSamples.length >= 20) {
    const slice = bufferedSamples.slice(-250);
    const rate = sampleRateSps || 500;
    const time = slice.map((_, i) => Number((i / rate).toFixed(3)));
    const filtered: Record<string, number[]> = {};
    channels.forEach((ch, ci) => {
      filtered[ch] = slice.map((row) => Number((row[ci] ?? 0).toFixed(2)));
    });
    return { time, channels, filtered };
  }

  const n = 200;
  const time = Array.from({ length: n }, (_, i) => Number(((i / (n - 1)) * 2).toFixed(3)));
  const phaseShift = pulse * 0.65;
  const filtered: Record<string, number[]> = {};
  channels.forEach((ch, ci) => {
    filtered[ch] = time.map((t) =>
      Number(
        (
          (ch.startsWith('O') ? 22 : 12) * Math.sin(2 * Math.PI * 10.0 * t + ci * 0.45 + phaseShift) +
          7 * Math.sin(2 * Math.PI * 18.0 * t + ci + phaseShift * 0.5)
        ).toFixed(2),
      ),
    );
  });
  return { time, channels, filtered };
}

function formatRatio(val: number): string {
  if (!Number.isFinite(val)) return '--';
  if (val >= 1000) return '>999';
  if (val >= 100) return val.toFixed(0);
  return val.toFixed(2);
}

function formatAiState(state?: string | null): string {
  if (!state) return 'Sẵn sàng';
  const upper = state.toUpperCase();
  if (upper === 'NORMAL') return 'Ổn định';
  if (upper === 'WARNING') return 'Cần lưu ý';
  if (upper === 'ALERT' || upper === 'STROKE_ALERT') return 'Cảnh báo';
  if (upper === 'CRITICAL') return 'Nguy kịch';
  if (upper === 'ONLINE') return 'Trực tuyến';
  if (upper === 'STREAMING') return 'Đang đo';
  if (upper === 'IDLE') return 'Sẵn sàng';
  if (upper === 'OFFLINE') return 'Ngoại tuyến';
  return state;
}

function formatPlainAlertMessage(message: string): string {
  return message
    .replace(/\bTI\s+ADS1299\b/gi, 'cảm biến sóng não')
    .replace(/\bESP32[-_]?ADS1299(?:_V\d+)?\b/gi, 'thiết bị đo')
    .replace(/\bADS1299\b/gi, 'thiết bị đo')
    .replace(/\s*\(CH\d+\)/gi, '');
}

export function EegPage() {
  const { isProfessional } = useMode();
  const queryClient = useQueryClient();
  const [subTab, setSubTab] = useState<EegSubTab>('analyze');
  const [caseId, setCaseId] = useState<string>(isProfessional ? 'case_ischemia_lvo' : 'case_healthy_alpha');
  const [analysisSource, setAnalysisSource] = useState<'case' | 'csv'>('case');
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<QeegAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showTopomap, setShowTopomap] = useState(isProfessional);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const loadedCaseRef = useRef<string | null>(null);

  // Device & saved feedback
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [deviceNotice, setDeviceNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [demoStreaming, setDemoStreaming] = useState(false);
  const [deviceWaveVisible, setDeviceWaveVisible] = useState(false);
  const [deviceWavePulse, setDeviceWavePulse] = useState(0);

  // Saved datasets modal
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null);
  const [addRecOpen, setAddRecOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newNote, setNewNote] = useState('');
  const [recErr, setRecErr] = useState<string | null>(null);

  // Keep preset valid when switching mode
  useEffect(() => {
    const validList = isProfessional ? PRO_CASES : GENERAL_CASES;
    if (!validList.some((c) => c.id === caseId)) {
      setCaseId(validList[0]!.id);
    }
  }, [isProfessional, caseId]);

  // Run qEEG analysis for built-in case without wiping uploaded CSV across tab switches
  useEffect(() => {
    if (subTab !== 'analyze' || analysisSource !== 'case') return;
    if (loadedCaseRef.current === caseId && analysis) return;
    let alive = true;
    setAnalyzing(true);
    setErr(null);
    qeegApi
      .analyzeCase({ caseId, timeWindowSec: 5, notch50Hz: true })
      .then((res) => {
        if (alive) {
          loadedCaseRef.current = caseId;
          setAnalysis(res);
        }
      })
      .catch((e) => {
        if (alive) setErr(errorMessage(e));
      })
      .finally(() => {
        if (alive) setAnalyzing(false);
      });
    return () => {
      alive = false;
    };
  }, [caseId, subTab, analysisSource]);

  const devicesQuery = useQuery({
    queryKey: ['devices'],
    queryFn: () => devicesApi.list(),
    enabled: subTab === 'device',
    refetchInterval: subTab === 'device' ? 6000 : false,
  });

  const savedQuery = useQuery({
    queryKey: ['eeg-datasets', isProfessional ? 'workspace' : 'my'],
    queryFn: () =>
      isProfessional ? eegDatasetsApi.getWorkspaceDatasets() : eegDatasetsApi.getMyDatasets(),
    enabled: subTab === 'saved',
  });

  const showDeviceNotice = (kind: 'ok' | 'err', text: string) => {
    setDeviceNotice({ kind, text });
    if (kind === 'ok') setTimeout(() => setDeviceNotice(null), 2600);
  };

  const simMut = useMutation({
    mutationFn: ({ id, scenario }: { id: string; scenario: 'normal' | 'stroke_alert' }) =>
      devicesApi.simulate(id, scenario),
    onSuccess: (res, vars) => {
      setDeviceWaveVisible(true);
      setDeviceWavePulse((p) => p + 1);
      showDeviceNotice('ok', `Đã nhận ${res.samplesIngested} mẫu tín hiệu`);
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
      void queryClient.invalidateQueries({ queryKey: ['device-telemetry', vars.id] });
    },
    onError: (e) => showDeviceNotice('err', errorMessage(e)),
  });

  const captureMut = useMutation({
    mutationFn: (id: string) => devicesApi.captureSession(id, { title: 'Phiên đo di động' }),
    onSuccess: () => {
      showDeviceNotice('ok', 'Đã lưu phiên đo');
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: (e) => showDeviceNotice('err', errorMessage(e)),
  });

  const ackMut = useMutation({
    mutationFn: ({ deviceId, alertId }: { deviceId: string; alertId: string }) =>
      devicesApi.ackAlert(deviceId, alertId),
    onSuccess: () => {
      showDeviceNotice('ok', 'Đã xác nhận cảnh báo');
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: (e) => showDeviceNotice('err', errorMessage(e)),
  });

  const createRecMut = useMutation({
    mutationFn: () =>
      eegDatasetsApi.create({
        title: newTitle.trim(),
        samplingRate: '250 Hz',
        channelsCount: 8,
        duration: '15 phút',
        clinicalNote: newNote.trim() || 'Bản ghi từ NeuroLink Mobile',
      }),
    onSuccess: (res) => {
      setAddRecOpen(false);
      setNewTitle('');
      setNewNote('');
      setRecErr(null);
      setSelectedRecId(res.dataset.id);
      void queryClient.invalidateQueries({ queryKey: ['eeg-datasets'] });
    },
    onError: (e) => setRecErr(errorMessage(e)),
  });

  const handleCsvPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAnalyzing(true);
    setErr(null);
    try {
      const csvText = await file.text();
      const res = await qeegApi.analyzeCsv({ filename: file.name, csvText, samplingRateHz: 500 });
      loadedCaseRef.current = null;
      setAnalysisSource('csv');
      setCsvFileName(file.name);
      setAnalysis(res);
    } catch (er) {
      setErr(errorMessage(er));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSelectCase = (nextCaseId: string) => {
    setAnalysisSource('case');
    setCsvFileName(null);
    if (nextCaseId === caseId) {
      loadedCaseRef.current = null;
    }
    setCaseId(nextCaseId);
  };

  const datasets = savedQuery.data?.datasets ?? [];
  const activeDataset = datasets.find((d) => d.id === selectedRecId) ?? datasets[0] ?? null;
  const datasetPreview = useMemo(
    () => (activeDataset ? buildDatasetPreview(activeDataset) : null),
    [activeDataset],
  );

  const devices = devicesQuery.data?.devices ?? [];
  const alerts = (devicesQuery.data?.alerts ?? []).filter((a) => !a.acknowledged);
  const primaryDevice = devices.find((d) => d.id === selectedDeviceId) ?? devices[0];

  const telemetryQuery = useQuery({
    queryKey: ['device-telemetry', primaryDevice?.id],
    queryFn: () => devicesApi.getTelemetry(primaryDevice!.id),
    enabled: subTab === 'device' && Boolean(primaryDevice?.id) && (deviceWaveVisible || demoStreaming),
    refetchInterval: subTab === 'device' && demoStreaming ? 4500 : false,
  });

  const deviceWaveform = useMemo(
    () =>
      buildDeviceWaveform(
        telemetryQuery.data?.bufferedSamples,
        primaryDevice?.sampleRateSps ?? 500,
        deviceWavePulse,
      ),
    [telemetryQuery.data?.bufferedSamples, primaryDevice?.sampleRateSps, deviceWavePulse],
  );

  useEffect(() => {
    if (isProfessional || subTab !== 'device') {
      setDemoStreaming(false);
    }
  }, [isProfessional, subTab]);

  useEffect(() => {
    if (!demoStreaming || isProfessional || subTab !== 'device' || !primaryDevice?.id) return;
    const timer = setInterval(() => {
      if (!simMut.isPending) {
        simMut.mutate({ id: primaryDevice.id, scenario: 'normal' });
      }
    }, 4500);
    return () => clearInterval(timer);
  }, [demoStreaming, isProfessional, subTab, primaryDevice?.id]);

  return (
    <div className="px-3.5 pt-3.5 space-y-3.5">
      {/* Sub-view switcher + CSV upload */}
      <div className="flex items-center justify-between gap-1.5">
        <PillTabs<EegSubTab>
          items={[
            { id: 'analyze', label: 'Phân tích' },
            { id: 'device', label: 'Thiết bị' },
            { id: 'saved', label: 'Đã lưu' },
          ]}
          value={subTab}
          onChange={setSubTab}
          dark={isProfessional}
        />
        {subTab === 'analyze' && (
          <>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleCsvPick}
            />
            <button
              type="button"
              onClick={() => csvInputRef.current?.click()}
              aria-label="Tải tệp CSV"
              title="Tải tệp CSV"
              className={cn(
                'inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-full border px-2.5 text-xs font-semibold active:scale-95 transition-all cursor-pointer',
                analysisSource === 'csv'
                  ? 'border-[#16A34A] bg-[#16A34A] text-white'
                  : 'border-[#DCE6DF] bg-white text-[#15803D] hover:border-[#16A34A]',
              )}
            >
              <FileUp className="size-3.5" aria-hidden />
              <span>Tải CSV</span>
            </button>
          </>
        )}
      </div>

      {/* TAB 1: Minimal Glanceable qEEG */}
      {subTab === 'analyze' && (
        <div className="space-y-3">
          {/* Case Preset Strip */}
          <div
            className="min-w-0"
            style={{
              maskImage: 'linear-gradient(to right, black 92%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, black 92%, transparent 100%)',
            }}
          >
            <PillTabs
              items={isProfessional ? PRO_CASES : GENERAL_CASES}
              value={analysisSource === 'csv' ? '' : caseId}
              onChange={handleSelectCase}
              dark={isProfessional}
              className="pr-4"
            />
          </div>

          {analysisSource === 'csv' && csvFileName && (
            <div className="flex items-center justify-between gap-2 rounded-full border border-[#BBF7D0] bg-[#ECFDF3] px-3.5 py-1.5 text-xs text-[#15803D]">
              <span className="truncate font-medium">CSV: {csvFileName}</span>
              <button
                type="button"
                onClick={() => handleSelectCase(caseId)}
                aria-label="Quay về mẫu chuẩn"
                className="flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-[#16A34A]/15 cursor-pointer"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          )}

          {err && (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
              {err}
            </div>
          )}

          {analyzing && !analysis ? (
            <Spinner label="Đang đọc tín hiệu..." />
          ) : analysis ? (
            <>
              {/* Oura-style Single Verdict + 3 Clean Numbers */}
              {(() => {
                const meta = trafficMeta(analysis.trafficLight, isProfessional);
                return (
                  <div className="rounded-2xl border border-[#DCE6DF] bg-white p-4 space-y-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold',
                          meta.pill,
                        )}
                      >
                        <span className={cn('size-2 rounded-full', meta.dot)} aria-hidden />
                        <span>{meta.text}</span>
                      </span>
                      <span className="font-mono text-[11px] text-[#7A8880] tabular-nums">
                        {analysis.samplingRateHz} Hz · {analysis.channelsCount} kênh
                      </span>
                    </div>

                    <div className="grid grid-cols-3 divide-x divide-[#EDF3EF] text-center">
                      <div className="px-1 min-w-0 flex flex-col justify-between">
                        <span
                          title={isProfessional ? 'DAR' : 'Chỉ số sóng chậm (DAR)'}
                          className="block text-[10.5px] leading-tight font-medium text-[#5B6860] line-clamp-2 min-h-[28px]"
                        >
                          {isProfessional ? 'DAR' : 'Chỉ số sóng chậm (DAR)'}
                        </span>
                        <span
                          title={analysis.biomarkers.meanDar.toFixed(2)}
                          className="mt-0.5 block font-mono text-lg font-bold text-[#111827] tabular-nums truncate"
                        >
                          {formatRatio(analysis.biomarkers.meanDar)}
                        </span>
                        <span className="block text-[10px] text-[#7A8880] truncate mt-0.5">
                          {isProfessional ? 'Delta/Alpha' : 'Tỷ lệ sóng chậm'}
                        </span>
                      </div>
                      <div className="px-1 min-w-0 flex flex-col justify-between">
                        <span
                          title={isProfessional ? 'BSI' : 'Cân bằng 2 bán cầu (BSI)'}
                          className="block text-[10.5px] leading-tight font-medium text-[#5B6860] line-clamp-2 min-h-[28px]"
                        >
                          {isProfessional ? 'BSI' : 'Cân bằng 2 bán cầu (BSI)'}
                        </span>
                        <span className="mt-0.5 block font-mono text-lg font-bold text-[#111827] tabular-nums truncate">
                          {analysis.biomarkers.meanBsi.toFixed(2)}
                        </span>
                        <span className="block text-[10px] text-[#7A8880] truncate mt-0.5">
                          {isProfessional ? 'Đối xứng não' : 'Đối xứng 2 bên'}
                        </span>
                      </div>
                      <div className="px-1 min-w-0 flex flex-col justify-between">
                        <span
                          title={isProfessional ? 'Alpha' : 'Nhịp thư thái (Alpha)'}
                          className="block text-[10.5px] leading-tight font-medium text-[#5B6860] line-clamp-2 min-h-[28px]"
                        >
                          {isProfessional ? 'Alpha' : 'Nhịp thư thái (Alpha)'}
                        </span>
                        <span className="mt-0.5 block font-mono text-lg font-bold text-[#15803D] tabular-nums truncate">
                          {analysis.biomarkers.alphaPeakHz.toFixed(1)}Hz
                        </span>
                        <span className="block text-[10px] text-[#7A8880] truncate mt-0.5">
                          {isProfessional ? 'Đỉnh tần số' : 'Mức độ thư giãn'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Interactive Touch Waveform */}
              <CompactWaveform
                waveforms={analysis.waveforms}
                dark={isProfessional}
                plainLanguage={!isProfessional}
              />

              {/* Compact 4-Band Spectrum Strip */}
              <div className="rounded-2xl border border-[#DCE6DF] bg-white p-3.5 space-y-2.5">
                {(
                  [
                    {
                      label: isProfessional ? 'Delta' : 'Ngủ sâu',
                      val: analysis.bandPowers.delta,
                      cls: 'bg-[#14532D]',
                    },
                    {
                      label: isProfessional ? 'Theta' : 'Nghỉ nhẹ',
                      val: analysis.bandPowers.theta,
                      cls: 'bg-[#15803D]',
                    },
                    {
                      label: isProfessional ? 'Alpha' : 'Thư giãn',
                      val: analysis.bandPowers.alpha,
                      cls: 'bg-[#16A34A]',
                    },
                    {
                      label: isProfessional ? 'Beta' : 'Tập trung',
                      val: analysis.bandPowers.beta,
                      cls: 'bg-[#34D399]',
                    },
                  ] as const
                ).map((b) => {
                  const pct = Math.min(100, Math.max(4, Math.round(b.val * 100)));
                  return (
                    <div key={b.label} className="flex items-center gap-2.5 text-xs">
                      <span
                        className={cn(
                          'shrink-0 font-medium text-[#5B6860]',
                          isProfessional ? 'w-11' : 'w-16',
                        )}
                      >
                        {b.label}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-[#EDF3EF] overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all', b.cls)} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-9 text-right font-mono font-semibold text-[#111827] tabular-nums">
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Progressive Disclosure: 2D Cortical Topomap */}
              <button
                type="button"
                onClick={() => setShowTopomap((v) => !v)}
                className="flex w-full items-center justify-between rounded-2xl border border-[#DCE6DF] bg-white px-4 h-11 text-xs font-semibold text-[#111827] cursor-pointer"
              >
                <span>Bản đồ vỏ não 2D</span>
                <ChevronDown
                  className={cn('size-4 text-[#5B6860] transition-transform', showTopomap && 'rotate-180')}
                  aria-hidden
                />
              </button>
              {showTopomap && <CompactTopomap nodes={analysis.topomap} plainLanguage={!isProfessional} />}

              {/* Single Clean Next Action */}
              <Link
                to={isProfessional ? '/consult' : '/consult?ask=1'}
                className={cn(
                  'flex w-full items-center justify-center gap-2 h-12 rounded-full text-sm font-semibold text-white active:scale-[0.98] transition-all',
                  isProfessional
                    ? 'bg-[#14532D] hover:bg-[#166534]'
                    : 'bg-[#16A34A] hover:bg-[#15803D]',
                )}
              >
                <Stethoscope className="size-4.5" aria-hidden />
                <span>{isProfessional ? 'Mở danh sách ca chờ đọc' : 'Hỏi bác sĩ về bản đo này'}</span>
              </Link>
            </>
          ) : null}
        </div>
      )}

      {/* TAB 2: Live Hardware Device (TI ADS1299) */}
      {subTab === 'device' && (
        <div className="space-y-3">
          {deviceNotice && (
            <div
              role={deviceNotice.kind === 'err' ? 'alert' : 'status'}
              className={cn(
                'rounded-2xl border px-3.5 py-2.5 text-xs font-medium',
                deviceNotice.kind === 'err'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-[#BBF7D0] bg-[#ECFDF3] text-[#15803D]',
              )}
            >
              {deviceNotice.text}
            </div>
          )}
          {devicesQuery.isLoading ? (
            <Spinner />
          ) : !primaryDevice ? (
            <EmptyView icon={<Cpu className="size-8" />} title="Chưa có thiết bị EEG" />
          ) : (
            <>
              {devices.length > 1 && (
                <PillTabs
                  items={devices.map((d, idx) => ({
                    id: d.id,
                    label: isProfessional ? d.deviceCode : `Thiết bị ${idx + 1}`,
                  }))}
                  value={primaryDevice.id}
                  onChange={setSelectedDeviceId}
                  dark={isProfessional}
                />
              )}
              <div className="rounded-2xl border border-[#DCE6DF] bg-white p-4 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    {isProfessional ? (
                      <>
                        <h2 className="text-[15px] font-bold text-[#111827] truncate">{primaryDevice.name}</h2>
                        <p className="font-mono text-xs text-[#5B6860]">{primaryDevice.deviceCode}</p>
                      </>
                    ) : (
                      <>
                        <h2 className="text-[14px] font-bold text-[#111827] truncate">
                          Thiết bị đo sóng não · {primaryDevice.sampleRateSps} Hz
                        </h2>
                        <p className="mt-0.5 text-xs text-[#5B6860]">
                          {demoStreaming ? 'Đang chạy mô phỏng trực tiếp' : 'Sẵn sàng mô phỏng 1 chạm'}
                        </p>
                      </>
                    )}
                  </div>
                  <span
                    className={cn(
                      'inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                      primaryDevice.status === 'ALERT'
                        ? 'bg-red-50 text-red-700'
                        : demoStreaming || primaryDevice.status === 'STREAMING' || primaryDevice.status === 'ONLINE'
                          ? 'bg-[#ECFDF3] text-[#15803D]'
                          : 'bg-[#F5FAF7] text-[#5B6860]',
                    )}
                  >
                    <Radio className={cn('size-3', demoStreaming && 'animate-pulse')} aria-hidden />
                    <span>
                      {demoStreaming && !isProfessional
                        ? 'Đang đo'
                        : primaryDevice.status === 'STREAMING'
                          ? 'Đang phát'
                          : primaryDevice.status === 'ONLINE'
                            ? 'Trực tuyến'
                            : primaryDevice.status === 'ALERT'
                              ? 'Cảnh báo'
                              : 'Chờ kết nối'}
                    </span>
                  </span>
                </div>

                <div className="grid grid-cols-3 divide-x divide-[#EDF3EF] text-center">
                  <div>
                    <span className="flex items-center justify-center gap-1 text-[11px] text-[#5B6860]">
                      <Battery className="size-3" aria-hidden /> Pin
                    </span>
                    <span className="mt-0.5 block font-mono text-base font-bold text-[#111827] tabular-nums">
                      {primaryDevice.lastBatteryPct ?? '--'}%
                    </span>
                  </div>
                  <div>
                    <span className="flex items-center justify-center gap-1 text-[11px] text-[#5B6860]">
                      <Wifi className="size-3" aria-hidden /> Tần số
                    </span>
                    <span className="mt-0.5 block font-mono text-base font-bold text-[#111827] tabular-nums">
                      {primaryDevice.sampleRateSps} Hz
                    </span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-[#5B6860]">Trạng thái AI</span>
                    <span className="mt-0.5 block text-xs font-bold text-[#15803D] truncate px-1 pt-1">
                      {formatAiState(primaryDevice.lastAiState)}
                    </span>
                  </div>
                </div>

                {/* One-tap Hardware Controls */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={simMut.isPending}
                      onClick={() => {
                        setDeviceWaveVisible(true);
                        simMut.mutate({ id: primaryDevice.id, scenario: 'normal' });
                      }}
                      className="h-10.5 rounded-full bg-[#16A34A] text-xs font-semibold text-white hover:bg-[#15803D] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      Đo mẫu ổn định
                    </button>
                    <button
                      type="button"
                      disabled={captureMut.isPending}
                      onClick={() => captureMut.mutate(primaryDevice.id)}
                      className="inline-flex items-center justify-center gap-1.5 h-10.5 rounded-full border border-[#DCE6DF] bg-[#F5FAF7] text-xs font-semibold text-[#111827] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Camera className="size-3.5 text-[#16A34A]" aria-hidden />
                      <span>Lưu phiên</span>
                    </button>
                  </div>

                  {!isProfessional && (
                    <button
                      type="button"
                      disabled={simMut.isPending}
                      onClick={() => {
                        const next = !demoStreaming;
                        setDemoStreaming(next);
                        if (next) {
                          setDeviceWaveVisible(true);
                          simMut.mutate({ id: primaryDevice.id, scenario: 'normal' });
                        } else {
                          showDeviceNotice('ok', 'Đã dừng mô phỏng');
                        }
                      }}
                      className={cn(
                        'inline-flex w-full items-center justify-center gap-2 h-10 rounded-full border text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50',
                        demoStreaming
                          ? 'border-[#16A34A] bg-[#ECFDF3] text-[#15803D]'
                          : 'border-[#DCE6DF] bg-[#F5FAF7] text-[#15803D] hover:border-[#16A34A]',
                      )}
                    >
                      <Radio className={cn('size-3.5', demoStreaming && 'animate-pulse')} aria-hidden />
                      <span>
                        {demoStreaming ? 'Đang bật mô phỏng (Demo) · Bấm để dừng' : 'Bật mô phỏng (Demo)'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {(deviceWaveVisible || demoStreaming) && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[#111827]">
                      <span
                        className={cn(
                          'size-2 rounded-full bg-[#16A34A]',
                          demoStreaming && 'animate-pulse',
                        )}
                        aria-hidden
                      />
                      <span>{isProfessional ? 'Tín hiệu điện não trực tiếp' : 'Sóng não trực tiếp · 6 kênh'}</span>
                    </span>
                    <span className="font-mono text-[11px] text-[#5B6860] tabular-nums">
                      {primaryDevice.sampleRateSps} Hz
                    </span>
                  </div>
                  <CompactWaveform
                    waveforms={deviceWaveform}
                    dark={isProfessional}
                    plainLanguage={!isProfessional}
                  />
                </div>
              )}

              {/* Active Alerts */}
              {alerts.length > 0 && (
                <div className="space-y-2">
                  {alerts.slice(0, 3).map((al) => (
                    <div
                      key={al.id}
                      className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3"
                    >
                      <AlertTriangle className="size-4.5 text-amber-600 shrink-0" aria-hidden />
                      <p className="flex-1 text-xs font-medium text-amber-950 line-clamp-2">
                        {isProfessional ? al.message : formatPlainAlertMessage(al.message)}
                      </p>
                      <button
                        type="button"
                        onClick={() => ackMut.mutate({ deviceId: al.deviceId, alertId: al.id })}
                        aria-label="Xác nhận"
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-amber-800 border border-amber-200 cursor-pointer"
                      >
                        <Check className="size-4" aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 3: Saved EEG Recordings */}
      {subTab === 'saved' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setAddRecOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#16A34A] px-3.5 h-9 text-xs font-semibold text-white cursor-pointer"
            >
              <Plus className="size-3.5" aria-hidden />
              <span>Thêm bản ghi</span>
            </button>
          </div>

          {savedQuery.isLoading ? (
            <Spinner />
          ) : datasets.length === 0 ? (
            <EmptyView title="Chưa có bản ghi đã lưu" />
          ) : (
            <>
              <div className="space-y-2">
                {datasets.map((rec) => {
                  const selected = activeDataset?.id === rec.id;
                  return (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => setSelectedRecId(rec.id)}
                      className={cn(
                        'w-full text-left rounded-2xl border p-3.5 transition-colors cursor-pointer',
                        selected
                          ? 'border-[#16A34A] bg-[#ECFDF3]'
                          : 'border-[#DCE6DF] bg-white',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-[#111827] truncate">{rec.title}</span>
                        <span
                          className={cn(
                            'size-2 rounded-full shrink-0',
                            rec.status === 'ANALYZED' ? 'bg-[#16A34A]' : 'bg-amber-500',
                          )}
                        />
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-[#5B6860] tabular-nums">
                        {isProfessional ? `${rec.patientCode} · ` : ''}
                        {rec.channelsCount} kênh · {rec.samplingRate}
                      </p>
                    </button>
                  );
                })}
              </div>

              {activeDataset && datasetPreview && (
                <div className="space-y-2.5 pt-1">
                  <CompactWaveform
                    waveforms={datasetPreview}
                    dark={isProfessional}
                    plainLanguage={!isProfessional}
                  />
                  {activeDataset.clinicalNote && (
                    <p className="rounded-2xl border border-[#DCE6DF] bg-white px-3.5 py-3 text-xs leading-relaxed text-[#374151]">
                      {activeDataset.clinicalNote}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Add Dataset Bottom Sheet */}
      <BottomSheet
        open={addRecOpen}
        onClose={() => setAddRecOpen(false)}
        title="Lưu bản ghi EEG"
        headerRight={
          <button
            type="button"
            disabled={newTitle.trim().length < 3 || createRecMut.isPending}
            onClick={() => createRecMut.mutate()}
            className="rounded-full bg-[#16A34A] px-4 h-9 text-xs font-semibold text-white disabled:opacity-40 cursor-pointer"
          >
            Lưu
          </button>
        }
      >
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (newTitle.trim().length >= 3) createRecMut.mutate();
          }}
          className="space-y-3"
        >
          {recErr && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
              {recErr}
            </p>
          )}
          <input
            type="text"
            placeholder="Tên bản ghi (vd: Đo giấc ngủ tối nay)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full h-11 rounded-2xl border border-[#DCE6DF] bg-[#F5FAF7] px-4 text-sm focus:bg-white focus:border-[#16A34A] focus:outline-none"
          />
          <textarea
            rows={3}
            placeholder="Ghi chú ngắn (tùy chọn)"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="w-full rounded-2xl border border-[#DCE6DF] bg-[#F5FAF7] p-3.5 text-sm focus:bg-white focus:border-[#16A34A] focus:outline-none resize-none"
          />
        </form>
      </BottomSheet>
    </div>
  );
}
