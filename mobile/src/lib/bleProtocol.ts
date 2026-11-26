/**
 * Native Capacitor BLE + Web Bluetooth + Binary 197-byte GATT decoder matching ESP32 `ble_gatt_link.h`.
 */

import { BleClient } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';

export const NEUROLINK_BLE_DEVICE_NAME = 'NeuroLink-Holter';
export const NEUROLINK_BLE_SERVICE_UUID = '4f9a0001-b5a3-f393-e0a9-e50e24dcca9e';
export const NEUROLINK_BLE_EEG_CHAR_UUID = '4f9a0002-b5a3-f393-e0a9-e50e24dcca9e';
export const NEUROLINK_BLE_TEL_CHAR_UUID = '4f9a0003-b5a3-f393-e0a9-e50e24dcca9e';
export const NEUROLINK_BLE_CMD_CHAR_UUID = '4f9a0004-b5a3-f393-e0a9-e50e24dcca9e';

const PAIRED_DEVICE_ID_KEY = 'neurolink_paired_device_id_v1';
const PAIRED_BLE_MAC_KEY = 'neurolink_paired_ble_mac_v1';
export const DEVICE_ID_SAVED_EVENT = 'neurolink:device-id-saved';

export function normalizeDeviceId(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function getPairedDeviceId(): string {
  if (typeof localStorage === 'undefined') return '';
  return normalizeDeviceId(localStorage.getItem(PAIRED_DEVICE_ID_KEY) ?? '');
}

export function setPairedDeviceId(raw: string): string {
  const norm = normalizeDeviceId(raw);
  if (typeof localStorage !== 'undefined') {
    const prev = normalizeDeviceId(localStorage.getItem(PAIRED_DEVICE_ID_KEY) ?? '');
    if (norm) {
      localStorage.setItem(PAIRED_DEVICE_ID_KEY, norm);
    } else {
      localStorage.removeItem(PAIRED_DEVICE_ID_KEY);
    }
    if (prev !== norm) {
      localStorage.removeItem(PAIRED_BLE_MAC_KEY);
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DEVICE_ID_SAVED_EVENT, { detail: { deviceId: norm } }));
  }
  return norm;
}

export function getPairedBleMac(): string {
  if (typeof localStorage === 'undefined') return '';
  return (localStorage.getItem(PAIRED_BLE_MAC_KEY) ?? '').trim();
}

export function setPairedBleMac(mac: string): void {
  if (typeof localStorage === 'undefined') return;
  const cleaned = mac.trim();
  if (cleaned) localStorage.setItem(PAIRED_BLE_MAC_KEY, cleaned);
  else localStorage.removeItem(PAIRED_BLE_MAC_KEY);
}

/**
 * Ensures Bluetooth is enabled on native Android (prompts OS enable dialog automatically if off).
 */
export async function ensureNativeBluetoothEnabled(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  await BleClient.initialize({ androidNeverForLocation: true });
  const enabled = await BleClient.isEnabled();
  if (!enabled) {
    await BleClient.requestEnable();
    return await BleClient.isEnabled();
  }
  return true;
}

const FRAME_6_SAMPLES_LEN = 197;
const FRAME_1_SAMPLE_LEN = 37;

interface WebBluetoothCharacteristicLike {
  startNotifications: () => Promise<WebBluetoothCharacteristicLike>;
  addEventListener: (type: string, cb: (ev: Event) => void) => void;
  removeEventListener: (type: string, cb: (ev: Event) => void) => void;
  writeValueWithoutResponse?: (data: BufferSource) => Promise<void>;
  writeValue: (data: BufferSource) => Promise<void>;
  value?: DataView;
}

interface WebBluetoothServerLike {
  connected: boolean;
  disconnect: () => void;
  getPrimaryService: (uuid: string) => Promise<{
    getCharacteristic: (uuid: string) => Promise<WebBluetoothCharacteristicLike>;
  }>;
}

interface WebBluetoothDeviceLike {
  id: string;
  name?: string;
  gatt?: {
    connect: () => Promise<WebBluetoothServerLike>;
    connected: boolean;
  };
  addEventListener: (type: string, cb: () => void) => void;
}

interface NavigatorWithBluetooth {
  bluetooth?: {
    requestDevice: (opts: Record<string, unknown>) => Promise<WebBluetoothDeviceLike>;
  };
}

