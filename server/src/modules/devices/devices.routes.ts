import { Router, type Request } from 'express';
import { z } from 'zod';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import {
  captureSessionSchema,
  createDeviceSchema,
  deviceCommandSchema,
  ingestAlertSchema,
  ingestEpochSchema,
  ingestSamplesSchema,
  ingestTelemetrySchema,
  simulateDeviceSchema,
  updateDeviceSchema,
} from './devices.schemas.js';
import * as devicesService from './devices.service.js';

const uuidParamSchema = z.string().uuid('ID thiết bị không hợp lệ');

function extractIngestHeaders(req: Request) {
  return {
    nodeRedSecret: req.header('x-nodered-secret') ?? undefined,
    deviceKey: req.header('x-device-key') ?? undefined,
  };
}

function extractBodyDeviceCode(body: unknown): string | undefined {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const code = (body as Record<string, unknown>).deviceCode;
    if (typeof code === 'string' && code.trim().length > 0) return code.trim();
  }
  return undefined;
}

/**
 * Hardware & Node-RED gateway ingestion router.
 * MUST be mounted BEFORE `csrfProtection` in `app.ts` because external IoT gateways
 * authenticate via `x-nodered-secret` or `x-device-key` rather than session cookies.
 */
export const devicesIngestRouter = Router();

devicesIngestRouter.post('/telemetry', async (req, res) => {
  const auth = await devicesService.authenticateIngestRequest({
    ...extractIngestHeaders(req),
    deviceCodeHint: extractBodyDeviceCode(req.body),
  });
  const input = ingestTelemetrySchema.parse(req.body);

  const result = await devicesService.ingestTelemetry({
    flatFields: input,
    telemetry: input.telemetry,
    source: input.source ?? (auth.authMode === 'nodered' ? 'NODERED_HTTP' : 'DEVICE_HTTP'),
    ipAddress: req.ip,
    authenticatedDevice: auth.authenticatedDevice,
  });

  res.json(result);
});

devicesIngestRouter.post('/samples', async (req, res) => {
  const auth = await devicesService.authenticateIngestRequest({
    ...extractIngestHeaders(req),
    deviceCodeHint: extractBodyDeviceCode(req.body),
  });
  const input = ingestSamplesSchema.parse(req.body);

  const result = await devicesService.ingestSamples({
    deviceId: input.deviceId,
    deviceCode: input.deviceCode,
    montage: input.montage,
    sampleRateSps: input.sampleRateSps,
    channels: input.channels,
    samples: input.samples,
    source: input.source ?? (auth.authMode === 'nodered' ? 'NODERED_HTTP' : 'DEVICE_HTTP'),
    ipAddress: req.ip,
    authenticatedDevice: auth.authenticatedDevice,
  });

  res.json(result);
});

devicesIngestRouter.post('/alert', async (req, res) => {
  const auth = await devicesService.authenticateIngestRequest({
    ...extractIngestHeaders(req),
    deviceCodeHint: extractBodyDeviceCode(req.body),
  });
  const input = ingestAlertSchema.parse(req.body);

  const result = await devicesService.ingestAlert(input, auth.authenticatedDevice);
  res.json(result);
});

devicesIngestRouter.post('/epoch', async (req, res) => {
  const auth = await devicesService.authenticateIngestRequest({
    ...extractIngestHeaders(req),
    deviceCodeHint: extractBodyDeviceCode(req.body),
  });
  const input = ingestEpochSchema.parse(req.body);

  const result = await devicesService.ingestEpoch(input, auth.authenticatedDevice);
  res.json(result);
});

/**
 * Authenticated user hardware device management router (`/api/devices/*`).
 */
export const devicesRouter = Router();

devicesRouter.use(requireAuth);

devicesRouter.get('/', async (req, res) => {
  const auth = getAuth(req);
  const data = await devicesService.listDevicesDashboard(auth.userId, auth.role);
  res.json(data);
});

devicesRouter.post('/', async (req, res) => {
  const auth = getAuth(req);
  const input = createDeviceSchema.parse(req.body);
  const result = await devicesService.registerDevice(auth.userId, input);
  res.status(201).json(result);
});

devicesRouter.patch('/:id', async (req, res) => {
  const auth = getAuth(req);
  const deviceId = uuidParamSchema.parse(req.params.id);
  const input = updateDeviceSchema.parse(req.body);
  const result = await devicesService.updateDevice(auth.userId, auth.role, deviceId, input);
  res.json(result);
});

devicesRouter.delete('/:id', async (req, res) => {
  const auth = getAuth(req);
  const deviceId = uuidParamSchema.parse(req.params.id);
  await devicesService.deleteDevice(auth.userId, auth.role, deviceId);
  res.status(204).send();
});

devicesRouter.get('/:id/telemetry', async (req, res) => {
  const auth = getAuth(req);
  const deviceId = uuidParamSchema.parse(req.params.id);
  const rawLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 100;
  const limit = Number.isFinite(rawLimit) ? rawLimit : 100;
  const result = await devicesService.getDeviceTelemetry(auth.userId, auth.role, deviceId, limit);
  res.json(result);
});

devicesRouter.post('/:id/command', async (req, res) => {
  const auth = getAuth(req);
  const deviceId = uuidParamSchema.parse(req.params.id);
  const input = deviceCommandSchema.parse(req.body);
  const result = await devicesService.sendDeviceCommand(
    auth.userId,
    auth.role,
    deviceId,
    input.command,
  );
  res.json(result);
});

devicesRouter.post('/:id/simulate', async (req, res) => {
  const auth = getAuth(req);
  const deviceId = uuidParamSchema.parse(req.params.id);
  const input = simulateDeviceSchema.parse(req.body ?? {});
  const result = await devicesService.simulateDeviceBurst(
    auth.userId,
    auth.role,
    deviceId,
    input.scenario,
  );
  res.json(result);
});

devicesRouter.post('/:id/alerts/:alertId/ack', async (req, res) => {
  const auth = getAuth(req);
  const deviceId = uuidParamSchema.parse(req.params.id);
  const alertId = uuidParamSchema.parse(req.params.alertId);
  const result = await devicesService.acknowledgeAlert(auth.userId, auth.role, deviceId, alertId);
  res.json(result);
});

devicesRouter.post('/:id/sessions/capture', async (req, res) => {
  const auth = getAuth(req);
  const deviceId = uuidParamSchema.parse(req.params.id);
  const input = captureSessionSchema.parse(req.body ?? {});
  const result = await devicesService.captureRecordingSession(
    auth.userId,
    auth.role,
    deviceId,
    input,
  );
  res.status(201).json(result);
});
