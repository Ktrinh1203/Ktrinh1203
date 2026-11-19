import { createHash, timingSafeEqual } from 'node:crypto';
import type http from 'node:http';
import type { Duplex } from 'node:stream';
import { prisma } from '../../lib/prisma.js';
import { sha256 } from '../../lib/crypto.js';
import { isProduction } from '../../config/env.js';
import { ingestSamples, ingestTelemetry } from './devices.service.js';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_WS_PAYLOAD_BYTES = 256 * 1024;
const MAX_RING_BUFFER_SAMPLES = 2000;

const ESP32_FRAME_SIZE = 197;
const ESP32_HEADER_0 = 0xa5;
const ESP32_HEADER_1 = 0xc2;
const ESP32_HEADER_2 = 0x11;
const ESP32_HEADER_3 = 0xd3;
const ESP32_TAIL = 0x5a;
const ESP32_SAMPLES_PER_FRAME = 6;
const ESP32_CHANNELS = 8;

interface LiveWsClient {
  socket: Duplex;
  deviceId: string;
  deviceCode: string;
  ipAddress: string | null;
}

// Per-device in-memory ring buffer storing the latest 2,000 (8-channel uV) samples
const sampleRingBuffers = new Map<string, number[][]>();

// Active RFC 6455 WebSocket connections keyed by deviceCode
const liveClientsByCode = new Map<string, Set<LiveWsClient>>();

function normalizeCodeKey(deviceCode: string): string {
  return deviceCode.trim().toUpperCase();
}

export function appendBufferedSamples(deviceCode: string, samples: number[][]): number {
  const key = normalizeCodeKey(deviceCode);
  let buf = sampleRingBuffers.get(key);
  if (!buf) {
    buf = [];
    sampleRingBuffers.set(key, buf);
  }

  for (const row of samples) {
    buf.push(row);
  }

  if (buf.length > MAX_RING_BUFFER_SAMPLES) {
    buf.splice(0, buf.length - MAX_RING_BUFFER_SAMPLES);
  }
  return buf.length;
}

export function getBufferedSamples(deviceCode: string): number[][] {
  const key = normalizeCodeKey(deviceCode);
  const buf = sampleRingBuffers.get(key);
  return buf ? [...buf] : [];
}

export function clearBufferedSamples(deviceCode: string): void {
  sampleRingBuffers.delete(normalizeCodeKey(deviceCode));
}

export function getLiveConnectedDeviceCodes(): string[] {
  const codes: string[] = [];
  for (const [code, clients] of liveClientsByCode.entries()) {
    if (clients.size > 0) codes.push(code);
  }
  return codes;
}

export function isDeviceWsConnected(deviceCode: string): boolean {
  const clients = liveClientsByCode.get(normalizeCodeKey(deviceCode));
  return Boolean(clients && clients.size > 0);
}

function encodeWsServerFrame(opcode: number, payload: Buffer): Buffer {
  const len = payload.length;
  let headerLen = 2;
  if (len >= 126 && len < 65536) {
    headerLen = 4;
  } else if (len >= 65536) {
    headerLen = 10;
  }

  const frame = Buffer.allocUnsafe(headerLen + len);
  frame[0] = 0x80 | (opcode & 0x0f);

  if (len < 126) {
    frame[1] = len;
  } else if (len < 65536) {
    frame[1] = 126;
    frame.writeUInt16BE(len, 2);
  } else {
    frame[1] = 127;
    frame.writeBigUInt64BE(BigInt(len), 2);
  }

  payload.copy(frame, headerLen);
  return frame;
}

export function sendCommandToWsDevice(deviceCode: string, command: string): boolean {
  const clients = liveClientsByCode.get(normalizeCodeKey(deviceCode));
  if (!clients || clients.size === 0) return false;

  const frame = encodeWsServerFrame(0x01, Buffer.from(command, 'utf8'));
  let sent = false;
  for (const client of [...clients]) {
    if (client.socket.destroyed || !client.socket.writable) {
      clients.delete(client);
      continue;
    }
    try {
      client.socket.write(frame);
      sent = true;
    } catch {
      clients.delete(client);
    }
  }
  if (clients.size === 0) {
    liveClientsByCode.delete(normalizeCodeKey(deviceCode));
  }
  return sent;
}

