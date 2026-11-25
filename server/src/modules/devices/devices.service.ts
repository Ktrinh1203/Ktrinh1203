import { randomBytes, timingSafeEqual } from 'node:crypto';
import type {
  DeviceAlert,
  DeviceAlertSeverity,
  DeviceRecordingSession,
  DeviceStatus,
  HardwareDevice,
  Prisma,
  Role,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { sha256 } from '../../lib/crypto.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../../lib/errors.js';
import { env, isProduction } from '../../config/env.js';
import { realtimeBus } from '../realtime/realtime.bus.js';
import { analyzeCsvTs } from '../qeeg/qeeg-dsp.engine.js';
import {
  appendBufferedSamples,
  clearBufferedSamples,
  getBufferedSamples,
  isDeviceWsConnected,
  sendCommandToWsDevice,
} from './hardware.ws.js';
import type {
  BleSyncInput,
  CaptureSessionInput,
  CreateDeviceInput,
  IngestAlertInput,
  IngestEpochInput,
  IngestSamplesInput,
  IngestTelemetryInput,
  RawTelemetryFields,
  SimulateDeviceInput,
  UpdateDeviceInput,
} from './devices.schemas.js';

export const DEFAULT_8CH_NAMES = ['F3', 'F4', 'C3', 'C4', 'O1', 'O2', 'T3', 'T4'] as const;

const ALERT_DEBOUNCE_WINDOW_MS = 30_000;
const WAVEFORM_SSE_THROTTLE_MS = 50;
const SAMPLES_DB_TOUCH_INTERVAL_MS = 1_500;

const lastWaveformEmitMsByDevice = new Map<string, number>();
const lastSamplesDbTouchMsByDevice = new Map<string, number>();

export interface SerializedHardwareDevice {
  id: string;
  ownerId: string;
  deviceCode: string;
  name: string;
  model: string;
  firmwareVersion: string;
  montage: string;
  sampleRateSps: number;
  pgaGain: number;
  apiKeyPrefix: string;
  status: DeviceStatus;
  connectionSource: string;
  ipAddress: string | null;
  lastSeenAt: string | null;
  lastBatteryMv: number | null;
  lastBatteryPct: number | null;
  lastAiState: string | null;
  lastAiRfProb: number | null;
  lastAiBsi: number | null;
  lastAiDar: number | null;
  lastLeadOffMask: number | null;
  sdRecording: boolean;
  isWsConnected: boolean;
  wsConnected: boolean;
  bufferedSampleCount: number;
  createdAt: string;
  updatedAt: string;
}

export function serializeDevice(device: HardwareDevice): SerializedHardwareDevice {
  const wsConnected = isDeviceWsConnected(device.deviceCode);
  return {
    id: device.id,
    ownerId: device.ownerId,
    deviceCode: device.deviceCode,
    name: device.name,
    model: device.model,
    firmwareVersion: device.firmwareVersion,
    montage: device.montage,
    sampleRateSps: device.sampleRateSps,
    pgaGain: device.pgaGain,
    apiKeyPrefix: device.apiKeyPrefix,
    status: device.status,
    connectionSource: device.connectionSource,
    ipAddress: device.ipAddress,
    lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
    lastBatteryMv: device.lastBatteryMv,
    lastBatteryPct: device.lastBatteryPct,
    lastAiState: device.lastAiState,
    lastAiRfProb: device.lastAiRfProb,
    lastAiBsi: device.lastAiBsi,
    lastAiDar: device.lastAiDar,
    lastLeadOffMask: device.lastLeadOffMask,
    sdRecording: device.sdRecording,
    isWsConnected: wsConnected,
    wsConnected,
    bufferedSampleCount: getBufferedSamples(device.deviceCode).length,
    createdAt: device.createdAt.toISOString(),
    updatedAt: device.updatedAt.toISOString(),
  };
}

function timingSafeStringEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface IngestAuthContext {
  authMode: 'nodered' | 'device';
  authenticatedDevice?: HardwareDevice;
}

export async function authenticateIngestRequest(params: {
  nodeRedSecret?: string;
  deviceKey?: string;
  deviceCodeHint?: string;
}): Promise<IngestAuthContext> {
  const { nodeRedSecret, deviceKey, deviceCodeHint } = params;

  if (nodeRedSecret && timingSafeStringEqual(nodeRedSecret.trim(), env.NODERED_INGEST_SECRET)) {
    return { authMode: 'nodered' };
  }

  if (deviceKey && deviceKey.trim().length >= 8) {
    const hashed = sha256(deviceKey.trim());
    const device = await prisma.hardwareDevice.findFirst({
      where: { apiKeyHash: hashed },
    });
    if (device) {
      if (
        deviceCodeHint &&
        device.deviceCode.toUpperCase() !== deviceCodeHint.trim().toUpperCase()
      ) {
        throw unauthorized('Device API key does not match target deviceCode');
      }
      return { authMode: 'device', authenticatedDevice: device };
    }
  }

  throw unauthorized('Missing or invalid x-nodered-secret / x-device-key header');
}

async function resolveTargetDevice(params: {
  deviceId?: string;
  deviceCode?: string;
  authenticatedDevice?: HardwareDevice;
}): Promise<HardwareDevice> {
  if (params.authenticatedDevice) {
    if (params.deviceId && params.deviceId !== params.authenticatedDevice.id) {
      throw forbidden('API key is bound to another device');
    }
    return params.authenticatedDevice;
  }

  if (params.deviceId) {
    const byId = await prisma.hardwareDevice.findUnique({ where: { id: params.deviceId } });
    if (!byId) throw notFound('Hardware device not found');
    return byId;
  }

  if (params.deviceCode && params.deviceCode.trim().length > 0) {
    const code = params.deviceCode.trim();
    const byCode =
      (await prisma.hardwareDevice.findUnique({ where: { deviceCode: code } })) ??
      (await prisma.hardwareDevice.findUnique({ where: { deviceCode: code.toUpperCase() } }));
    if (!byCode) throw notFound(`Hardware device ${code} not found`);
    return byCode;
  }

  if (!isProduction) {
    const fallback =
      (await prisma.hardwareDevice.findUnique({ where: { deviceCode: 'NL-HOLTER-01' } })) ??
      (await prisma.hardwareDevice.findFirst({ orderBy: { createdAt: 'desc' } }));
    if (fallback) return fallback;
  }

  throw badRequest('deviceCode or deviceId is required');
}

async function assertDeviceOwnership(
  userId: string,
  role: Role,
  deviceId: string,
): Promise<HardwareDevice> {
  const device = await prisma.hardwareDevice.findUnique({ where: { id: deviceId } });
  if (!device) throw notFound('Không tìm thấy thiết bị phần cứng');
  if (device.ownerId !== userId && role !== 'ADMIN') {
    throw forbidden('Bạn không có quyền thao tác với thiết bị này');
  }
  return device;
}

function normalizeSampleRows(samples: number[][] | number[]): number[][] {
  const rows: number[][] = Array.isArray(samples[0])
    ? (samples as number[][])
    : [samples as number[]];

  return rows.map((row) => {
    const out = new Array<number>(8);
    for (let ch = 0; ch < 8; ch++) {
      const v = row[ch];
      out[ch] = typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1000) / 1000 : 0;
    }
    return out;
  });
}