export interface BleConnectionHandle {
  deviceName: string;
  sendCommand: (cmd: string) => Promise<void>;
  disconnect: () => void;
}

export function isWebBluetoothSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (Capacitor.isNativePlatform()) return true;
  return Boolean((navigator as unknown as NavigatorWithBluetooth).bluetooth);
}

/**
 * Decode ESP32 binary BLE notification frames:
 * - 197 bytes: [0xA5, 0xC2, 0x11, 0xD3] + 6 samples * 8 float32 LE + [0x5A]
 * - 37 bytes fallback: [0xA5, 0xC2, 0x01, 0xD3] + 1 sample * 8 float32 LE + [0x5A]
 */
export function decodeEsp32BleFrame(view: DataView): number[][] {
  const samples: number[][] = [];
  let offset = 0;

  while (offset < view.byteLength) {
    if (
      offset + FRAME_6_SAMPLES_LEN <= view.byteLength &&
      view.getUint8(offset) === 0xa5 &&
      view.getUint8(offset + 1) === 0xc2 &&
      view.getUint8(offset + 2) === 0x11 &&
      view.getUint8(offset + 3) === 0xd3 &&
      view.getUint8(offset + FRAME_6_SAMPLES_LEN - 1) === 0x5a
    ) {
      const base = offset + 4;
      for (let s = 0; s < 6; s++) {
        const row: number[] = [];
        for (let ch = 0; ch < 8; ch++) {
          const v = view.getFloat32(base + (s * 8 + ch) * 4, true);
          row.push(Number.isFinite(v) ? Math.round(v * 1000) / 1000 : 0);
        }
        samples.push(row);
      }
      offset += FRAME_6_SAMPLES_LEN;
      continue;
    }

    if (
      offset + FRAME_1_SAMPLE_LEN <= view.byteLength &&
      view.getUint8(offset) === 0xa5 &&
      view.getUint8(offset + 1) === 0xc2 &&
      view.getUint8(offset + 2) === 0x01 &&
      view.getUint8(offset + 3) === 0xd3 &&
      view.getUint8(offset + FRAME_1_SAMPLE_LEN - 1) === 0x5a
    ) {
      const base = offset + 4;
      const row: number[] = [];
      for (let ch = 0; ch < 8; ch++) {
        const v = view.getFloat32(base + ch * 4, true);
        row.push(Number.isFinite(v) ? Math.round(v * 1000) / 1000 : 0);
      }
      samples.push(row);
      offset += FRAME_1_SAMPLE_LEN;
      continue;
    }

    offset += 1;
  }

  return samples;
}