export function closeAllHardwareWsConnections(): void {
  const closeFrame = encodeWsServerFrame(0x08, Buffer.alloc(0));
  for (const clients of liveClientsByCode.values()) {
    for (const client of clients) {
      try {
        if (client.socket.writable && !client.socket.destroyed) {
          client.socket.write(closeFrame);
        }
        client.socket.end();
      } catch {
        // Ignore close race
      }
    }
  }
  liveClientsByCode.clear();
}

/**
 * Decodes one or more 197-byte ESP32 ADS1299 binary frames:
 * [0xA5, 0xC2, 0x11, 0xD3] + 48 x float32 LE (6 samples x 8 ch in uV) + [0x5A].
 */
export function decodeEsp32BinaryFrames(payload: Buffer): number[][] {
  const samples: number[][] = [];
  let offset = 0;

  while (offset + ESP32_FRAME_SIZE <= payload.length) {
    if (
      payload[offset] === ESP32_HEADER_0 &&
      payload[offset + 1] === ESP32_HEADER_1 &&
      payload[offset + 2] === ESP32_HEADER_2 &&
      payload[offset + 3] === ESP32_HEADER_3 &&
      payload[offset + ESP32_FRAME_SIZE - 1] === ESP32_TAIL
    ) {
      const floatBase = offset + 4;
      for (let s = 0; s < ESP32_SAMPLES_PER_FRAME; s++) {
        const row: number[] = [];
        for (let ch = 0; ch < ESP32_CHANNELS; ch++) {
          const val = payload.readFloatLE(floatBase + (s * ESP32_CHANNELS + ch) * 4);
          row.push(Number.isFinite(val) ? Math.round(val * 1000) / 1000 : 0);
        }
        samples.push(row);
      }
      offset += ESP32_FRAME_SIZE;
    } else {
      offset += 1;
    }
  }

  return samples;
}

function timingSafeHexEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function rejectHttpUpgrade(socket: Duplex, statusCode: number, reason: string): void {
  try {
    socket.write(
      `HTTP/1.1 ${statusCode} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
    );
  } catch {
    // Ignore write error on closed socket
  }
  socket.destroy();
}

async function resolveUpgradeDevice(req: http.IncomingMessage, parsedUrl: URL) {
  const rawCode =
    parsedUrl.searchParams.get('deviceCode') ??
    (typeof req.headers['x-device-code'] === 'string' ? req.headers['x-device-code'] : null);
  const rawKey =
    parsedUrl.searchParams.get('key') ??
    (typeof req.headers['x-device-key'] === 'string' ? req.headers['x-device-key'] : null);

  const deviceCode = rawCode?.trim() || null;
  const apiKey = rawKey?.trim() || null;

  if (deviceCode) {
    const device =
      (await prisma.hardwareDevice.findUnique({ where: { deviceCode } })) ??
      (await prisma.hardwareDevice.findUnique({ where: { deviceCode: deviceCode.toUpperCase() } }));

    if (!device) {
      return { error: { status: 404, reason: 'Device Not Found' } };
    }

    if (apiKey) {
      const providedHash = sha256(apiKey);
      if (!timingSafeHexEqual(providedHash, device.apiKeyHash)) {
        return { error: { status: 401, reason: 'Unauthorized' } };
      }
      return { device };
    }

    if (isProduction) {
      return { error: { status: 401, reason: 'Unauthorized' } };
    }
    return { device };
  }

  if (apiKey) {
    const providedHash = sha256(apiKey);
    const device = await prisma.hardwareDevice.findFirst({
      where: { apiKeyHash: providedHash },
    });
    if (!device) {
      return { error: { status: 401, reason: 'Unauthorized' } };
    }
    return { device };
  }

  if (isProduction) {
    return { error: { status: 401, reason: 'Unauthorized' } };
  }

  // Non-production plug-and-play fallback for untouched ESP32 firmware connecting to /ws/hardware
  const defaultDevice =
    (await prisma.hardwareDevice.findUnique({ where: { deviceCode: 'NL-HOLTER-01' } })) ??
    (await prisma.hardwareDevice.findFirst({ orderBy: { createdAt: 'desc' } }));

  if (!defaultDevice) {
    return { error: { status: 404, reason: 'No Registered Device' } };
  }
  return { device: defaultDevice };
}

function registerClient(client: LiveWsClient): void {
  const key = normalizeCodeKey(client.deviceCode);
  let set = liveClientsByCode.get(key);
  if (!set) {
    set = new Set();
    liveClientsByCode.set(key, set);
  }
  set.add(client);
}

function unregisterClient(client: LiveWsClient): void {
  const key = normalizeCodeKey(client.deviceCode);
  const set = liveClientsByCode.get(key);
  if (!set) return;
  set.delete(client);
  if (set.size === 0) {
    liveClientsByCode.delete(key);
    // Mark offline if no sockets remain (ignore errors during test DB resets)
    prisma.hardwareDevice
      .updateMany({
        where: { id: client.deviceId, status: { in: ['ONLINE', 'STREAMING'] } },
        data: { status: 'OFFLINE', connectionSource: 'NONE' },
      })
      .catch(() => undefined);
  }
}

export function attachHardwareWebSocketServer(httpServer: http.Server): void {
  httpServer.on('upgrade', (req, socket, head) => {
    void handleUpgrade(req, socket, head);
  });
}

async function handleUpgrade(
  req: http.IncomingMessage,
  socket: Duplex,
  head: Buffer,
): Promise<void> {
  const parsedUrl = new URL(req.url ?? '/', 'http://localhost');
  if (!parsedUrl.pathname.startsWith('/ws/hardware')) {
    return;
  }

  const upgradeHeader = String(req.headers.upgrade ?? '').toLowerCase();
  const wsKey = typeof req.headers['sec-websocket-key'] === 'string' ? req.headers['sec-websocket-key'].trim() : '';
  if (upgradeHeader !== 'websocket' || !wsKey) {
    rejectHttpUpgrade(socket, 400, 'Bad Request');
    return;
  }

  let resolved: Awaited<ReturnType<typeof resolveUpgradeDevice>>;
  try {
    resolved = await resolveUpgradeDevice(req, parsedUrl);
  } catch (err) {
    console.error('[hardware-ws] device resolution failed', err);
    rejectHttpUpgrade(socket, 500, 'Internal Server Error');
    return;
  }

  if ('error' in resolved && resolved.error) {
    rejectHttpUpgrade(socket, resolved.error.status, resolved.error.reason);
    return;
  }

  const device = resolved.device;
  const remoteAddress =
    typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0]?.trim() ?? null
      : req.socket.remoteAddress ?? null;

  const client: LiveWsClient = {
    socket,
    deviceId: device.id,
    deviceCode: device.deviceCode,
    ipAddress: remoteAddress,
  };

  registerClient(client);

  await prisma.hardwareDevice
    .update({
      where: { id: device.id },
      data: {
        status: device.status === 'ALERT' ? 'ALERT' : 'ONLINE',
        connectionSource: 'WS_DIRECT',
        ipAddress: remoteAddress,
        lastSeenAt: new Date(),
      },
    })
    .catch(() => undefined);

  const accept = createHash('sha1').update(`${wsKey}${WS_GUID}`).digest('base64');
  socket.write(
    [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '',
      '',
    ].join('\r\n'),
  );

  let recvBuf: Buffer = Buffer.alloc(0);
  let fragmentedOpcode: number | null = null;
  let fragmentedChunks: Buffer[] = [];
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    unregisterClient(client);
  };

  const handleCompleteMessage = (opcode: number, payload: Buffer) => {
    if (opcode === 0x08) {
      // Close
      try {
        if (socket.writable && !socket.destroyed) {
          socket.write(encodeWsServerFrame(0x08, Buffer.alloc(0)));
        }
        socket.end();
      } catch {
        // Ignore
      }
      cleanup();
      return;
    }

    if (opcode === 0x09) {
      // Ping -> Pong
      try {
        if (socket.writable && !socket.destroyed) {
          socket.write(encodeWsServerFrame(0x0a, payload));
        }
      } catch {
        // Ignore
      }
      return;
    }

    if (opcode === 0x0a) {
      // Pong
      return;
    }

    if (opcode === 0x02) {
      // Binary 197-byte ADS1299 frame(s)
      const samples = decodeEsp32BinaryFrames(payload);
      if (samples.length > 0) {
        void ingestSamples({
          deviceId: client.deviceId,
          deviceCode: client.deviceCode,
          samples,
          source: 'WS_DIRECT',
          ipAddress: client.ipAddress ?? undefined,
        }).catch((err) => {
          console.error('[hardware-ws] ingestSamples failed', err);
        });
      }
      return;
    }

    if (opcode === 0x01) {
      // Text JSON telemetry frame
      const text = payload.toString('utf8').trim();
      if (!text.startsWith('{')) return;
      try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        if (
          parsed &&
          typeof parsed === 'object' &&
          (parsed.type === 'telemetry' ||
            'vbat_mv' in parsed ||
            'vbatMv' in parsed ||
            'ai_state' in parsed ||
            'aiState' in parsed ||
            'rate_sps' in parsed ||
            'rateSps' in parsed)
        ) {
          void ingestTelemetry({
            deviceId: client.deviceId,
            deviceCode: client.deviceCode,
            telemetry: parsed,
            source: 'WS_DIRECT',
            ipAddress: client.ipAddress ?? undefined,
          }).catch((err) => {
            console.error('[hardware-ws] ingestTelemetry failed', err);
          });
        }
      } catch {
        // Ignore non-JSON text frames
      }
    }
  };

  const processBuffer = () => {
    while (recvBuf.length >= 2) {
      const b0 = recvBuf[0]!;
      const b1 = recvBuf[1]!;
      const fin = (b0 & 0x80) !== 0;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let payloadLen = b1 & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (recvBuf.length < 4) return;
        payloadLen = recvBuf.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (recvBuf.length < 10) return;
        const lenBig = recvBuf.readBigUInt64BE(2);
        if (lenBig > BigInt(MAX_WS_PAYLOAD_BYTES)) {
          socket.destroy();
          cleanup();
          return;
        }
        payloadLen = Number(lenBig);
        offset = 10;
      }

      if (payloadLen > MAX_WS_PAYLOAD_BYTES) {
        socket.destroy();
        cleanup();
        return;
      }

      const maskBytes = masked ? 4 : 0;
      const totalFrameLen = offset + maskBytes + payloadLen;
      if (recvBuf.length < totalFrameLen) return;

      const payload = Buffer.allocUnsafe(payloadLen);
      if (masked) {
        const m0 = recvBuf[offset]!;
        const m1 = recvBuf[offset + 1]!;
        const m2 = recvBuf[offset + 2]!;
        const m3 = recvBuf[offset + 3]!;
        const mask = [m0, m1, m2, m3];
        const dataStart = offset + 4;
        for (let i = 0; i < payloadLen; i++) {
          payload[i] = recvBuf[dataStart + i]! ^ mask[i & 3]!;
        }
      } else {
        recvBuf.copy(payload, 0, offset, offset + payloadLen);
      }

      recvBuf = recvBuf.subarray(totalFrameLen);

      // Control frames (0x08..0x0A) cannot be fragmented per RFC 6455
      if (opcode >= 0x08) {
        handleCompleteMessage(opcode, payload);
        if (closed) return;
        continue;
      }

      if (opcode === 0x00) {
        // Continuation frame
        if (fragmentedOpcode === null) continue;
        fragmentedChunks.push(payload);
        if (fin) {
          const full = Buffer.concat(fragmentedChunks);
          const op = fragmentedOpcode;
          fragmentedOpcode = null;
          fragmentedChunks = [];
          handleCompleteMessage(op, full);
        }
      } else if (!fin) {
        fragmentedOpcode = opcode;
        fragmentedChunks = [payload];
      } else {
        fragmentedOpcode = null;
        fragmentedChunks = [];
        handleCompleteMessage(opcode, payload);
      }
    }
  };

  socket.on('data', (chunk: Buffer) => {
    recvBuf = recvBuf.length === 0 ? chunk : Buffer.concat([recvBuf, chunk]);
    processBuffer();
  });

  socket.on('close', cleanup);
  socket.on('end', cleanup);
  socket.on('error', cleanup);

  if (head && head.length > 0) {
    recvBuf = Buffer.from(head);
    processBuffer();
  }
}