function describeLeadOffChannels(mask: number): string {
  const disconnected: string[] = [];
  for (let i = 0; i < 8; i++) {
    if ((mask & (1 << i)) !== 0) {
      disconnected.push(`${DEFAULT_8CH_NAMES[i] ?? `CH${i + 1}`} (CH${i + 1})`);
    }
  }
  return disconnected.length > 0 ? disconnected.join(', ') : `0x${mask.toString(16).toUpperCase()}`;
}

async function createDebouncedAlert(params: {
  device: HardwareDevice;
  severity: DeviceAlertSeverity;
  code: string;
  message: string;
}): Promise<DeviceAlert | null> {
  const cutoff = new Date(Date.now() - ALERT_DEBOUNCE_WINDOW_MS);
  const existing = await prisma.deviceAlert.findFirst({
    where: {
      deviceId: params.device.id,
      code: params.code,
      acknowledged: false,
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    return null;
  }

  const alert = await prisma.deviceAlert.create({
    data: {
      deviceId: params.device.id,
      severity: params.severity,
      code: params.code,
      message: params.message.slice(0, 500),
    },
  });

  realtimeBus.emitToUser(params.device.ownerId, 'device:alert', {
    deviceId: params.device.id,
    deviceCode: params.device.deviceCode,
    alert: {
      ...alert,
      deviceCode: params.device.deviceCode,
      deviceName: params.device.name,
    },
  });

  return alert;
}

function buildCsvFromSamples(samples: number[][], channelNames: string[]): string {
  const headers = channelNames.slice(0, 8);
  const lines = [headers.join(',')];
  for (const row of samples) {
    const vals: string[] = [];
    for (let i = 0; i < headers.length; i++) {
      const v = row[i] ?? 0;
      vals.push(Number.isFinite(v) ? v.toFixed(3) : '0.000');
    }
    lines.push(vals.join(','));
  }
  return lines.join('\n');
}

function buildCompactCsvSummary(csvText: string, maxRows = 120): string {
  const lines = csvText.split(/\r?\n/);
  if (lines.length <= maxRows + 1) return csvText.slice(0, 16000);
  return lines.slice(0, maxRows + 1).join('\n').slice(0, 16000);
}

// ---------------------------------------------------------------------------
// Ingestion Pipeline (WebSocket Direct + Node-RED HTTP + Built-in Simulator)
// ---------------------------------------------------------------------------

export async function ingestTelemetry(params: {
  deviceId?: string;
  deviceCode?: string;
  telemetry?: RawTelemetryFields | Record<string, unknown>;
  flatFields?: IngestTelemetryInput;
  source?: string;
  ipAddress?: string;
  authenticatedDevice?: HardwareDevice;
}) {
  const device = await resolveTargetDevice({
    deviceId: params.deviceId ?? params.flatFields?.deviceId,
    deviceCode: params.deviceCode ?? params.flatFields?.deviceCode,
    authenticatedDevice: params.authenticatedDevice,
  });

  const merged: Record<string, unknown> = {
    ...(params.flatFields ?? {}),
    ...(params.flatFields?.telemetry ?? {}),
    ...(params.telemetry ?? {}),
  };

  const num = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
    return null;
  };
  const intVal = (v: unknown, fallback: number): number => {
    const n = num(v);
    return n !== null ? Math.round(n) : fallback;
  };
  const boolVal = (v: unknown, fallback: boolean): boolean =>
    typeof v === 'boolean' ? v : fallback;
  const strVal = (v: unknown, fallback: string): string =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim() : fallback;

  const mode = strVal(merged.mode, 'EEG').slice(0, 20);
  const firmwareVersion = strVal(
    merged.firmwareVersion ?? merged.fw,
    device.firmwareVersion,
  ).slice(0, 30);
  const rateSps = Math.max(1, intVal(merged.rateSps ?? merged.rate_sps, device.sampleRateSps));
  const pga = Math.max(1, Math.min(24, intVal(merged.pga ?? merged.pgaGain, device.pgaGain)));
  const actualSps = num(merged.actualSps ?? merged.sps);
  const vbatMv = Math.max(0, intVal(merged.vbatMv ?? merged.vbat_mv, device.lastBatteryMv ?? 3900));
  const batPct = Math.max(
    0,
    Math.min(100, intVal(merged.batPct ?? merged.bat_pct, device.lastBatteryPct ?? 85)),
  );
  const usbOnly = boolVal(merged.usbOnly ?? merged.usb_only, false);
  const sdRec = boolVal(merged.sdRec ?? merged.sd_rec, device.sdRecording);
  const markers = Math.max(0, intVal(merged.markers, 0));
  const loffMask = Math.max(0, Math.min(255, intVal(merged.loffMask ?? merged.loff_p, 0)));
  const aiState = strVal(merged.aiState ?? merged.ai_state, 'NORMAL').slice(0, 40);
  const aiRfProb = num(merged.aiRfProb ?? merged.ai_rf_prob);
  const aiLrProb = num(merged.aiLrProb ?? merged.ai_lr_prob);
  const aiBsi = num(merged.aiBsi ?? merged.ai_bsi);
  const aiDar = num(merged.aiDar ?? merged.ai_dar);
  const aiUsableChRaw = num(merged.aiUsableCh ?? merged.ai_usable_ch);
  const aiUsableCh = aiUsableChRaw !== null ? Math.round(aiUsableChRaw) : null;
  const source = strVal(params.source ?? merged.source, 'NODERED_HTTP').slice(0, 30);
  const ipAddress =
    params.ipAddress ??
    (typeof merged.ipAddress === 'string' && merged.ipAddress.trim()
      ? merged.ipAddress.trim().slice(0, 64)
      : device.ipAddress);

  const isStrokeAlert = aiState.toUpperCase() === 'STROKE_ALERT';
  const isLowBattery = vbatMv > 0 && vbatMv < 3450;
  const isLeadOff = loffMask > 0;

  let nextStatus: DeviceStatus = 'ONLINE';
  if (isStrokeAlert || isLowBattery) {
    nextStatus = 'ALERT';
  } else if ((actualSps !== null && actualSps > 0) || isDeviceWsConnected(device.deviceCode)) {
    nextStatus = 'STREAMING';
  }

  const now = new Date();
  const [updatedDevice, log] = await prisma.$transaction([
    prisma.hardwareDevice.update({
      where: { id: device.id },
      data: {
        firmwareVersion,
        sampleRateSps: rateSps,
        pgaGain: pga,
        status: nextStatus,
        connectionSource: source,
        ipAddress,
        lastSeenAt: now,
        lastBatteryMv: vbatMv,
        lastBatteryPct: batPct,
        lastAiState: aiState,
        lastAiRfProb: aiRfProb,
        lastAiBsi: aiBsi,
        lastAiDar: aiDar,
        lastLeadOffMask: loffMask,
        sdRecording: sdRec,
      },
    }),
    prisma.deviceTelemetryLog.create({
      data: {
        deviceId: device.id,
        mode,
        rateSps,
        pga,
        actualSps,
        vbatMv,
        batPct,
        usbOnly,
        sdRec,
        markers,
        loffMask,
        aiState,
        aiRfProb,
        aiLrProb,
        aiBsi,
        aiDar,
        aiUsableCh,
        source,
        recordedAt: now,
      },
    }),
  ]);

  const serialized = serializeDevice(updatedDevice);
  realtimeBus.emitToUser(updatedDevice.ownerId, 'device:telemetry', {
    device: serialized,
    log,
  });

  const alertsCreated: DeviceAlert[] = [];

  if (isStrokeAlert) {
    const detailParts: string[] = [];
    if (aiDar !== null) detailParts.push(`DAR=${aiDar.toFixed(2)}`);
    if (aiBsi !== null) detailParts.push(`BSI=${aiBsi.toFixed(3)}`);
    if (aiRfProb !== null) detailParts.push(`RF=${(aiRfProb * 100).toFixed(0)}%`);
    const created = await createDebouncedAlert({
      device: updatedDevice,
      severity: 'CRITICAL',
      code: 'STROKE_ALERT',
      message: `Edge AI trên ${updatedDevice.deviceCode} phát hiện cảnh báo ĐỘT QUỴ CẤP (${detailParts.join(', ') || 'STROKE_ALERT'}). Cần kiểm tra lâm sàng và đối chiếu CT khẩn.`,
    });
    if (created) alertsCreated.push(created);
  }

  if (isLowBattery) {
    const created = await createDebouncedAlert({
      device: updatedDevice,
      severity: 'WARNING',
      code: 'LOW_BATTERY',
      message: `Pin thiết bị ${updatedDevice.deviceCode} xuống thấp (${vbatMv} mV · ${batPct}%). Vui lòng kết nối sạc USB-C để tránh gián đoạn ghi EEG.`,
    });
    if (created) alertsCreated.push(created);
  }

  if (isLeadOff) {
    const created = await createDebouncedAlert({
      device: updatedDevice,
      severity: 'WARNING',
      code: 'LEAD_OFF',
      message: `Phát hiện hở điện cực (Lead-Off) trên ${updatedDevice.deviceCode}: ${describeLeadOffChannels(loffMask)}. Kiểm tra tiếp xúc gel/điện cực.`,
    });
    if (created) alertsCreated.push(created);
  }

  return {
    ok: true,
    device: serialized,
    log,
    alertsCreated,
  };
}

export async function ingestSamples(params: {
  deviceId?: string;
  deviceCode?: string;
  montage?: string;
  sampleRateSps?: number;
  channels?: string[];
  samples: number[][] | number[];
  source?: string;
  ipAddress?: string;
  forceEmit?: boolean;
  authenticatedDevice?: HardwareDevice;
}) {
  const device = await resolveTargetDevice({
    deviceId: params.deviceId,
    deviceCode: params.deviceCode,
    authenticatedDevice: params.authenticatedDevice,
  });

  const normalized = normalizeSampleRows(params.samples);
  if (normalized.length === 0) {
    throw badRequest('samples array cannot be empty');
  }

  const bufferedCount = appendBufferedSamples(device.deviceCode, normalized);
  const nowMs = Date.now();
  const lastTouch = lastSamplesDbTouchMsByDevice.get(device.id) ?? 0;

  if (
    params.forceEmit ||
    device.status === 'OFFLINE' ||
    !device.lastSeenAt ||
    nowMs - lastTouch >= SAMPLES_DB_TOUCH_INTERVAL_MS
  ) {
    lastSamplesDbTouchMsByDevice.set(device.id, nowMs);
    await prisma.hardwareDevice.update({
      where: { id: device.id },
      data: {
        status: device.status === 'ALERT' ? 'ALERT' : 'STREAMING',
        connectionSource: (params.source ?? 'WS_DIRECT').slice(0, 30),
        ...(params.ipAddress ? { ipAddress: params.ipAddress.slice(0, 64) } : {}),
        ...(params.sampleRateSps ? { sampleRateSps: params.sampleRateSps } : {}),
        lastSeenAt: new Date(nowMs),
      },
    });
  }

  const lastEmit = lastWaveformEmitMsByDevice.get(device.id) ?? 0;
  if (params.forceEmit || nowMs - lastEmit >= WAVEFORM_SSE_THROTTLE_MS) {
    lastWaveformEmitMsByDevice.set(device.id, nowMs);
    const channels =
      params.channels && params.channels.length >= 2 ? params.channels : [...DEFAULT_8CH_NAMES];

    realtimeBus.emitToUser(device.ownerId, 'device:waveform', {
      deviceId: device.id,
      deviceCode: device.deviceCode,
      sampleRateSps: params.sampleRateSps ?? device.sampleRateSps,
      channels,
      samples: normalized,
      timestamp: new Date(nowMs).toISOString(),
    });
  }

  return {
    ok: true,
    deviceId: device.id,
    deviceCode: device.deviceCode,
    samplesIngested: normalized.length,
    bufferedCount,
  };
}

export async function ingestAlert(
  input: IngestAlertInput,
  authenticatedDevice?: HardwareDevice,
) {
  const device = await resolveTargetDevice({
    deviceId: input.deviceId,
    deviceCode: input.deviceCode,
    authenticatedDevice,
  });

  const alert = await prisma.deviceAlert.create({
    data: {
      deviceId: device.id,
      severity: input.severity,
      code: input.code,
      message: input.message,
    },
  });

  if (input.severity === 'CRITICAL') {
    await prisma.hardwareDevice.update({
      where: { id: device.id },
      data: { status: 'ALERT', lastSeenAt: new Date() },
    });
  }

  realtimeBus.emitToUser(device.ownerId, 'device:alert', {
    deviceId: device.id,
    deviceCode: device.deviceCode,
    alert: {
      ...alert,
      deviceCode: device.deviceCode,
      deviceName: device.name,
    },
  });

  return { ok: true, alert };
}

export async function ingestEpoch(
  input: IngestEpochInput,
  authenticatedDevice?: HardwareDevice,
) {
  const device = await resolveTargetDevice({
    deviceId: input.deviceId,
    deviceCode: input.deviceCode,
    authenticatedDevice,
  });

  const sampleRateSps = input.sampleRateSps ?? device.sampleRateSps;
  const montage = input.montage ?? device.montage;
  const channelNames =
    input.channelNames && input.channelNames.length >= 2
      ? input.channelNames
      : [...DEFAULT_8CH_NAMES];

  let csvText = input.csvText;
  let sampleCount = input.sampleCount ?? 0;

  if (!csvText && input.samples && input.samples.length >= 16) {
    const normalized = normalizeSampleRows(input.samples);
    sampleCount = normalized.length;
    csvText = buildCsvFromSamples(normalized, channelNames);
  }

  let qeegResultObj: Record<string, unknown> | undefined =
    input.qeegResultJson ?? input.qeegResult;

  if (!qeegResultObj && csvText) {
    try {
      const analyzed = analyzeCsvTs({
        filename: `${device.deviceCode}_epoch_${Date.now()}.csv`,
        csvText,
        samplingRateHz: sampleRateSps,
        clinicalCategory: 'HARDWARE_BCI',
      });
      qeegResultObj = JSON.parse(JSON.stringify(analyzed)) as Record<string, unknown>;
    } catch {
      // Allow storing raw epoch even if CSV had fewer than 16 valid rows
    }
  }

  if (sampleCount <= 0 && csvText) {
    sampleCount = Math.max(1, csvText.split(/\r?\n/).filter((l) => l.trim().length > 0).length - 1);
  }
  const finalSampleCount = Math.max(1, sampleCount);
  const durationSec =
    input.durationSec ?? Math.round((finalSampleCount / Math.max(1, sampleRateSps)) * 100) / 100;

  const csvSummary =
    input.csvSummary ?? (csvText ? buildCompactCsvSummary(csvText) : null);

  const now = new Date();
  const session = await prisma.deviceRecordingSession.create({
    data: {
      deviceId: device.id,
      ownerId: device.ownerId,
      title: input.title ?? `Epoch qEEG tự động · ${device.deviceCode}`,
      montage,
      sampleRateSps,
      channelNames,
      sampleCount: finalSampleCount,
      durationSec,
      csvSummary,
      qeegResultJson: qeegResultObj
        ? (JSON.parse(JSON.stringify(qeegResultObj)) as Prisma.InputJsonValue)
        : undefined,
      startedAt: new Date(now.getTime() - Math.round(durationSec * 1000)),
      endedAt: now,
    },
  });

  realtimeBus.emitToUser(device.ownerId, 'device:session', {
    deviceId: device.id,
    deviceCode: device.deviceCode,
    session: {
      ...session,
      deviceCode: device.deviceCode,
    },
  });

  return { ok: true, session };
}

// ---------------------------------------------------------------------------
// Authenticated User Device Management APIs (`/api/devices`)
// ---------------------------------------------------------------------------

export async function listDevicesDashboard(userId: string, role: Role) {
  const devices = await prisma.hardwareDevice.findMany({
    where: role === 'ADMIN' ? {} : { ownerId: userId },
    orderBy: { createdAt: 'desc' },
  });

  const deviceIds = devices.map((d) => d.id);
  const deviceMap = new Map(devices.map((d) => [d.id, d]));

  const [alerts, sessions] =
    deviceIds.length > 0
      ? await Promise.all([
          prisma.deviceAlert.findMany({
            where: { deviceId: { in: deviceIds } },
            orderBy: { createdAt: 'desc' },
            take: 30,
          }),
          prisma.deviceRecordingSession.findMany({
            where: { deviceId: { in: deviceIds } },
            orderBy: { startedAt: 'desc' },
            take: 20,
          }),
        ])
      : [[], []];

  return {
    devices: devices.map(serializeDevice),
    alerts: alerts.map((a) => {
      const dev = deviceMap.get(a.deviceId);
      return {
        ...a,
        deviceCode: dev?.deviceCode ?? '',
        deviceName: dev?.name ?? '',
        device: dev ? { id: dev.id, deviceCode: dev.deviceCode, name: dev.name } : undefined,
      };
    }),
    sessions: sessions.map((s) => {
      const dev = deviceMap.get(s.deviceId);
      return {
        ...s,
        deviceCode: dev?.deviceCode ?? '',
        deviceName: dev?.name ?? '',
        device: dev ? { id: dev.id, deviceCode: dev.deviceCode, name: dev.name } : undefined,
      };
    }),
    gateway: {
      wsPath: '/ws/hardware',
      nodeRedUrl: env.NODERED_URL,
      ingestPath: '/api/devices/ingest',
    },
  };
}

export async function registerDevice(userId: string, input: CreateDeviceInput) {
  const generatedCode = `NL-DEV-${randomBytes(3).toString('hex').toUpperCase()}`;
  const deviceCode = (input.deviceCode ?? generatedCode).trim().toUpperCase();

  const existing = await prisma.hardwareDevice.findUnique({ where: { deviceCode } });
  if (existing) {
    throw conflict(`Mã thiết bị ${deviceCode} đã tồn tại`, 'DEVICE_CODE_EXISTS');
  }

  const apiKey = `nldev_${randomBytes(18).toString('hex')}`;
  const apiKeyHash = sha256(apiKey);
  const apiKeyPrefix = apiKey.slice(0, 14);

  const created = await prisma.hardwareDevice.create({
    data: {
      ownerId: userId,
      deviceCode,
      name: input.name,
      model: input.model,
      firmwareVersion: input.firmwareVersion,
      montage: input.montage,
      sampleRateSps: input.sampleRateSps,
      pgaGain: input.pgaGain,
      apiKeyHash,
      apiKeyPrefix,
      status: 'OFFLINE',
      connectionSource: 'NONE',
    },
  });

  const wifiSetCommand = `WIFI_SET <SSID>|<PASS>|<SERVER_IP>|${env.PORT}|/ws/hardware?deviceCode=${created.deviceCode}&key=${apiKey}`;

  return {
    device: serializeDevice(created),
    apiKey,
    wifiSetCommand,
  };
}

export async function updateDevice(
  userId: string,
  role: Role,
  deviceId: string,
  input: UpdateDeviceInput,
) {
  await assertDeviceOwnership(userId, role, deviceId);

  const updated = await prisma.hardwareDevice.update({
    where: { id: deviceId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.model !== undefined ? { model: input.model } : {}),
      ...(input.firmwareVersion !== undefined ? { firmwareVersion: input.firmwareVersion } : {}),
      ...(input.montage !== undefined ? { montage: input.montage } : {}),
      ...(input.sampleRateSps !== undefined ? { sampleRateSps: input.sampleRateSps } : {}),
      ...(input.pgaGain !== undefined ? { pgaGain: input.pgaGain } : {}),
    },
  });

  return { device: serializeDevice(updated) };
}

