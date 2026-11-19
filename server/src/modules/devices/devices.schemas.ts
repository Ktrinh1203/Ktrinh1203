import { z } from 'zod';

const DEVICE_CODE_REGEX = /^[A-Za-z0-9_-]{3,40}$/;

export const createDeviceSchema = z.object({
  name: z.string().trim().min(2, 'Tên thiết bị tối thiểu 2 ký tự').max(120),
  deviceCode: z
    .string()
    .trim()
    .regex(DEVICE_CODE_REGEX, 'Mã thiết bị chỉ gồm chữ, số, dấu gạch ngang hoặc gạch dưới (3-40 ký tự)')
    .optional(),
  model: z.string().trim().min(2).max(60).default('ESP32_ADS1299_V3'),
  firmwareVersion: z.string().trim().min(1).max(30).default('V3.0.0'),
  montage: z.string().trim().min(2).max(30).default('neurolink6'),
  sampleRateSps: z.coerce.number().int().min(125).max(4000).default(500),
  pgaGain: z.coerce.number().int().min(1).max(24).default(24),
});

export const updateDeviceSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    model: z.string().trim().min(2).max(60).optional(),
    firmwareVersion: z.string().trim().min(1).max(30).optional(),
    montage: z.string().trim().min(2).max(30).optional(),
    sampleRateSps: z.coerce.number().int().min(125).max(4000).optional(),
    pgaGain: z.coerce.number().int().min(1).max(24).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Cần ít nhất một trường cần cập nhật',
  });

export const deviceCommandSchema = z.object({
  command: z
    .string()
    .trim()
    .min(1, 'Lệnh thiết bị không được để trống')
    .max(120)
    .refine((cmd) => !/[\r\n\0]/.test(cmd), 'Lệnh không được chứa ký tự xuống dòng'),
});

export const simulateDeviceSchema = z.object({
  scenario: z.enum(['normal', 'stroke_alert', 'low_battery']).default('normal'),
});

const sampleRowSchema = z.array(z.coerce.number().finite()).min(2).max(16);

export const captureSessionSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  montage: z.string().trim().min(2).max(30).optional(),
  sampleRateSps: z.coerce.number().int().min(125).max(4000).optional(),
  samples: z.array(sampleRowSchema).max(15000).optional(),
});

// Flexible telemetry payload supporting both ESP32 snake_case JSON and camelCase API clients
const rawTelemetryFieldsSchema = z.object({
  type: z.string().optional(),
  fw: z.string().max(30).optional(),
  firmwareVersion: z.string().max(30).optional(),
  mode: z.string().max(20).optional(),
  rate_sps: z.coerce.number().int().min(1).max(16000).optional(),
  rateSps: z.coerce.number().int().min(1).max(16000).optional(),
  pga: z.coerce.number().int().min(1).max(24).optional(),
  pgaGain: z.coerce.number().int().min(1).max(24).optional(),
  sps: z.coerce.number().min(0).max(16000).optional(),
  actualSps: z.coerce.number().min(0).max(16000).optional(),
  sd_rec: z.boolean().optional(),
  sdRec: z.boolean().optional(),
  markers: z.coerce.number().int().min(0).optional(),
  usb_only: z.boolean().optional(),
  usbOnly: z.boolean().optional(),
  vbat_mv: z.coerce.number().int().min(0).max(6000).optional(),
  vbatMv: z.coerce.number().int().min(0).max(6000).optional(),
  bat_pct: z.coerce.number().int().min(0).max(100).optional(),
  batPct: z.coerce.number().int().min(0).max(100).optional(),
  loff_p: z.coerce.number().int().min(0).max(255).optional(),
  loffMask: z.coerce.number().int().min(0).max(255).optional(),
  ai_state: z.string().max(40).optional(),
  aiState: z.string().max(40).optional(),
  ai_rf_prob: z.coerce.number().min(0).max(1).optional(),
  aiRfProb: z.coerce.number().min(0).max(1).optional(),
  ai_lr_prob: z.coerce.number().min(0).max(1).optional(),
  aiLrProb: z.coerce.number().min(0).max(1).optional(),
  ai_bsi: z.coerce.number().min(0).max(10).optional(),
  aiBsi: z.coerce.number().min(0).max(10).optional(),
  ai_dar: z.coerce.number().min(0).max(100).optional(),
  aiDar: z.coerce.number().min(0).max(100).optional(),
  ai_usable_ch: z.coerce.number().int().min(0).max(16).optional(),
  aiUsableCh: z.coerce.number().int().min(0).max(16).optional(),
  ipAddress: z.string().max(64).optional(),
  source: z.string().max(30).optional(),
});

export const ingestTelemetrySchema = rawTelemetryFieldsSchema.extend({
  deviceId: z.string().uuid().optional(),
  deviceCode: z.string().trim().max(40).optional(),
  telemetry: rawTelemetryFieldsSchema.optional(),
});

export const ingestSamplesSchema = z.object({
  deviceId: z.string().uuid().optional(),
  deviceCode: z.string().trim().max(40).optional(),
  montage: z.string().trim().max(30).optional(),
  sampleRateSps: z.coerce.number().int().min(1).max(16000).optional(),
  channels: z.array(z.string().trim().max(16)).max(16).optional(),
  samples: z.union([z.array(sampleRowSchema).min(1).max(4000), sampleRowSchema]),
  source: z.string().trim().max(30).optional(),
});

export const ingestAlertSchema = z.object({
  deviceId: z.string().uuid().optional(),
  deviceCode: z.string().trim().max(40).optional(),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).default('WARNING'),
  code: z.string().trim().min(2).max(60),
  message: z.string().trim().min(2).max(500),
});

export const ingestEpochSchema = z.object({
  deviceId: z.string().uuid().optional(),
  deviceCode: z.string().trim().max(40).optional(),
  title: z.string().trim().min(2).max(160).optional(),
  montage: z.string().trim().max(30).optional(),
  sampleRateSps: z.coerce.number().int().min(125).max(4000).optional(),
  channelNames: z.array(z.string().trim().max(16)).max(16).optional(),
  sampleCount: z.coerce.number().int().min(1).optional(),
  durationSec: z.coerce.number().positive().optional(),
  csvSummary: z.string().max(50000).optional(),
  csvText: z.string().max(500000).optional(),
  samples: z.array(sampleRowSchema).max(15000).optional(),
  qeegResultJson: z.record(z.string(), z.unknown()).optional(),
  qeegResult: z.record(z.string(), z.unknown()).optional(),
});

export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
export type DeviceCommandInput = z.infer<typeof deviceCommandSchema>;
export type SimulateDeviceInput = z.infer<typeof simulateDeviceSchema>;
export type CaptureSessionInput = z.infer<typeof captureSessionSchema>;
export type IngestTelemetryInput = z.infer<typeof ingestTelemetrySchema>;
export type IngestSamplesInput = z.infer<typeof ingestSamplesSchema>;
export type IngestAlertInput = z.infer<typeof ingestAlertSchema>;
export type IngestEpochInput = z.infer<typeof ingestEpochSchema>;
export type RawTelemetryFields = z.infer<typeof rawTelemetryFieldsSchema>;