export function parseBleTelemetryJson(view: DataView): Record<string, unknown> | null {
  try {
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    const text = new TextDecoder().decode(bytes).trim();
    if (!text.startsWith('{')) return null;
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function attachNativeBleNotifications(
  deviceId: string,
  deviceName: string,
  handlers: {
    onSamples: (samples: number[][]) => void;
    onTelemetry: (telemetry: Record<string, unknown>) => void;
    onDisconnected: () => void;
  },
): Promise<BleConnectionHandle> {
  await BleClient.connect(deviceId, () => handlers.onDisconnected(), { timeout: 8000 });
  await BleClient.startNotifications(
    deviceId,
    NEUROLINK_BLE_SERVICE_UUID,
    NEUROLINK_BLE_EEG_CHAR_UUID,
    (value) => {
      const rows = decodeEsp32BleFrame(value);
      if (rows.length > 0) handlers.onSamples(rows);
    },
  );
  await BleClient.startNotifications(
    deviceId,
    NEUROLINK_BLE_SERVICE_UUID,
    NEUROLINK_BLE_TEL_CHAR_UUID,
    (value) => {
      const parsed = parseBleTelemetryJson(value);
      if (parsed) handlers.onTelemetry(parsed);
    },
  );

  return {
    deviceName,
    sendCommand: async (cmd: string) => {
      const encoded = new TextEncoder().encode(cmd.trim());
      const dv = new DataView(encoded.buffer, encoded.byteOffset, encoded.byteLength);
      await BleClient.writeWithoutResponse(
        deviceId,
        NEUROLINK_BLE_SERVICE_UUID,
        NEUROLINK_BLE_CMD_CHAR_UUID,
        dv,
      );
    },
    disconnect: () => {
      void BleClient.disconnect(deviceId).catch(() => undefined);
    },
  };
}

/**
 * Silent auto-connect on native Android using the user's bound unique Device ID (e.g. NL-205840).
 * 1) Automatically requests Android to enable Bluetooth if off.
 * 2) Tries direct silent reconnect via cached BLE MAC.
 * 3) Falls back to silent background LE scan matching targetId without showing a picker dialog.
 */
export async function autoConnectNeuroLinkBleById(
  targetId: string,
  handlers: {
    onSamples: (samples: number[][]) => void;
    onTelemetry: (telemetry: Record<string, unknown>) => void;
    onDisconnected: () => void;
  },
): Promise<BleConnectionHandle> {
  const normalizedTarget = normalizeDeviceId(targetId);
  if (!Capacitor.isNativePlatform()) {
    return connectNeuroLinkBle(handlers);
  }

  const btReady = await ensureNativeBluetoothEnabled();
  if (!btReady) {
    throw new Error('Vui lòng bật Bluetooth để tự động liên kết thiết bị.');
  }

  const cachedMac = getPairedBleMac();
  if (cachedMac) {
    try {
      return await attachNativeBleNotifications(
        cachedMac,
        normalizedTarget || NEUROLINK_BLE_DEVICE_NAME,
        handlers,
      );
    } catch {
      // Cached MAC unreachable or changed -> fall through to silent scan by Device ID
    }
  }

  const found = await new Promise<{ deviceId: string; name: string }>((resolve, reject) => {
    let settled = false;
    const finish = (cb: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      void BleClient.stopLEScan().catch(() => undefined);
      cb();
    };

    const timer = window.setTimeout(() => {
      finish(() =>
        reject(
          new Error(
            `Không tìm thấy thiết bị ${normalizedTarget} gần đây. Hãy bật nguồn thiết bị rồi thử lại.`,
          ),
        ),
      );
    }, 10000);

    void BleClient.requestLEScan(
      { services: [NEUROLINK_BLE_SERVICE_UUID] },
      (result) => {
        const candidateName = normalizeDeviceId(result.device.name || result.localName || '');
        if (!normalizedTarget || candidateName === normalizedTarget) {
          finish(() =>
            resolve({
              deviceId: result.device.deviceId,
              name: candidateName || normalizedTarget || NEUROLINK_BLE_DEVICE_NAME,
            }),
          );
        }
      },
    ).catch((err) => {
      finish(() => reject(err));
    });
  });

  setPairedBleMac(found.deviceId);
  return attachNativeBleNotifications(found.deviceId, found.name, handlers);
}

export async function connectNeuroLinkBle(handlers: {
  onSamples: (samples: number[][]) => void;
  onTelemetry: (telemetry: Record<string, unknown>) => void;
  onDisconnected: () => void;
}): Promise<BleConnectionHandle> {
  if (Capacitor.isNativePlatform()) {
    const btReady = await ensureNativeBluetoothEnabled();
    if (!btReady) {
      throw new Error('Vui lòng bật Bluetooth để ghép đôi thiết bị.');
    }
    const dev = await BleClient.requestDevice({
      services: [NEUROLINK_BLE_SERVICE_UUID],
      optionalServices: [NEUROLINK_BLE_SERVICE_UUID],
    });
    const devName = normalizeDeviceId(dev.name || '') || NEUROLINK_BLE_DEVICE_NAME;
    setPairedBleMac(dev.deviceId);
    if (devName.startsWith('NL-')) {
      setPairedDeviceId(devName);
    }
    return attachNativeBleNotifications(dev.deviceId, devName, handlers);
  }

  const nav = navigator as unknown as NavigatorWithBluetooth;
  if (!nav.bluetooth) {
    throw new Error('Trình duyệt chưa hỗ trợ Web Bluetooth (dùng Chrome Android hoặc APK Capacitor).');
  }

  const device = await nav.bluetooth.requestDevice({
    filters: [
      { services: [NEUROLINK_BLE_SERVICE_UUID] },
      { namePrefix: 'NeuroLink' },
      { namePrefix: 'NL-' },
    ],
    optionalServices: [NEUROLINK_BLE_SERVICE_UUID],
  });

  if (!device.gatt) {
    throw new Error('Thiết bị Bluetooth không hỗ trợ GATT.');
  }

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(NEUROLINK_BLE_SERVICE_UUID);
  const eegChar = await service.getCharacteristic(NEUROLINK_BLE_EEG_CHAR_UUID);
  const telChar = await service.getCharacteristic(NEUROLINK_BLE_TEL_CHAR_UUID);
  const cmdChar = await service.getCharacteristic(NEUROLINK_BLE_CMD_CHAR_UUID);

  const handleEeg = (ev: Event) => {
    const ch = ev.target as unknown as WebBluetoothCharacteristicLike | null;
    if (!ch?.value) return;
    const rows = decodeEsp32BleFrame(ch.value);
    if (rows.length > 0) handlers.onSamples(rows);
  };

  const handleTel = (ev: Event) => {
    const ch = ev.target as unknown as WebBluetoothCharacteristicLike | null;
    if (!ch?.value) return;
    const parsed = parseBleTelemetryJson(ch.value);
    if (parsed) handlers.onTelemetry(parsed);
  };

  await eegChar.startNotifications();
  eegChar.addEventListener('characteristicvaluechanged', handleEeg);

  await telChar.startNotifications();
  telChar.addEventListener('characteristicvaluechanged', handleTel);

  device.addEventListener('gattserverdisconnected', handlers.onDisconnected);

  return {
    deviceName: device.name || NEUROLINK_BLE_DEVICE_NAME,
    sendCommand: async (cmd: string) => {
      const encoded = new TextEncoder().encode(cmd.trim());
      if (cmdChar.writeValueWithoutResponse) {
        await cmdChar.writeValueWithoutResponse(encoded);
      } else {
        await cmdChar.writeValue(encoded);
      }
    },
    disconnect: () => {
      eegChar.removeEventListener('characteristicvaluechanged', handleEeg);
      telChar.removeEventListener('characteristicvaluechanged', handleTel);
      if (server.connected) server.disconnect();
    },
  };
}

export function generateBleFieldBurst(
  scenario: 'normal' | 'stroke_alert' | 'low_battery',
  sampleRateSps = 250,
  sampleCount = 250,
): { samples: number[][]; telemetry: Record<string, unknown> } {
  const samples: number[][] = [];
  const isStroke = scenario === 'stroke_alert';
  for (let i = 0; i < sampleCount; i++) {
    const t = i / Math.max(50, sampleRateSps);
    const f3 = (isStroke ? 34 : 11) * Math.sin(2 * Math.PI * (isStroke ? 1.8 : 10.2) * t) + 3 * Math.sin(2 * Math.PI * 19 * t);
    const f4 = 11 * Math.sin(2 * Math.PI * 10.1 * t + 0.4) + 3 * Math.sin(2 * Math.PI * 18 * t);
    const c3 = (isStroke ? 30 : 12) * Math.sin(2 * Math.PI * (isStroke ? 2.1 : 10.0) * t + 0.2);
    const c4 = 12 * Math.sin(2 * Math.PI * 10.3 * t + 0.7);
    const o1 = 22 * Math.sin(2 * Math.PI * 9.8 * t + 0.5);
    const o2 = 21 * Math.sin(2 * Math.PI * 10.0 * t + 0.9);
    const t3 = (isStroke ? 26 : 10) * Math.sin(2 * Math.PI * (isStroke ? 2.0 : 9.5) * t + 1.1);
    const t4 = 10 * Math.sin(2 * Math.PI * 9.7 * t + 1.4);
    samples.push(
      [f3, f4, c3, c4, o1, o2, t3, t4].map((v) => Number(v.toFixed(3))),
    );
  }

  const telemetry: Record<string, unknown> = {
    type: 'telemetry',
    fw: 'V3.0.0',
    mode: 'BLE_FIELD',
    rate_sps: sampleRateSps,
    pga: 24,
    vbat_mv: scenario === 'low_battery' ? 3410 : 3940,
    bat_pct: scenario === 'low_battery' ? 14 : 78,
    loff_p: 0,
    ai_state: isStroke ? 'STROKE_ALERT' : 'NORMAL',
    ai_rf_prob: isStroke ? 0.87 : 0.08,
    ai_lr_prob: isStroke ? 0.83 : 0.06,
    ai_bsi: isStroke ? 0.42 : 0.09,
    ai_dar: isStroke ? 7.8 : 0.92,
    ai_usable_ch: 8,
  };

  return { samples, telemetry };
}