export async function deleteDevice(userId: string, role: Role, deviceId: string): Promise<void> {
  const device = await assertDeviceOwnership(userId, role, deviceId);
  await prisma.hardwareDevice.delete({ where: { id: device.id } });
  clearBufferedSamples(device.deviceCode);
  lastWaveformEmitMsByDevice.delete(device.id);
  lastSamplesDbTouchMsByDevice.delete(device.id);
}

export async function getDeviceTelemetry(
  userId: string,
  role: Role,
  deviceId: string,
  limit = 100,
) {
  const device = await assertDeviceOwnership(userId, role, deviceId);
  const safeLimit = Math.min(500, Math.max(1, limit));

  const logs = await prisma.deviceTelemetryLog.findMany({
    where: { deviceId: device.id },
    orderBy: { recordedAt: 'desc' },
    take: safeLimit,
  });

  return {
    device: serializeDevice(device),
    logs,
    bufferedSamples: getBufferedSamples(device.deviceCode),
  };
}

export async function sendDeviceCommand(
  userId: string,
  role: Role,
  deviceId: string,
  command: string,
) {
  const device = await assertDeviceOwnership(userId, role, deviceId);
  const cleanCmd = command.trim();

  if (sendCommandToWsDevice(device.deviceCode, cleanCmd)) {
    if (cleanCmd === 'REC_START' || cleanCmd === 'REC_STOP') {
      await prisma.hardwareDevice
        .update({
          where: { id: device.id },
          data: { sdRecording: cleanCmd === 'REC_START' },
        })
        .catch(() => undefined);
    }
    return {
      dispatched: true,
      via: 'WS_DIRECT',
      command: cleanCmd,
    };
  }

  // Fallback: forward via Node-RED HTTP gateway if reachable
  try {
    const url = `${env.NODERED_URL.replace(/\/+$/, '')}/device/command`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-nodered-secret': env.NODERED_INGEST_SECRET,
      },
      body: JSON.stringify({
        deviceId: device.id,
        deviceCode: device.deviceCode,
        command: cleanCmd,
      }),
      signal: AbortSignal.timeout(1500),
    });

    if (res.ok) {
      if (cleanCmd === 'REC_START' || cleanCmd === 'REC_STOP') {
        await prisma.hardwareDevice
          .update({
            where: { id: device.id },
            data: { sdRecording: cleanCmd === 'REC_START' },
          })
          .catch(() => undefined);
      }
      return {
        dispatched: true,
        via: 'NODERED_HTTP',
        command: cleanCmd,
      };
    }
  } catch {
    // Node-RED offline or timed out
  }

  return {
    dispatched: false,
    via: 'OFFLINE',
    command: cleanCmd,
  };
}

