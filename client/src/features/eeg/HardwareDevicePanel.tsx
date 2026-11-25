import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MutableRefObject } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Battery,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Cpu,
  ExternalLink,
  Flag,
  Pause,
  Play,
  Plus,
  Radio,
  Save,
  Square,
  Trash2,
  Wifi,
} from 'lucide-react';
import { devicesApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import type {
  DeviceAlertItem,
  DeviceRealtimeEventDetail,
  DeviceRecordingSessionItem,
  DeviceSimulationScenario,
  DeviceStatus,
  DeviceWaveformEventPayload,
  HardwareDeviceItem,
} from '../../api/types';
import { Alert, Button, Card, Input, Spinner, cn } from '../../components/ui';
import { DEVICE_REALTIME_EVENT_NAME } from '../realtime/useRealtimeEvents';

export interface HardwareDevicePanelProps {
  isProfessional?: boolean;
}

const CHANNEL_NAMES = ['F3', 'F4', 'C3', 'C4', 'O1', 'O2', 'T3', 'T4'] as const;
const CHANNEL_COUNT = CHANNEL_NAMES.length;
const RING_CAPACITY = 1000; // 2s window at 500 Hz
const TRACE_COLORS = [
  '#16A34A',
  '#059669',
  '#15803D',
  '#10B981',
  '#16A34A',
  '#059669',
  '#15803D',
  '#10B981',
] as const;

type ScopeScaleUv = 50 | 100 | 200;

interface CreatedCredentialBanner {
  deviceCode: string;
  deviceName: string;
  apiKey: string;
  wifiSetCommand: string;
}

function formatStatusMeta(status: DeviceStatus) {
  switch (status) {
    case 'STREAMING':
      return {
        label: 'Đang phát trực tiếp',
        badge: 'bg-[#ECFDF3] text-[#15803D] border-[#BBF7D0]',
        dot: 'bg-[#16A34A] animate-pulse',
      };
    case 'ONLINE':
      return {
        label: 'Trực tuyến',
        badge: 'bg-[#ECFDF3] text-[#15803D] border-[#BBF7D0]',
        dot: 'bg-[#16A34A]',
      };
    case 'ALERT':
      return {
        label: 'Cảnh báo',
        badge: 'bg-red-50 text-red-700 border-red-200',
        dot: 'bg-red-600 animate-pulse',
      };
    default:
      return {
        label: 'Đang chờ thiết bị',
        badge: 'bg-[#F5FAF7] text-[#575652] border-[#DCE6DF]',
        dot: 'bg-[#8A8882]',
      };
  }
}

function formatAlertBadge(severity: DeviceAlertItem['severity']) {
  if (severity === 'CRITICAL') {
    return 'bg-red-50 text-red-700 border-red-200';
  }
  if (severity === 'WARNING') {
    return 'bg-amber-50 text-amber-800 border-amber-200';
  }
  return 'bg-[#ECFDF3] text-[#15803D] border-[#BBF7D0]';
}

function summarizeSessionQeeg(session: DeviceRecordingSessionItem): {
  label: string;
  tone: 'emerald' | 'amber' | 'red' | 'neutral';
  metrics: string;
} {
  const raw = session.qeegResultJson;
  if (!raw || typeof raw !== 'object') {
    return { label: 'Chưa phân tích', tone: 'neutral', metrics: '—' };
  }

  const title =
    (typeof raw.classificationTitle === 'string' && raw.classificationTitle) ||
    (typeof raw.classificationLabel === 'string' && raw.classificationLabel) ||
    (typeof raw.aiState === 'string' && raw.aiState) ||
    'Đã phân tích qEEG';

  const biomarkers =
    raw.biomarkers && typeof raw.biomarkers === 'object'
      ? (raw.biomarkers as Record<string, unknown>)
      : null;

  const darVal =
    typeof biomarkers?.meanDar === 'number'
      ? biomarkers.meanDar
      : typeof raw.meanDar === 'number'
        ? raw.meanDar
        : typeof raw.dar === 'number'
          ? raw.dar
          : null;

  const bsiVal =
    typeof biomarkers?.meanBsi === 'number'
      ? biomarkers.meanBsi
      : typeof raw.meanBsi === 'number'
        ? raw.meanBsi
        : typeof raw.bsi === 'number'
          ? raw.bsi
          : null;

  const parts: string[] = [];
  if (darVal !== null) parts.push(`DAR ${darVal.toFixed(2)}`);
  if (bsiVal !== null) parts.push(`BSI ${bsiVal.toFixed(2)}`);

  const upper = title.toUpperCase();
  const isDanger =
    upper.includes('STROKE') ||
    upper.includes('ĐỘT QUỴ') ||
    upper.includes('XUẤT HUYẾT') ||
    upper.includes('THIẾU MÁU') ||
    raw.trafficLight === 'red' ||
    raw.trafficLight === 'purple';
  const isWarn =
    upper.includes('EPILEP') ||
    upper.includes('FATIGUE') ||
    upper.includes('CẢNH BÁO') ||
    raw.trafficLight === 'yellow';

  return {
    label: title,
    tone: isDanger ? 'red' : isWarn ? 'amber' : 'emerald',
    metrics: parts.length > 0 ? parts.join(' · ') : 'Đã hoàn tất phân tích',
  };
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFriendlyAiStatus(aiState: string, isProfessional: boolean): string {
  if (isProfessional) return `AI: ${aiState}`;
  const upper = aiState.toUpperCase();
  if (upper.includes('STROKE') || upper.includes('ALERT')) return 'Trạng thái: Cần chú ý';
  if (upper.includes('BATTERY') || upper.includes('LOW')) return 'Trạng thái: Pin yếu';
  return 'Trạng thái: Ổn định';
}

function formatAlertCodeLabel(code: string, isProfessional: boolean): string {
  if (isProfessional) return code;
  const upper = code.toUpperCase();
  if (upper === 'LEAD_OFF' || upper.includes('LOFF') || upper.includes('ELECTRODE')) {
    return 'Độ bám điện cực chưa chặt';
  }
  if (upper === 'STROKE_ALERT' || upper === 'BSI_DAR_HIGH' || upper.includes('STROKE')) {
    return 'Cảnh báo sóng chậm bất thường';
  }
  if (upper === 'LOW_BATTERY' || upper === 'BAT_LOW' || upper.includes('BAT')) {
    return 'Pin thiết bị yếu';
  }
  if (upper.includes('POST_SELF_TEST') || upper.includes('SELF_TEST')) {
    return 'Kiểm tra thiết bị đạt chuẩn';
  }
  return code;
}

function formatAlertMessageText(message: string, isProfessional: boolean): string {
  if (isProfessional) return message;
  if (/ADS1299|uVrms|POST/i.test(message)) {
    return 'Thiết bị đã tự kiểm tra tín hiệu ổn định và các điện cực tiếp xúc tốt.';
  }
  return message;
}

const SCENARIO_LABELS: Record<DeviceSimulationScenario, string> = {
  normal: 'Bình thường',
  stroke_alert: 'Cảnh báo Đột quỵ',
  low_battery: 'Pin yếu',
};

interface OscilloscopeCanvasProps {
  isProfessional: boolean;
  scaleUv: ScopeScaleUv;
  scopePaused: boolean;
  ringRef: MutableRefObject<Float32Array[]>;
  writeIdxRef: MutableRefObject<number>;
  filledCountRef: MutableRefObject<number>;
  dirtyRef: MutableRefObject<boolean>;
}

function OscilloscopeCanvas({
  isProfessional,
  scaleUv,
  scopePaused,
  ringRef,
  writeIdxRef,
  filledCountRef,
  dirtyRef,
}: OscilloscopeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const pausedRef = useRef<boolean>(scopePaused);
  const scaleUvRef = useRef<ScopeScaleUv>(scaleUv);

  pausedRef.current = scopePaused;
  scaleUvRef.current = scaleUv;

  useEffect(() => {
    dirtyRef.current = true;
  }, [scaleUv, scopePaused, dirtyRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = canvasWrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const CANVAS_HEIGHT = isProfessional ? 432 : 396;

    const drawFrame = () => {
      const width = Math.max(280, Math.floor(wrap.clientWidth));
      const height = CANVAS_HEIGHT;
      const leftGutter = width < 480 ? 34 : 46;
      const rightPad = 10;
      const topPad = 10;
      const bottomPad = 18;
      const plotW = Math.max(100, width - leftGutter - rightPad);
      const plotH = height - topPad - bottomPad;
      const laneH = plotH / CHANNEL_COUNT;
      const scale = scaleUvRef.current;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#F8FCFA';
      ctx.fillRect(leftGutter, topPad, plotW, plotH);

      ctx.strokeStyle = '#E5EFE8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const vDivs = 8;
      for (let i = 0; i <= vDivs; i++) {
        const x = leftGutter + (plotW * i) / vDivs;
        ctx.moveTo(Math.round(x) + 0.5, topPad);
        ctx.lineTo(Math.round(x) + 0.5, topPad + plotH);
      }
      ctx.stroke();

      ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';

      for (let ch = 0; ch < CHANNEL_COUNT; ch++) {
        const centerY = topPad + laneH * ch + laneH / 2;

        ctx.strokeStyle = '#E9F2EC';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(leftGutter, Math.round(centerY) + 0.5);
        ctx.lineTo(leftGutter + plotW, Math.round(centerY) + 0.5);
        ctx.stroke();

        ctx.fillStyle = '#15803D';
        ctx.fillText(CHANNEL_NAMES[ch]!, leftGutter - 8, centerY);
      }

      const rings = ringRef.current;
      const filled = filledCountRef.current;
      const writeIdx = writeIdxRef.current;
      const halfLane = laneH * 0.42;

      if (filled > 1) {
        const startIdx = filled < RING_CAPACITY ? 0 : writeIdx;
        const stepX = plotW / (RING_CAPACITY - 1);

        for (let ch = 0; ch < CHANNEL_COUNT; ch++) {
          const buf = rings[ch]!;
          const centerY = topPad + laneH * ch + laneH / 2;

          ctx.strokeStyle = TRACE_COLORS[ch] ?? '#16A34A';
          ctx.lineWidth = 1.4;
          ctx.beginPath();

          for (let i = 0; i < filled; i++) {
            const sampleIdx = (startIdx + i) % RING_CAPACITY;
            const uv = buf[sampleIdx] ?? 0;
            const clamped = Math.max(-scale, Math.min(scale, uv));
            const x = leftGutter + i * stepX;
            const y = centerY - (clamped / scale) * halfLane;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = '#6E6D68';
        ctx.font = '500 12px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          'Đang khởi tạo tín hiệu sóng não 6 kênh...',
          leftGutter + plotW / 2,
          topPad + plotH / 2,
        );
      }

      ctx.strokeStyle = '#DCE6DF';
      ctx.lineWidth = 1;
      ctx.strokeRect(leftGutter + 0.5, topPad + 0.5, plotW - 1, plotH - 1);

      ctx.fillStyle = '#6E6D68';
      ctx.font = '500 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Thang biên độ ±${scale} µV · Cửa sổ ${RING_CAPACITY} mẫu`, leftGutter, height - 6);
    };

    const syncCanvasSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssWidth = Math.max(280, Math.floor(wrap.clientWidth));
      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(CANVAS_HEIGHT * dpr);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${CANVAS_HEIGHT}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dirtyRef.current = false;
      drawFrame();
    };

    syncCanvasSize();
    const ro = new ResizeObserver(() => syncCanvasSize());
    ro.observe(wrap);

    let rafId = 0;
    const draw = () => {
      if (dirtyRef.current && !pausedRef.current) {
        dirtyRef.current = false;
        drawFrame();
      }
      rafId = window.requestAnimationFrame(draw);
    };

    rafId = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [isProfessional, ringRef, writeIdxRef, filledCountRef, dirtyRef]);

  return (
    <div
      ref={canvasWrapRef}
      className="w-full overflow-hidden rounded-lg border border-[#DCE6DF] bg-white"
    >
      <canvas
        ref={canvasRef}
        aria-label="Biểu đồ sóng não 6 kênh trực tiếp"
        className="block w-full"
      />
    </div>
  );
}

export function HardwareDevicePanel({ isProfessional = false }: HardwareDevicePanelProps) {
  const queryClient = useQueryClient();

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [simScenario, setSimScenario] = useState<DeviceSimulationScenario>('normal');
  const [isSimulating, setIsSimulating] = useState(false);
  const [showRealSetup, setShowRealSetup] = useState(false);
  const [scaleUv, setScaleUv] = useState<ScopeScaleUv>(100);
  const [scopePaused, setScopePaused] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showGatewayCenter, setShowGatewayCenter] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(
    null,
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [createdCred, setCreatedCred] = useState<CreatedCredentialBanner | null>(null);

  // Add device form state
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newMontage, setNewMontage] = useState('neurolink6');
  const [newRate, setNewRate] = useState('500');
  const [newPga, setNewPga] = useState('24');

  // High-frequency oscilloscope refs (zero React re-render per sample batch)
  const ringRef = useRef<Float32Array[]>(
    Array.from({ length: CHANNEL_COUNT }, () => new Float32Array(RING_CAPACITY)),
  );
  const writeIdxRef = useRef<number>(0);
  const filledCountRef = useRef<number>(0);
  const dirtyRef = useRef<boolean>(true);
  const recentSamplesCounterRef = useRef<number>(0);
  const totalSamplesRef = useRef<number>(0);
  const [liveStats, setLiveStats] = useState<{ sps: number; total: number }>({ sps: 0, total: 0 });

  const overviewQuery = useQuery({
    queryKey: ['devices'],
    queryFn: () => devicesApi.list(),
    refetchInterval: 15000,
  });

  const devices = useMemo(() => overviewQuery.data?.devices ?? [], [overviewQuery.data?.devices]);
  const alerts = useMemo(() => overviewQuery.data?.alerts ?? [], [overviewQuery.data?.alerts]);
  const sessions = useMemo(() => overviewQuery.data?.sessions ?? [], [overviewQuery.data?.sessions]);
  const gateway = overviewQuery.data?.gateway ?? {
    wsPath: '/ws/hardware',
    nodeRedUrl: 'http://127.0.0.1:1880',
    ingestPath: '/api/devices/ingest',
  };

  useEffect(() => {
    if (devices.length === 0) {
      setSelectedDeviceId('');
      return;
    }
    setSelectedDeviceId((prev) =>
      prev && devices.some((d) => d.id === prev) ? prev : devices[0]!.id,
    );
  }, [devices]);

  const selectedDevice: HardwareDeviceItem | null = useMemo(() => {
    if (devices.length === 0) return null;
    return devices.find((d) => d.id === selectedDeviceId) ?? devices[0] ?? null;
  }, [devices, selectedDeviceId]);

  const telemetryQuery = useQuery({
    queryKey: ['devices', 'telemetry', selectedDevice?.id],
    queryFn: () => devicesApi.getTelemetry(selectedDevice!.id),
    enabled: Boolean(selectedDevice?.id),
    refetchInterval: 12000,
  });

  const isConnected = Boolean(
    selectedDevice &&
      (selectedDevice.isWsConnected ||
        selectedDevice.status === 'ONLINE' ||
        selectedDevice.status === 'STREAMING' ||
        selectedDevice.status === 'ALERT' ||
        liveStats.sps > 0),
  );
  const isWorkspaceOpen = isConnected || isSimulating;

  const pushSamplesToRing = useCallback((samples: number[][], countForRate: boolean) => {
    if (!samples || samples.length === 0) return;
    const rings = ringRef.current;
    let idx = writeIdxRef.current;
    let filled = filledCountRef.current;

    for (let s = 0; s < samples.length; s++) {
      const row = samples[s];
      if (!Array.isArray(row)) continue;
      for (let ch = 0; ch < CHANNEL_COUNT; ch++) {
        const val = Number(row[ch] ?? 0);
        rings[ch]![idx] = Number.isFinite(val) ? val : 0;
      }
      idx = (idx + 1) % RING_CAPACITY;
      if (filled < RING_CAPACITY) filled += 1;
    }

    writeIdxRef.current = idx;
    filledCountRef.current = filled;
    dirtyRef.current = true;

    if (countForRate) {
      recentSamplesCounterRef.current += samples.length;
      totalSamplesRef.current += samples.length;
    }
  }, []);

  const resetRingBuffer = useCallback(() => {
    for (let ch = 0; ch < CHANNEL_COUNT; ch++) {
      ringRef.current[ch]!.fill(0);
    }
    writeIdxRef.current = 0;
    filledCountRef.current = 0;
    recentSamplesCounterRef.current = 0;
    totalSamplesRef.current = 0;
    dirtyRef.current = true;
    setLiveStats({ sps: 0, total: 0 });
  }, []);

  // Reset ring when switching devices
  useEffect(() => {
    resetRingBuffer();
  }, [selectedDevice?.id, resetRingBuffer]);

  // Hydrate ring buffer from initial telemetry bufferedSamples
  useEffect(() => {
    const buffered = telemetryQuery.data?.bufferedSamples;
    if (buffered && buffered.length > 0 && filledCountRef.current === 0) {
      pushSamplesToRing(buffered, false);
      totalSamplesRef.current = buffered.length;
      setLiveStats((prev) => ({ ...prev, total: buffered.length }));
    }
  }, [telemetryQuery.data?.bufferedSamples, pushSamplesToRing]);

  // Subscribe to zero-lag custom window SSE events for 60fps oscilloscope
  const selectedIdRef = useRef<string | null>(null);
  const selectedCodeRef = useRef<string | null>(null);
  selectedIdRef.current = selectedDevice?.id ?? null;
  selectedCodeRef.current = selectedDevice?.deviceCode ?? null;

  useEffect(() => {
    const handleDeviceEvent = (evt: Event) => {
      const customEvt = evt as CustomEvent<DeviceRealtimeEventDetail>;
      const detail = customEvt.detail;
      if (!detail) return;

      if (detail.type === 'device:waveform') {
        const payload = detail.payload as unknown as DeviceWaveformEventPayload;
        const matchesId = payload.deviceId && payload.deviceId === selectedIdRef.current;
        const matchesCode = payload.deviceCode && payload.deviceCode === selectedCodeRef.current;
        if ((matchesId || matchesCode || (!payload.deviceId && !payload.deviceCode)) && Array.isArray(payload.samples)) {
          pushSamplesToRing(payload.samples, true);
        }
      } else if (detail.type === 'device:telemetry' && selectedIdRef.current) {
        void queryClient.invalidateQueries({
          queryKey: ['devices', 'telemetry', selectedIdRef.current],
        });
      }
    };

    window.addEventListener(DEVICE_REALTIME_EVENT_NAME, handleDeviceEvent);
    return () => {
      window.removeEventListener(DEVICE_REALTIME_EVENT_NAME, handleDeviceEvent);
    };
  }, [pushSamplesToRing, queryClient]);

  // Update live SPS badge every 1s (no per-frame React state churn)
  useEffect(() => {
    const timer = window.setInterval(() => {
      const sps = recentSamplesCounterRef.current;
      recentSamplesCounterRef.current = 0;
      setLiveStats({ sps, total: totalSamplesRef.current });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Mutations
  const createDeviceMutation = useMutation({
    mutationFn: devicesApi.create,
    onSuccess: (res) => {
      setCreatedCred({
        deviceCode: res.device.deviceCode,
        deviceName: res.device.name,
        apiKey: res.apiKey,
        wifiSetCommand: res.wifiSetCommand,
      });
      setSelectedDeviceId(res.device.id);
      setShowAddForm(false);
      setNewName('');
      setNewCode('');
      setFeedback({
        tone: 'success',
        text: `Đã tạo thiết bị ${res.device.name} (${res.device.deviceCode}). Hãy lưu API Key ngay.`,
      });
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: (err) => {
      setFeedback({ tone: 'error', text: errorMessage(err) });
    },
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: (id: string) => devicesApi.remove(id),
    onSuccess: () => {
      setFeedback({ tone: 'info', text: 'Đã xóa thiết bị khỏi danh sách.' });
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: (err) => {
      setFeedback({ tone: 'error', text: errorMessage(err) });
    },
  });

  const simulateMutation = useMutation({
    mutationFn: ({ id, scenario }: { id: string; scenario: DeviceSimulationScenario }) =>
      devicesApi.simulate(id, scenario),
    onSuccess: (res) => {
      setFeedback({
        tone: simScenario === 'normal' ? 'success' : 'info',
        text: `Đã phát ${res.samplesIngested} mẫu mô phỏng (${SCENARIO_LABELS[simScenario]}).`,
      });
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
      if (selectedDevice?.id) {
        void queryClient.invalidateQueries({
          queryKey: ['devices', 'telemetry', selectedDevice.id],
        });
      }
    },
    onError: (err) => {
      setFeedback({ tone: 'error', text: errorMessage(err) });
    },
  });

  const COMMAND_LABELS: Record<string, string> = {
    MKR: 'Đánh dấu sự kiện',
    REC_START: 'Ghi thẻ nhớ',
    REC_STOP: 'Dừng ghi',
  };

  const commandMutation = useMutation({
    mutationFn: ({ id, command }: { id: string; command: string }) =>
      devicesApi.sendCommand(id, command),
    onSuccess: (res) => {
      const cmdLabel = COMMAND_LABELS[res.command] ?? res.command;
      setFeedback({
        tone: res.dispatched ? 'success' : 'info',
        text: res.dispatched
          ? `Đã gửi lệnh ${cmdLabel}.`
          : `Đã ghi nhận lệnh ${cmdLabel} — thiết bị đang ngoại tuyến.`,
      });
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: (err) => {
      setFeedback({ tone: 'error', text: errorMessage(err) });
    },
  });

  const ackAlertMutation = useMutation({
    mutationFn: ({ deviceId, alertId }: { deviceId: string; alertId: string }) =>
      devicesApi.ackAlert(deviceId, alertId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: (err) => {
      setFeedback({ tone: 'error', text: errorMessage(err) });
    },
  });

  const captureSessionMutation = useMutation({
    mutationFn: ({ id, title, samples }: { id: string; title?: string; samples?: number[][] }) =>
      devicesApi.captureSession(id, { title, samples }),
    onSuccess: (res) => {
      setFeedback({
        tone: 'success',
        text: `Đã lưu phiên "${res.session.title}" (${res.session.sampleCount} mẫu) & đọc qEEG.`,
      });
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: (err) => {
      setFeedback({ tone: 'error', text: errorMessage(err) });
    },
  });

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2000);
    } catch {
      setFeedback({ tone: 'error', text: 'Không thể sao chép vào clipboard.' });
    }
  };

  const handleAddSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = newName.trim();
    if (trimmedName.length < 2) {
      setFeedback({ tone: 'error', text: 'Tên thiết bị cần tối thiểu 2 ký tự.' });
      return;
    }
    createDeviceMutation.mutate({
      name: trimmedName,
      deviceCode: newCode.trim() || undefined,
      montage: newMontage,
      sampleRateSps: Number(newRate) || 500,
      pgaGain: Number(newPga) || 24,
    });
  };

  const extractBufferedRows = (): number[][] => {
    const filled = filledCountRef.current;
    if (filled === 0) return [];
    const rings = ringRef.current;
    const startIdx = filled < RING_CAPACITY ? 0 : writeIdxRef.current;
    const rows: number[][] = [];
    for (let i = 0; i < filled; i++) {
      const idx = (startIdx + i) % RING_CAPACITY;
      const row: number[] = [];
      for (let ch = 0; ch < CHANNEL_COUNT; ch++) {
        row.push(Number((rings[ch]![idx] ?? 0).toFixed(3)));
      }
      rows.push(row);
    }
    return rows;
  };

  const handleCaptureSession = () => {
    if (!selectedDevice) return;
    const nowLabel = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const rows = extractBufferedRows();
    captureSessionMutation.mutate({
      id: selectedDevice.id,
      title: `Ghi trực tiếp ${selectedDevice.deviceCode} (${nowLabel})`,
      samples: rows.length >= 16 ? rows : undefined,
    });
  };

  // Derived connection strings
  const hostName = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : '127.0.0.1';
  const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
  const deviceCodeForUrl = selectedDevice?.deviceCode ?? 'NL-HOLTER-01';
  const wsPath = gateway.wsPath || '/ws/hardware';
  const wsFullUrl = `${wsProtocol}://${hostName}:4000${wsPath}?deviceCode=${encodeURIComponent(deviceCodeForUrl)}`;
  const nodeRedUrl = gateway.nodeRedUrl || 'http://127.0.0.1:1880';
  const ingestPath = gateway.ingestPath || '/api/devices/ingest';
  const wifiSetCli = `WIFI_SET <SSID>|<PASS>|${hostName}|4000|${wsPath}`;

  // Active telemetry summary
  const latestLog = telemetryQuery.data?.logs?.[0] ?? null;
  const activeLoffMask = selectedDevice?.lastLeadOffMask ?? latestLog?.loffMask ?? 0;
  const goodElectrodes = CHANNEL_NAMES.reduce(
    (acc, _, idx) => acc + ((activeLoffMask & (1 << idx)) === 0 ? 1 : 0),
    0,
  );

  const batteryPct =
    selectedDevice?.lastBatteryPct ??
    latestLog?.batPct ??
    (isSimulating ? (simScenario === 'low_battery' ? 14 : 92) : null);
  const batteryMv = selectedDevice?.lastBatteryMv ?? latestLog?.vbatMv ?? null;
  const aiState =
    selectedDevice?.lastAiState ??
    latestLog?.aiState ??
    (isSimulating
      ? simScenario === 'stroke_alert'
        ? 'STROKE_RISK'
        : simScenario === 'low_battery'
          ? 'LOW_BATTERY'
          : 'NORMAL'
      : 'NORMAL');
  const isStrokeAlert = aiState.toUpperCase().includes('STROKE') || aiState.toUpperCase().includes('ALERT');
  const displaySps =
    liveStats.sps > 0
      ? liveStats.sps
      : latestLog?.actualSps
        ? Math.round(latestLog.actualSps)
        : isSimulating
          ? 500
          : 0;
  const displayDar =
    selectedDevice?.lastAiDar ??
    (isSimulating ? (simScenario === 'stroke_alert' ? 3.85 : 1.18) : null);
  const displayBsi =
    selectedDevice?.lastAiBsi ??
    (isSimulating ? (simScenario === 'stroke_alert' ? 0.31 : 0.06) : null);

  // Continuous 6-channel live EEG demo generator when Demo simulation is active
  const simPhaseRef = useRef<number>(0);
  useEffect(() => {
    if (!isSimulating || scopePaused) return;
    const sampleRate = 500;
    const batchSize = 25; // 50ms interval => 500 samples/sec
    const timer = window.setInterval(() => {
      const batch: number[][] = [];
      for (let i = 0; i < batchSize; i++) {
        const t = simPhaseRef.current / sampleRate;
        simPhaseRef.current += 1;
        const row: number[] = [];
        for (let ch = 0; ch < CHANNEL_COUNT; ch++) {
          const isLeft = ch % 2 === 0; // F3, C3, O1
          const isOccipital = ch >= 4; // O1, O2
          const alphaAmp = isOccipital ? 28 : 16;
          const alpha = alphaAmp * Math.sin(2 * Math.PI * 10.2 * t + ch * 0.65);
          const beta = 7 * Math.sin(2 * Math.PI * 19.5 * t + ch * 1.1);
          const theta = 9 * Math.sin(2 * Math.PI * 5.6 * t + ch * 0.4);
          const strokeDelta =
            simScenario === 'stroke_alert' && isLeft
              ? 48 * Math.sin(2 * Math.PI * 1.6 * t + ch * 0.3)
              : 0;
          const noise = (Math.random() - 0.5) * 6;
          row.push(alpha + beta + theta + strokeDelta + noise);
        }
        batch.push(row);
      }
      pushSamplesToRing(batch, true);
    }, 50);
    return () => window.clearInterval(timer);
  }, [isSimulating, scopePaused, simScenario, pushSamplesToRing]);

  const handleStartDemo = () => {
    setIsSimulating(true);
    setScopePaused(false);
    setShowRealSetup(false);
    if (selectedDevice) {
      simulateMutation.mutate({ id: selectedDevice.id, scenario: simScenario });
    } else {
      setFeedback({
        tone: 'success',
        text: 'Đã bật chế độ mô phỏng sóng não 6 kênh trực tiếp.',
      });
    }
  };

  const handleStopDemo = () => {
    setIsSimulating(false);
    resetRingBuffer();
  };

  const deviceAlerts = useMemo(() => {
    const base = !selectedDevice
      ? alerts
      : (() => {
          const filtered = alerts.filter((a) => a.deviceId === selectedDevice.id);
          return filtered.length > 0 ? filtered : alerts;
        })();
    if (isSimulating && base.length === 0 && simScenario !== 'normal') {
      const demoAlert: DeviceAlertItem = {
        id: `demo-${simScenario}`,
        deviceId: selectedDevice?.id ?? 'demo-device',
        severity: simScenario === 'stroke_alert' ? 'CRITICAL' : 'WARNING',
        code: simScenario === 'stroke_alert' ? 'BSI_DAR_HIGH' : 'BAT_LOW',
        message:
          simScenario === 'stroke_alert'
            ? 'Mô phỏng: Sóng chậm Delta tăng lệch bán cầu trái (DAR 3.85 · BSI 0.31).'
            : 'Mô phỏng: Dung lượng pin thiết bị xuống dưới 15%.',
        acknowledged: false,
        acknowledgedAt: null,
        createdAt: new Date().toISOString(),
      };
      return [demoAlert];
    }
    return base;
  }, [alerts, selectedDevice, isSimulating, simScenario]);

  const unackedAlertsCount = deviceAlerts.filter((a) => !a.acknowledged).length;

  const statusMeta = isSimulating && !isConnected
    ? {
        label: 'Đang mô phỏng (Demo)',
        badge: 'bg-[#ECFDF3] text-[#15803D] border-[#BBF7D0]',
        dot: 'bg-[#16A34A] animate-pulse',
      }
    : formatStatusMeta(selectedDevice?.status ?? 'OFFLINE');

  if (overviewQuery.isLoading) {
    return (
      <Card className="p-8 border-[#DCE6DF] bg-white flex items-center justify-center gap-2 text-sm text-[#575652]">
        <Spinner className="size-4 text-[#16A34A]" />
        <span>Đang tải danh sách thiết bị...</span>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Feedback Banner */}
      {feedback && (
        <Alert tone={feedback.tone}>
          <div className="flex items-center justify-between gap-2">
            <span>{feedback.text}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs font-semibold underline shrink-0"
            >
              Đóng
            </button>
          </div>
        </Alert>
      )}

      {/* One-time API Key & WIFI_SET Banner after creating a device */}
      {createdCred && (
        <Card className="p-4 border-[#86EFAC] bg-[#ECFDF3] space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-bold text-[#14532D]">
                <CheckCircle2 className="size-4 text-[#16A34A] shrink-0" aria-hidden />
                <span>Khóa kết nối 1 lần · {createdCred.deviceCode}</span>
              </div>
              <p className="text-xs text-[#166534]">
                Sao chép API Key ngay — khóa kết nối này chỉ hiển thị một lần duy nhất để bảo mật.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreatedCred(null)}
              className="text-xs font-semibold text-[#166534] hover:text-[#14532D] shrink-0"
            >
              Đã lưu
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-[#BBF7D0] bg-white p-2.5 space-y-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#575652]">
                  Device API Key
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('new-apikey', createdCred.apiKey)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#15803D] hover:underline"
                >
                  {copiedKey === 'new-apikey' ? <Check className="size-3" /> : <Copy className="size-3" />}
                  {copiedKey === 'new-apikey' ? 'Đã chép' : 'Sao chép'}
                </button>
              </div>
              <code className="block text-xs font-mono text-[#141413] break-all">
                {createdCred.apiKey}
              </code>
            </div>

            <div className="rounded-lg border border-[#BBF7D0] bg-white p-2.5 space-y-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#575652]">
                  Lệnh nạp cấu hình Wi-Fi
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('new-wifiset', createdCred.wifiSetCommand)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#15803D] hover:underline"
                >
                  {copiedKey === 'new-wifiset' ? <Check className="size-3" /> : <Copy className="size-3" />}
                  {copiedKey === 'new-wifiset' ? 'Đã chép' : 'Sao chép'}
                </button>
              </div>
              <code className="block text-xs font-mono text-[#141413] break-all">
                {createdCred.wifiSetCommand}
              </code>
            </div>
          </div>
        </Card>
      )}

      {/* TOP HEADER & ACTION BAR */}
      <Card className="p-4 border-[#DCE6DF] bg-white">
        <div className="flex flex-col gap-3">
          {/* Row 1: Title + Active Status Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[#ECFDF3] text-[#16A34A] shrink-0">
                <Cpu className="size-4" aria-hidden />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-[#141413]">
                Kết nối Thiết bị Đo Sóng Não
              </h2>
            </div>

            {isWorkspaceOpen && (
              <div className="inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] px-2.5 py-1 text-xs font-mono tabular-nums">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 font-sans font-semibold',
                    isStrokeAlert || selectedDevice?.status === 'ALERT'
                      ? 'text-red-700'
                      : 'text-[#15803D]',
                  )}
                >
                  <span className={cn('size-2 rounded-full', statusMeta.dot)} aria-hidden />
                  {statusMeta.label}
                </span>
                <span className="text-[#CBD5E1]" aria-hidden>·</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 font-semibold',
                    batteryPct !== null && batteryPct < 20 ? 'text-amber-700' : 'text-[#262624]',
                  )}
                  title={batteryMv !== null ? `${batteryMv} mV` : undefined}
                >
                  <Battery className="size-3.5 text-[#16A34A] shrink-0" aria-hidden />
                  {batteryPct !== null ? `${batteryPct}%` : '—'}
                </span>
                <span className="text-[#CBD5E1]" aria-hidden>·</span>
                <span className="font-semibold text-[#262624]">
                  {selectedDevice?.sampleRateSps ?? 500} Hz
                </span>
                <span className="text-[#CBD5E1]" aria-hidden>·</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 font-bold',
                    isStrokeAlert ? 'text-red-700' : 'text-[#15803D]',
                  )}
                >
                  <Radio className="size-3 shrink-0" aria-hidden />
                  {formatFriendlyAiStatus(aiState, isProfessional)}
                </span>
              </div>
            )}
          </div>

          {/* Row 2: Workspace Controls when active */}
          {isWorkspaceOpen && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#DCE6DF]">
              {devices.length > 0 && (
                <select
                  aria-label="Chọn thiết bị đo sóng não"
                  value={selectedDevice?.id ?? ''}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="h-8.5 max-w-[200px] rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] px-2.5 text-xs font-semibold text-[#141413] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/25"
                >
                  {devices.map((dev) => (
                    <option key={dev.id} value={dev.id}>
                      {dev.deviceCode} · {dev.name}
                    </option>
                  ))}
                </select>
              )}

              <select
                aria-label="Kịch bản mô phỏng"
                value={simScenario}
                onChange={(e) => {
                  const next = e.target.value as DeviceSimulationScenario;
                  setSimScenario(next);
                  if (isSimulating && selectedDevice) {
                    simulateMutation.mutate({ id: selectedDevice.id, scenario: next });
                  }
                }}
                className="h-8.5 rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] px-2 text-xs font-medium text-[#262624] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/25"
              >
                <option value="normal">Bình thường</option>
                <option value="stroke_alert">Cảnh báo Đột quỵ</option>
                <option value="low_battery">Pin yếu</option>
              </select>

              {isSimulating ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleStopDemo}
                  icon={<Square className="size-3.5 text-red-600" aria-hidden />}
                >
                  Dừng mô phỏng
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  loading={simulateMutation.isPending}
                  onClick={handleStartDemo}
                  icon={<Activity className="size-3.5" aria-hidden />}
                >
                  Bật mô phỏng trực tiếp (Demo)
                </Button>
              )}

              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setShowAddForm((v) => !v)}
                icon={<Plus className="size-3.5" aria-hidden />}
              >
                Thêm thiết bị
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* PLUG-AND-PLAY CENTER STATE WHEN NO REAL DEVICE CONNECTED AND DEMO IS OFF */}
      {!isWorkspaceOpen && (
        <Card className="p-8 sm:p-10 border-[#DCE6DF] bg-white text-center space-y-5">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#ECFDF3] text-[#16A34A] border border-[#BBF7D0]">
            <Activity className="size-7" aria-hidden />
          </div>
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h3 className="text-base sm:text-lg font-bold text-[#141413]">
              Sẵn sàng đo sóng não trực tiếp
            </h3>
            <p className="text-xs sm:text-sm text-[#6E6D68]">
              Bật mô phỏng trực tiếp để trải nghiệm sóng não 6 kênh và cảnh báo ngay, hoặc mở cấu hình để kết nối thiết bị đo thật.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              size="md"
              variant="primary"
              loading={simulateMutation.isPending}
              onClick={handleStartDemo}
              icon={<Play className="size-4" aria-hidden />}
              className="px-5 shadow-sm"
            >
              Bật mô phỏng trực tiếp (Demo)
            </Button>
            <Button
              type="button"
              size="md"
              variant="outline"
              onClick={() => {
                setShowRealSetup((v) => !v);
                setShowAddForm((prev) => (devices.length === 0 ? true : prev));
              }}
              icon={<Wifi className="size-4 text-[#16A34A]" aria-hidden />}
            >
              Cấu hình thiết bị thật
            </Button>
          </div>
        </Card>
      )}

      {/* REAL DEVICE SELECTOR & INLINE ADD DEVICE FORM (when configuring real device or workspace open) */}
      {(showRealSetup || (isWorkspaceOpen && showAddForm)) && (
        <Card className="p-4 border-[#DCE6DF] bg-[#F5FAF7] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#141413]">
              Cấu hình thiết bị đo sóng não
            </h3>
            <div className="flex items-center gap-2">
              {devices.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <select
                    aria-label="Chọn thiết bị đã lưu"
                    value={selectedDevice?.id ?? ''}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="h-8 rounded-lg border border-[#DCE6DF] bg-white px-2.5 text-xs font-semibold text-[#141413]"
                  >
                    {devices.map((dev) => (
                      <option key={dev.id} value={dev.id}>
                        {dev.deviceCode} · {dev.name}
                      </option>
                    ))}
                  </select>
                  {selectedDevice && (
                    <button
                      type="button"
                      disabled={deleteDeviceMutation.isPending}
                      onClick={() => {
                        if (window.confirm(`Xóa thiết bị ${selectedDevice.deviceCode}?`)) {
                          deleteDeviceMutation.mutate(selectedDevice.id);
                        }
                      }}
                      aria-label={`Xóa thiết bị ${selectedDevice.deviceCode}`}
                      title="Xóa thiết bị"
                      className="inline-flex size-8 items-center justify-center rounded-lg border border-[#DCE6DF] bg-white text-[#6E6D68] hover:text-red-600 hover:border-red-200 transition-colors"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  )}
                </div>
              )}
              {!isWorkspaceOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setShowRealSetup(false);
                    setShowAddForm(false);
                  }}
                  className="text-xs font-medium text-[#6E6D68] hover:text-[#141413]"
                >
                  Đóng
                </button>
              )}
              {isWorkspaceOpen && showAddForm && (
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs font-medium text-[#6E6D68] hover:text-[#141413]"
                >
                  Đóng
                </button>
              )}
            </div>
          </div>

          {(showAddForm || devices.length === 0) && (
            <form onSubmit={handleAddSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-xs pt-1">
              <div className="sm:col-span-2 space-y-1">
                <label htmlFor="hw-dev-name" className="font-semibold text-[#262624] block">
                  Tên thiết bị *
                </label>
                <Input
                  id="hw-dev-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="VD: Holter Phòng khám 02"
                  className="bg-white h-9"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="hw-dev-code" className="font-semibold text-[#262624] block">
                  Mã thiết bị
                </label>
                <Input
                  id="hw-dev-code"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="Tự sinh (NL-...)"
                  className="bg-white h-9 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="hw-dev-rate" className="font-semibold text-[#262624] block">
                  Tần số (Hz)
                </label>
                <select
                  id="hw-dev-rate"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200/90 bg-white px-2.5 text-sm text-[#141413] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20"
                >
                  <option value="250">250 mẫu/giây (Hz)</option>
                  <option value="500">500 mẫu/giây (Hz)</option>
                  <option value="1000">1000 mẫu/giây (Hz)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="hw-dev-pga" className="font-semibold text-[#262624] block">
                  Độ khuếch đại / Kênh
                </label>
                <div className="flex gap-1.5">
                  <select
                    id="hw-dev-pga"
                    value={newPga}
                    onChange={(e) => setNewPga(e.target.value)}
                    className="h-9 w-20 rounded-lg border border-slate-200/90 bg-white px-2 text-xs text-[#141413]"
                  >
                    <option value="1">×1</option>
                    <option value="4">×4</option>
                    <option value="8">×8</option>
                    <option value="12">×12</option>
                    <option value="24">×24</option>
                  </select>
                  <select
                    aria-label="Chọn sơ đồ kênh"
                    value={newMontage}
                    onChange={(e) => setNewMontage(e.target.value)}
                    className="h-9 flex-1 min-w-0 rounded-lg border border-slate-200/90 bg-white px-2 text-xs text-[#141413]"
                  >
                    <option value="neurolink6">6 kênh (chuẩn)</option>
                    <option value="10-20-8ch">8 kênh mở rộng</option>
                  </select>
                </div>
              </div>

              <div className="sm:col-span-2 lg:col-span-5 flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    if (!isWorkspaceOpen) setShowRealSetup(false);
                  }}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  loading={createDeviceMutation.isPending}
                  icon={<Plus className="size-3.5" aria-hidden />}
                >
                  Tạo & Sinh khóa kết nối
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}

      {/* LIVE 6-CHANNEL OSCILLOSCOPE + ALERTS + SESSIONS (ONLY WHEN CONNECTED OR SIMULATING) */}
      {isWorkspaceOpen && (
        <>
          {/* LIVE 6-CHANNEL OSCILLOSCOPE + LEAD-OFF BAR */}
          <Card className="p-4 border-[#DCE6DF] bg-white space-y-3">
            {/* Oscilloscope Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <h3 className="text-sm font-bold text-[#141413]">
                  Dao động ký 6 kênh trực tiếp
                </h3>
                <span className="rounded-md border border-[#DCE6DF] bg-[#F5FAF7] px-2 py-0.5 font-mono text-xs font-semibold text-[#15803D] tabular-nums">
                  {displaySps} mẫu/giây (Hz)
                </span>
                <span className="font-mono text-xs text-[#6E6D68] tabular-nums">
                  {liveStats.total.toLocaleString('vi-VN')} mẫu
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <div className="inline-flex rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] p-0.5 text-xs">
                  {([50, 100, 200] as const).map((uv) => (
                    <button
                      key={uv}
                      type="button"
                      onClick={() => setScaleUv(uv)}
                      className={cn(
                        'rounded-md px-2 py-0.5 font-mono font-medium transition-colors',
                        scaleUv === uv
                          ? 'bg-[#16A34A] text-white'
                          : 'text-[#575652] hover:text-[#15803D]',
                      )}
                    >
                      ±{uv}µV
                    </button>
                  ))}
                </div>

                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => setScopePaused((p) => !p)}
                  icon={
                    scopePaused ? (
                      <Play className="size-3.5 text-[#16A34A]" aria-hidden />
                    ) : (
                      <Pause className="size-3.5 text-[#575652]" aria-hidden />
                    )
                  }
                >
                  {scopePaused ? 'Tiếp tục' : 'Tạm dừng'}
                </Button>
              </div>
            </div>

            {/* Canvas Container (dedicated mounted child guarantees ResizeObserver + rAF init) */}
            {(selectedDevice || isSimulating) && (
              <OscilloscopeCanvas
                isProfessional={isProfessional}
                scaleUv={scaleUv}
                scopePaused={scopePaused}
                ringRef={ringRef}
                writeIdxRef={writeIdxRef}
                filledCountRef={filledCountRef}
                dirtyRef={dirtyRef}
              />
            )}

            {/* Electrode Impedance / Lead-Off Bar */}
            <div className="rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#141413]">
                  Độ bám điện cực
                </span>
                <span
                  className={cn(
                    'font-mono font-semibold tabular-nums',
                    goodElectrodes === CHANNEL_COUNT ? 'text-[#15803D]' : 'text-amber-700',
                  )}
                >
                  {goodElectrodes}/{CHANNEL_COUNT} điện cực bám tốt
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {CHANNEL_NAMES.map((ch, idx) => {
                  const isLeadOff = (activeLoffMask & (1 << idx)) !== 0;
                  return (
                    <div
                      key={ch}
                      className={cn(
                        'flex items-center justify-between gap-1 rounded-md border px-2 py-1.5 text-xs',
                        isLeadOff
                          ? 'border-red-200 bg-red-50 text-red-700'
                          : 'border-[#DCE6DF] bg-white text-[#141413]',
                      )}
                    >
                      <span className="font-mono font-semibold">
                        CH{idx + 1}·{ch}
                      </span>
                      <span
                        className={cn(
                          'size-2 rounded-full shrink-0',
                          isLeadOff ? 'bg-red-600' : 'bg-[#16A34A]',
                        )}
                        title={isLeadOff ? 'Bong điện cực / Mất tiếp xúc' : 'Tiếp xúc tốt'}
                        aria-label={isLeadOff ? `${ch} mất tiếp xúc` : `${ch} tiếp xúc tốt`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Edge AI Quick Telemetry Strip + Remote Device Controls */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-1">
              {/* Edge AI metrics */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-[#575652]">
                <span className="rounded-md bg-[#F5FAF7] border border-[#DCE6DF] px-2 py-1">
                  DAR: {displayDar !== null && displayDar !== undefined ? displayDar.toFixed(2) : '—'}
                </span>
                <span className="rounded-md bg-[#F5FAF7] border border-[#DCE6DF] px-2 py-1">
                  BSI: {displayBsi !== null && displayBsi !== undefined ? displayBsi.toFixed(2) : '—'}
                </span>
              </div>

              {/* Remote controls */}
              <div className="flex flex-wrap items-center gap-2">
                {isProfessional && (
                  <>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={!selectedDevice}
                      loading={commandMutation.isPending && commandMutation.variables?.command === 'MKR'}
                      onClick={() =>
                        selectedDevice && commandMutation.mutate({ id: selectedDevice.id, command: 'MKR' })
                      }
                      icon={<Flag className="size-3.5 text-[#16A34A]" aria-hidden />}
                    >
                      Đánh dấu sự kiện
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={!selectedDevice}
                      loading={commandMutation.isPending && commandMutation.variables?.command === 'REC_START'}
                      onClick={() =>
                        selectedDevice &&
                        commandMutation.mutate({ id: selectedDevice.id, command: 'REC_START' })
                      }
                      icon={<Play className="size-3.5 text-[#16A34A]" aria-hidden />}
                    >
                      Ghi thẻ nhớ
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={!selectedDevice}
                      loading={commandMutation.isPending && commandMutation.variables?.command === 'REC_STOP'}
                      onClick={() =>
                        selectedDevice &&
                        commandMutation.mutate({ id: selectedDevice.id, command: 'REC_STOP' })
                      }
                      icon={<Square className="size-3.5 text-[#575652]" aria-hidden />}
                    >
                      Dừng ghi
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  size="xs"
                  variant="primary"
                  disabled={!selectedDevice}
                  loading={captureSessionMutation.isPending}
                  onClick={handleCaptureSession}
                  icon={<Save className="size-3.5" aria-hidden />}
                >
                  Lưu phiên &amp; Đọc qEEG
                </Button>
              </div>
            </div>
          </Card>

          {/* LIVE ALERTS & RECORDED SESSIONS */}
          <div className="grid gap-4 lg:grid-cols-12 items-start">
            {/* Live Alerts */}
            <Card className="lg:col-span-5 p-0 overflow-hidden border-[#DCE6DF] bg-white min-w-0">
              <div className="px-4 py-3 bg-[#F5FAF7] border-b border-[#DCE6DF] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="size-4 text-[#16A34A] shrink-0" aria-hidden />
                  <h3 className="text-sm font-bold text-[#141413]">Cảnh báo phần cứng</h3>
                </div>
                <span className="rounded-full bg-white border border-[#DCE6DF] px-2 py-0.5 text-xs font-mono font-semibold text-[#575652] tabular-nums">
                  {unackedAlertsCount} mới
                </span>
              </div>

              {deviceAlerts.length === 0 ? (
                <div className="p-5 text-center text-xs text-[#6E6D68]">
                  Chưa có cảnh báo nào. Hệ thống hoạt động ổn định.
                </div>
              ) : (
                <div className="divide-y divide-[#DCE6DF] max-h-80 overflow-y-auto">
                  {deviceAlerts.slice(0, 12).map((alert) => {
                    const isDemoAlert = alert.id.startsWith('demo-');
                    return (
                      <div
                        key={alert.id}
                        className={cn(
                          'p-3 flex items-start justify-between gap-2.5 text-xs',
                          alert.acknowledged ? 'bg-white opacity-70' : 'bg-[#F5FAF7]/50',
                        )}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                'rounded border px-1.5 py-0.5 text-[10px] font-bold',
                                isProfessional && 'font-mono',
                                formatAlertBadge(alert.severity),
                              )}
                            >
                              {formatAlertCodeLabel(alert.code, isProfessional)}
                            </span>
                            <span className="font-mono text-[11px] text-[#6E6D68] tabular-nums">
                              {formatDateTime(alert.createdAt)}
                            </span>
                          </div>
                          <p className="text-[#262624] leading-snug">
                            {formatAlertMessageText(alert.message, isProfessional)}
                          </p>
                        </div>

                        {!alert.acknowledged && !isDemoAlert ? (
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            loading={
                              ackAlertMutation.isPending &&
                              ackAlertMutation.variables?.alertId === alert.id
                            }
                            onClick={() =>
                              ackAlertMutation.mutate({
                                deviceId: alert.deviceId,
                                alertId: alert.id,
                              })
                            }
                            className="shrink-0"
                          >
                            Đã xem
                          </Button>
                        ) : (
                          <span className="text-[11px] font-medium text-[#15803D] shrink-0">
                            {isDemoAlert ? 'Mô phỏng' : 'Đã xác nhận'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Saved Hardware Sessions */}
            <Card className="lg:col-span-7 p-0 overflow-hidden border-[#DCE6DF] bg-white min-w-0">
              <div className="px-4 py-3 bg-[#F5FAF7] border-b border-[#DCE6DF] flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[#141413]">
                  Phiên ghi đã lưu ({sessions.length})
                </h3>
                <span className="text-xs text-[#6E6D68]">Tự động phân tích qEEG</span>
              </div>

              {sessions.length === 0 ? (
                <div className="p-5 text-center text-xs text-[#6E6D68]">
                  Chưa có phiên ghi phần cứng. Bấm &quot;Lưu phiên &amp; Đọc qEEG&quot; sau khi thu tín hiệu.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#DCE6DF] bg-[#F5FAF7] text-[11px] font-semibold uppercase tracking-wider text-[#6E6D68]">
                        <th className="py-2.5 px-3">Phiên ghi</th>
                        <th className="py-2.5 px-3">Đạo trình</th>
                        <th className="py-2.5 px-3 text-right">Mẫu / Thời lượng</th>
                        <th className="py-2.5 px-3">Kết quả qEEG</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCE6DF]">
                      {sessions.slice(0, 12).map((session) => {
                        const summary = summarizeSessionQeeg(session);
                        return (
                          <tr key={session.id} className="hover:bg-[#F5FAF7]/80">
                            <td className="py-2.5 px-3 align-top">
                              <div className="font-semibold text-[#141413]">{session.title}</div>
                              <div className="text-[11px] text-[#6E6D68] font-mono tabular-nums mt-0.5">
                                {formatDateTime(session.startedAt)}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 align-top font-mono text-[#575652] whitespace-nowrap">
                              {session.montage} · {session.sampleRateSps} Hz
                            </td>
                            <td className="py-2.5 px-3 align-top text-right font-mono text-[#262624] tabular-nums whitespace-nowrap">
                              <div>{session.sampleCount.toLocaleString('vi-VN')} mẫu</div>
                              <div className="text-[11px] text-[#6E6D68]">
                                {session.durationSec.toFixed(1)}s
                              </div>
                            </td>
                            <td className="py-2.5 px-3 align-top">
                              <span
                                className={cn(
                                  'inline-block rounded border px-1.5 py-0.5 text-[11px] font-semibold',
                                  summary.tone === 'red'
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : summary.tone === 'amber'
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : summary.tone === 'emerald'
                                        ? 'bg-[#ECFDF3] text-[#15803D] border-[#BBF7D0]'
                                        : 'bg-[#F5FAF7] text-[#6E6D68] border-[#DCE6DF]',
                                )}
                              >
                                {summary.label}
                              </span>
                              <div className="text-[11px] font-mono text-[#6E6D68] mt-0.5 tabular-nums">
                                {summary.metrics}
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
          </div>
        </>
      )}

      {/* HARDWARE CONNECTION & NODE-RED CENTER (COLLAPSIBLE — ESP32 / ADS1299 DETAILS INSIDE ONLY) */}
      {(isWorkspaceOpen || showRealSetup) && (
        <Card className="p-0 overflow-hidden border-[#DCE6DF] bg-white">
          <button
            type="button"
            onClick={() => setShowGatewayCenter((v) => !v)}
            className="w-full px-4 py-3 bg-[#F5FAF7] flex items-center justify-between gap-2 text-left hover:bg-[#ECFDF3]/70 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Wifi className="size-4 text-[#16A34A] shrink-0" aria-hidden />
              <span className="text-sm font-bold text-[#141413] truncate">
                Cấu hình kỹ thuật (Dành cho kỹ thuật viên)
              </span>
            </div>
            {showGatewayCenter ? (
              <ChevronUp className="size-4 text-[#575652] shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="size-4 text-[#575652] shrink-0" aria-hidden />
            )}
          </button>

          {showGatewayCenter && (
            <div className="p-4 border-t border-[#DCE6DF] space-y-3">
              <p className="text-xs text-[#575652]">
                Thông số kết nối phần cứng mạch thu thập tín hiệu <strong className="text-[#141413]">ESP32 &amp; TI ADS1299</strong> (24-bit ADC, 500 Hz).
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                {/* WebSocket Direct */}
                <div className="rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] p-3 space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#141413]">WebSocket trực tiếp</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('ws-url', wsFullUrl)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#15803D] hover:underline shrink-0"
                    >
                      {copiedKey === 'ws-url' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copiedKey === 'ws-url' ? 'Đã chép' : 'Sao chép'}
                    </button>
                  </div>
                  <code className="block rounded border border-[#DCE6DF] bg-white px-2.5 py-1.5 text-xs font-mono text-[#141413] break-all">
                    {wsFullUrl}
                  </code>
                </div>

                {/* Node-RED Gateway (Professionals only) */}
                {isProfessional && (
                  <div className="rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] p-3 space-y-1.5 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#141413]">Node-RED Gateway</span>
                      <a
                        href={nodeRedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#15803D] hover:underline shrink-0"
                      >
                        <span>Mở giao diện</span>
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    </div>
                    <code className="block rounded border border-[#DCE6DF] bg-white px-2.5 py-1.5 text-xs font-mono text-[#141413] break-all">
                      {nodeRedUrl}
                    </code>
                  </div>
                )}

                {/* Ingestion API */}
                <div className="rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] p-3 space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#141413]">Ingestion API</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('ingest-api', `${ingestPath}/*`)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#15803D] hover:underline shrink-0"
                    >
                      {copiedKey === 'ingest-api' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copiedKey === 'ingest-api' ? 'Đã chép' : 'Sao chép'}
                    </button>
                  </div>
                  <code className="block rounded border border-[#DCE6DF] bg-white px-2.5 py-1.5 text-xs font-mono text-[#141413] break-all">
                    POST {ingestPath}/telemetry · /samples · /alert · /epoch
                  </code>
                </div>

                {/* ESP32 Serial CLI Command */}
                <div className="rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] p-3 space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#141413]">Lệnh Serial ESP32</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('wifi-cli', wifiSetCli)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#15803D] hover:underline shrink-0"
                    >
                      {copiedKey === 'wifi-cli' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copiedKey === 'wifi-cli' ? 'Đã chép' : 'Sao chép'}
                    </button>
                  </div>
                  <code className="block rounded border border-[#DCE6DF] bg-white px-2.5 py-1.5 text-xs font-mono text-[#141413] break-all">
                    {wifiSetCli}
                  </code>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