function generateSimulatedEegBurst(
  scenario: SimulateDeviceInput['scenario'],
  sampleRateSps: number,
  sampleCount = 250,
): number[][] {
  const samples: number[][] = [];
  const tOffset = (Date.now() % 100_000) / 1000;

  for (let i = 0; i < sampleCount; i++) {
    const t = tOffset + i / sampleRateSps;
    const row: number[] = [];

    for (let ch = 0; ch < 8; ch++) {
      const phase = ch * 0.42;
      const noise = Math.sin(t * 73.1 + ch * 1.7) * 1.4 + Math.cos(t * 119.3 + ch) * 0.9;
      let uV = noise;

      if (scenario === 'stroke_alert') {
        // Pronounced left-hemisphere focal delta slowing (F3=0, C3=2, T3=6)
        const isLeftFocal = ch === 0 || ch === 2 || ch === 6;
        if (isLeftFocal) {
          uV +=
            48.0 * Math.sin(2 * Math.PI * 1.25 * t + phase) +
            24.0 * Math.sin(2 * Math.PI * 2.1 * t + 0.5) +
            10.0 * Math.sin(2 * Math.PI * 5.0 * t);
        } else {
          uV +=
            12.0 * Math.sin(2 * Math.PI * 9.8 * t + phase) +
            6.0 * Math.sin(2 * Math.PI * 18.0 * t);
        }
      } else if (scenario === 'low_battery') {
        // Normal rhythm + contact artifact on CH3 (C3, index 2)
        if (ch === 2) {
          uV += 65.0 * Math.sin(2 * Math.PI * 50.0 * t) + 18.0 * Math.sin(2 * Math.PI * 2.0 * t);
        } else {
          uV +=
            16.0 * Math.sin(2 * Math.PI * 10.1 * t + phase) +
            7.0 * Math.sin(2 * Math.PI * 19.0 * t);
        }
      } else {
        // Normal healthy posterior alpha (O1=4, O2=5) + frontal beta (F3=0, F4=1)
        if (ch === 4 || ch === 5) {
          uV += 24.0 * Math.sin(2 * Math.PI * 10.2 * t + phase);
        } else {
          uV += 11.0 * Math.sin(2 * Math.PI * 10.2 * t + phase);
        }
        if (ch === 0 || ch === 1) {
          uV += 8.5 * Math.sin(2 * Math.PI * 18.5 * t + phase);
        }
        uV += 3.2 * Math.sin(2 * Math.PI * 1.8 * t);
      }

      row.push(Math.round(uV * 1000) / 1000);
    }
    samples.push(row);
  }

  return samples;
}

export async function simulateDeviceBurst(
  userId: string,
  role: Role,
  deviceId: string,
  scenario: SimulateDeviceInput['scenario'] = 'normal',
) {
  const device = await assertDeviceOwnership(userId, role, deviceId);
  const sampleRateSps = device.sampleRateSps || 500;
  const samples = generateSimulatedEegBurst(scenario, sampleRateSps, 250);

  await ingestSamples({
    deviceId: device.id,
    deviceCode: device.deviceCode,
    sampleRateSps,
    samples,
    source: 'SIMULATOR',
    forceEmit: true,
  });

  const telemetryPayload: RawTelemetryFields =
    scenario === 'stroke_alert'
      ? {
          fw: device.firmwareVersion,
          mode: 'EEG',
          rate_sps: sampleRateSps,
          pga: device.pgaGain,
          sps: sampleRateSps - 0.3,
          sd_rec: device.sdRecording,
          markers: 2,
          usb_only: false,
          vbat_mv: 3860,
          bat_pct: 79,
          loff_p: 0,
          ai_state: 'STROKE_ALERT',
          ai_rf_prob: 0.912,
          ai_lr_prob: 0.874,
          ai_bsi: 0.342,
          ai_dar: 4.28,
          ai_usable_ch: 8,
        }
      : scenario === 'low_battery'
        ? {
            fw: device.firmwareVersion,
            mode: 'EEG',
            rate_sps: sampleRateSps,
            pga: device.pgaGain,
            sps: sampleRateSps - 0.5,
            sd_rec: device.sdRecording,
            markers: 1,
            usb_only: false,
            vbat_mv: 3360,
            bat_pct: 12,
            loff_p: 0x04,
            ai_state: 'NORMAL',
            ai_rf_prob: 0.14,
            ai_lr_prob: 0.11,
            ai_bsi: 0.068,
            ai_dar: 1.35,
            ai_usable_ch: 7,
          }
        : {
            fw: device.firmwareVersion,
            mode: 'EEG',
            rate_sps: sampleRateSps,
            pga: device.pgaGain,
            sps: sampleRateSps - 0.1,
            sd_rec: device.sdRecording,
            markers: 1,
            usb_only: false,
            vbat_mv: 3920,
            bat_pct: 84,
            loff_p: 0,
            ai_state: 'NORMAL',
            ai_rf_prob: 0.082,
            ai_lr_prob: 0.071,
            ai_bsi: 0.052,
            ai_dar: 1.18,
            ai_usable_ch: 8,
          };

  const telemetryRes = await ingestTelemetry({
    deviceId: device.id,
    deviceCode: device.deviceCode,
    telemetry: telemetryPayload,
    source: 'SIMULATOR',
  });

  return {
    ok: true,
    samplesIngested: samples.length,
    device: telemetryRes.device,
    alertsCreated: telemetryRes.alertsCreated,
  };
}

export async function acknowledgeAlert(
  userId: string,
  role: Role,
  deviceId: string,
  alertId: string,
) {
  await assertDeviceOwnership(userId, role, deviceId);

  const alert = await prisma.deviceAlert.findFirst({
    where: { id: alertId, deviceId },
  });
  if (!alert) throw notFound('Không tìm thấy cảnh báo thiết bị');

  const updated = await prisma.deviceAlert.update({
    where: { id: alert.id },
    data: {
      acknowledged: true,
      acknowledgedAt: alert.acknowledgedAt ?? new Date(),
    },
  });

  return { alert: updated };
}

export async function captureRecordingSession(
  userId: string,
  role: Role,
  deviceId: string,
  input: CaptureSessionInput,
): Promise<{ session: DeviceRecordingSession }> {
  const device = await assertDeviceOwnership(userId, role, deviceId);
  const sampleRateSps = input.sampleRateSps ?? device.sampleRateSps;
  const montage = input.montage ?? device.montage;
  const channelNames = [...DEFAULT_8CH_NAMES];

  const sourceSamples =
    input.samples && input.samples.length > 0
      ? normalizeSampleRows(input.samples)
      : getBufferedSamples(device.deviceCode);

  if (sourceSamples.length < 16) {
    throw badRequest(
      'Chưa đủ dữ liệu sóng não trong bộ đệm (cần tối thiểu 16 mẫu). Hãy phát thử tín hiệu hoặc kết nối thiết bị trước khi lưu phiên.',
    );
  }

  const csvText = buildCsvFromSamples(sourceSamples, channelNames);
  const qeegResult = analyzeCsvTs({
    filename: `${device.deviceCode}_${Date.now()}.csv`,
    csvText,
    samplingRateHz: sampleRateSps,
    clinicalCategory: 'HARDWARE_BCI',
  });

  const durationSec =
    Math.round((sourceSamples.length / Math.max(1, sampleRateSps)) * 100) / 100;
  const now = new Date();
  const title =
    input.title?.trim() ||
    `Phiên đo ${device.deviceCode} (${now.toLocaleTimeString('vi-VN', { hour12: false })})`;

  const session = await prisma.deviceRecordingSession.create({
    data: {
      deviceId: device.id,
      ownerId: userId,
      title,
      montage,
      sampleRateSps,
      channelNames,
      sampleCount: sourceSamples.length,
      durationSec,
      csvSummary: buildCompactCsvSummary(csvText),
      qeegResultJson: JSON.parse(JSON.stringify(qeegResult)) as Prisma.InputJsonValue,
      startedAt: new Date(now.getTime() - Math.round(durationSec * 1000)),
      endedAt: now,
    },
  });

  realtimeBus.emitToUser(device.ownerId, 'device:session', {
    deviceId: device.id,
    deviceCode: device.deviceCode,
    session: {
      ...session,
      deviceCode: device.deviceCode,
      deviceName: device.name,
    },
  });

  return { session };
}

export async function syncBleFieldBatch(
  userId: string,
  role: Role,
  deviceId: string,
  input: BleSyncInput,
): Promise<{
  ok: boolean;
  deviceId: string;
  deviceCode: string;
  samplesSynced: number;
  telemetrySynced: boolean;
  session: DeviceRecordingSession | null;
}> {
  const device = await assertDeviceOwnership(userId, role, deviceId);
  let telemetrySynced = false;
  let samplesSynced = 0;
  let session: DeviceRecordingSession | null = null;

  if (input.telemetry && Object.keys(input.telemetry).length > 0) {
    await ingestTelemetry({
      authenticatedDevice: device,
      telemetry: input.telemetry,
      source: 'MOBILE_BLE_SYNC',
    });
    telemetrySynced = true;
  }

  if (input.samples && input.samples.length > 0) {
    const res = await ingestSamples({
      authenticatedDevice: device,
      montage: input.montage ?? device.montage,
      sampleRateSps: input.sampleRateSps ?? device.sampleRateSps,
      samples: input.samples,
      source: 'MOBILE_BLE_SYNC',
      forceEmit: true,
    });
    samplesSynced = res.samplesIngested;

    if (input.captureSession && samplesSynced >= 16) {
      const captured = await captureRecordingSession(userId, role, deviceId, {
        title: input.sessionTitle ?? `BLE Ngoại tuyến · ${device.deviceCode}`,
        montage: input.montage ?? device.montage,
        sampleRateSps: input.sampleRateSps ?? device.sampleRateSps,
        samples: input.samples,
      });
      session = captured.session;
    }
  }

  return {
    ok: true,
    deviceId: device.id,
    deviceCode: device.deviceCode,
    samplesSynced,
    telemetrySynced,
    session,
  };
}
