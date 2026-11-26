import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { devicesApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import {
  autoConnectNeuroLinkBleById,
  connectNeuroLinkBle,
  DEVICE_ID_SAVED_EVENT,
  generateBleFieldBurst,
  getPairedDeviceId,
  isWebBluetoothSupported,
  setPairedDeviceId,
  type BleConnectionHandle,
} from '../lib/bleProtocol';
import {
  enqueuePendingBleBatch,
  getNetworkSyncStatus,
  listPendingBleBatches,
  removePendingBleBatch,
  type NetworkSyncStatus,
  type PendingBleBatch,
} from '../lib/offlineSyncQueue';

export type BleLinkStatus = 'idle' | 'connecting' | 'connected' | 'simulating' | 'error';
export type BleStreamMode = 'auto' | 'realtime';

const BLE_MODE_STORAGE_KEY = 'neurolink_ble_mode_v1';

export interface BleTelemetrySnapshot {
  batPct?: number;
  vbatMv?: number;
  aiState?: string;
  rateSps?: number;
  bleMode?: 'AUTO' | 'REALTIME';
  bleBurst?: boolean;
}

const CHUNK_FLUSH_THRESHOLD = 1000; // 4s @ 250 SPS BLE stream (stabilizes Delta/DAR)

export function useBleFieldSync(params: {
  deviceId: string | undefined;
  deviceCode: string | undefined;
  montage: string;
  onSynced?: () => void;
}) {
  const { deviceId, deviceCode, montage, onSynced } = params;

  const [bleStatus, setBleStatus] = useState<BleLinkStatus>('idle');
  const [pairedDeviceId, setPairedDeviceIdState] = useState<string>(() => getPairedDeviceId());
  const [bleDeviceName, setBleDeviceName] = useState<string | null>(null);
  const autoConnectAttemptedRef = useRef<boolean>(false);
  const [bleLiveSamples, setBleLiveSamples] = useState<number[][]>([]);
  const [bleTelemetry, setBleTelemetry] = useState<BleTelemetrySnapshot | null>(null);
  const [pendingBatches, setPendingBatches] = useState<PendingBleBatch[]>([]);
  const [wifiOnly, setWifiOnly] = useState<boolean>(true);
  const [bleStreamMode, setBleStreamMode] = useState<BleStreamMode>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(BLE_MODE_STORAGE_KEY);
      if (saved === 'realtime' || saved === 'auto') return saved;
    }
    return 'auto';
  });
  const [networkStatus, setNetworkStatus] = useState<NetworkSyncStatus>(() =>
    getNetworkSyncStatus(true),
  );
  const [syncing, setSyncing] = useState<boolean>(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const bleHandleRef = useRef<BleConnectionHandle | null>(null);
  const sampleAccRef = useRef<number[][]>([]);
  const latestTelRef = useRef<Record<string, unknown> | undefined>(undefined);
  const flushingRef = useRef<boolean>(false);

  const refreshQueue = useCallback(async () => {
    const items = await listPendingBleBatches();
    setPendingBatches(items);
    return items;
  }, []);

  const flushQueue = useCallback(
    async (ignoreWifiGuard = false) => {
      if (flushingRef.current) return;
      const net = getNetworkSyncStatus(wifiOnly);
      setNetworkStatus(net);
      if (!net.online) {
        setStatusMessage('Đang ngoại tuyến — giữ gói đo trong bộ nhớ máy.');
        return;
      }
      if (!ignoreWifiGuard && !net.wifiReady) {
        setStatusMessage('Đang dùng mạng di động — chờ Wi-Fi để tự đồng bộ.');
        return;
      }

      const items = await listPendingBleBatches();
      setPendingBatches(items);
      if (items.length === 0) return;

      flushingRef.current = true;
      setSyncing(true);
      let syncedCount = 0;
      try {
        for (const batch of items) {
          const targetId = batch.deviceId || deviceId;
          if (!targetId) continue;
          await devicesApi.bleSync(targetId, {
            montage: batch.montage,
            sampleRateSps: batch.sampleRateSps,
            samples: batch.samples,
            telemetry: batch.telemetry,
            captureSession: batch.captureSession ?? true,
            sessionTitle: batch.sessionTitle,
          });
          await removePendingBleBatch(batch.id);
          syncedCount++;
        }
        if (syncedCount > 0) {
          setLastSyncAt(new Date().toLocaleTimeString('vi-VN', { hour12: false }));
          setStatusMessage(`Đã đồng bộ ${syncedCount} gói đo BLE lên server.`);
          onSynced?.();
        }
      } catch (err) {
        setStatusMessage(`Tạm dừng đồng bộ: ${errorMessage(err)}`);
      } finally {
        flushingRef.current = false;
        setSyncing(false);
        await refreshQueue();
      }
    },
    [deviceId, onSynced, refreshQueue, wifiOnly],
  );

  // Load IndexedDB queue on mount & subscribe to network/Wi-Fi changes
  useEffect(() => {
    void refreshQueue();

    const handleNetworkChange = () => {
      const next = getNetworkSyncStatus(wifiOnly);
      setNetworkStatus(next);
      if (next.wifiReady) {
        void flushQueue(false);
      }
    };

    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);
    const conn = (navigator as unknown as { connection?: EventTarget }).connection;
    conn?.addEventListener?.('change', handleNetworkChange);

    // Periodic check while app stays open outdoors
    const timer = window.setInterval(handleNetworkChange, 15000);
    return () => {
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
      conn?.removeEventListener?.('change', handleNetworkChange);
      window.clearInterval(timer);
    };
  }, [flushQueue, refreshQueue, wifiOnly]);

  const commitAccumulatorToQueue = useCallback(
    async (captureSession = true) => {
      if (!deviceId || !deviceCode || sampleAccRef.current.length === 0) return;
      const samples = sampleAccRef.current;
      sampleAccRef.current = [];

      await enqueuePendingBleBatch({
        deviceId,
        deviceCode,
        sampleRateSps: bleTelemetry?.rateSps ?? 250,
        montage,
        samples,
        telemetry: latestTelRef.current,
        captureSession,
        sessionTitle: `Ngoài đường BLE · ${new Date().toLocaleTimeString('vi-VN', { hour12: false })}`,
        sourceMode: 'ble_hardware',
      });
      await refreshQueue();
      await flushQueue(false);
    },
    [bleTelemetry?.rateSps, deviceCode, deviceId, flushQueue, montage, refreshQueue],
  );

  const connectRealBle = useCallback(
    async (overrideTargetId?: string) => {
      if (!deviceId || !deviceCode) {
        setStatusMessage('Chọn thiết bị đích trước khi ghép đôi BLE.');
        return;
      }
      const targetId = (overrideTargetId ?? pairedDeviceId).trim().toUpperCase();
      setBleStatus('connecting');
      setStatusMessage(
        targetId
          ? `Đang bật Bluetooth & tự động liên kết ${targetId}...`
          : 'Đang tìm thiết bị NeuroLink qua Bluetooth BLE...',
      );

      try {
        const handlers = {
          onSamples: (rows: number[][]) => {
            setBleLiveSamples((prev) => [...prev, ...rows].slice(-250));
            sampleAccRef.current.push(...rows);
            if (sampleAccRef.current.length >= CHUNK_FLUSH_THRESHOLD) {
              void commitAccumulatorToQueue(true);
            }
          },
          onTelemetry: (tel: Record<string, unknown>) => {
            latestTelRef.current = tel;
            const aiState = typeof tel.ai_state === 'string' ? tel.ai_state : undefined;
            const bleMode =
              tel.ble_mode === 'REALTIME' || tel.ble_mode === 'AUTO' ? tel.ble_mode : undefined;
            const bleBurst = typeof tel.ble_burst === 'boolean' ? tel.ble_burst : undefined;
            setBleTelemetry({
              batPct: typeof tel.bat_pct === 'number' ? tel.bat_pct : undefined,
              vbatMv: typeof tel.vbat_mv === 'number' ? tel.vbat_mv : undefined,
              aiState,
              rateSps: typeof tel.rate_sps === 'number' ? tel.rate_sps : undefined,
              bleMode,
              bleBurst,
            });
            if (aiState === 'STROKE_ALERT' && navigator.onLine) {
              void flushQueue(true);
            }
          },
          onDisconnected: () => {
            bleHandleRef.current = null;
            setBleStatus('idle');
            setStatusMessage('ESP32 BLE đã ngắt kết nối — lưu nốt gói đệm vào máy.');
            void commitAccumulatorToQueue(true);
          },
        };

        const handle =
          targetId && Capacitor.isNativePlatform()
            ? await autoConnectNeuroLinkBleById(targetId, handlers)
            : await connectNeuroLinkBle(handlers);

        bleHandleRef.current = handle;
        setBleDeviceName(handle.deviceName);
        setBleStatus('connected');
        const initCmd = bleStreamMode === 'realtime' ? 'BLE_MODE_REALTIME' : 'BLE_MODE_AUTO';
        await handle.sendCommand(initCmd).catch(() => undefined);
        setStatusMessage(
          bleStreamMode === 'realtime'
            ? `Đã tự động liên kết ${handle.deviceName} · Realtime 250Hz.`
            : `Đã tự động liên kết ${handle.deviceName} · Auto tiết kiệm pin.`,
        );
      } catch (err) {
        setBleStatus('error');
        setStatusMessage(errorMessage(err));
      }
    },
    [bleStreamMode, commitAccumulatorToQueue, deviceCode, deviceId, flushQueue, pairedDeviceId],
  );

  const savePairedDeviceId = useCallback(
    async (rawId: string) => {
      const saved = setPairedDeviceId(rawId);
      setPairedDeviceIdState(saved);
      if (saved && Capacitor.isNativePlatform()) {
        await connectRealBle(saved);
      }
    },
    [connectRealBle],
  );

  // Sync pairedDeviceId if saved from first-launch onboarding modal
  useEffect(() => {
    const onSaved = (ev: Event) => {
      const detail = (ev as CustomEvent<{ deviceId?: string }>).detail;
      const nextId = detail?.deviceId ?? getPairedDeviceId();
      setPairedDeviceIdState(nextId);
      if (nextId && Capacitor.isNativePlatform() && !bleHandleRef.current) {
        void connectRealBle(nextId);
      }
    };
    window.addEventListener(DEVICE_ID_SAVED_EVENT, onSaved);
    return () => window.removeEventListener(DEVICE_ID_SAVED_EVENT, onSaved);
  }, [connectRealBle]);

  // Silent auto-connect once per app launch on native Android when Device ID is already saved
  useEffect(() => {
    if (
      !Capacitor.isNativePlatform() ||
      !pairedDeviceId ||
      !deviceId ||
      !deviceCode ||
      bleHandleRef.current ||
      autoConnectAttemptedRef.current
    ) {
      return;
    }
    autoConnectAttemptedRef.current = true;
    void connectRealBle(pairedDeviceId);
  }, [connectRealBle, deviceCode, deviceId, pairedDeviceId]);

  const disconnectBle = useCallback(() => {
    bleHandleRef.current?.disconnect();
    bleHandleRef.current = null;
    setBleStatus('idle');
    void commitAccumulatorToQueue(true);
  }, [commitAccumulatorToQueue]);

  const sendBleCommand = useCallback(async (cmd: string) => {
    if (!bleHandleRef.current) return;
    await bleHandleRef.current.sendCommand(cmd);
    setStatusMessage(`Đã gửi lệnh BLE: ${cmd}`);
  }, []);

  const changeBleStreamMode = useCallback(async (mode: BleStreamMode) => {
    setBleStreamMode(mode);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BLE_MODE_STORAGE_KEY, mode);
    }
    if (bleHandleRef.current) {
      const cmd = mode === 'realtime' ? 'BLE_MODE_REALTIME' : 'BLE_MODE_AUTO';
      await bleHandleRef.current.sendCommand(cmd).catch(() => undefined);
    }
    setStatusMessage(
      mode === 'realtime'
        ? 'Đã chuyển sang Realtime: truyền sóng 8 kênh liên tục.'
        : 'Đã chuyển sang Auto tiết kiệm pin: chỉ gửi sóng khi có cảnh báo.',
    );
  }, []);

  const simulateOutdoorBleCapture = useCallback(
    async (scenario: 'normal' | 'stroke_alert' = 'normal') => {
      if (!deviceId || !deviceCode) return;
      setBleStatus('simulating');
      const { samples, telemetry } = generateBleFieldBurst(scenario, 250, 250);
      setBleDeviceName('NeuroLink-Holter (BLE Sim)');
      setBleLiveSamples(samples);
      setBleTelemetry({
        batPct: Number(telemetry.bat_pct ?? 78),
        vbatMv: Number(telemetry.vbat_mv ?? 3940),
        aiState: String(telemetry.ai_state ?? 'NORMAL'),
        rateSps: 250,
      });

      await enqueuePendingBleBatch({
        deviceId,
        deviceCode,
        sampleRateSps: 250,
        montage,
        samples,
        telemetry,
        captureSession: true,
        sessionTitle: `Giả lập BLE ngoài đường (${scenario === 'stroke_alert' ? 'Cảnh báo' : 'Ổn định'})`,
        sourceMode: 'ble_simulator',
      });
      await refreshQueue();
      setBleStatus('idle');

      const net = getNetworkSyncStatus(wifiOnly);
      if (net.wifiReady) {
        await flushQueue(false);
      } else {
        setStatusMessage('Đã ghi gói BLE vào bộ nhớ máy — chờ có Wi-Fi sẽ tự đẩy.');
      }
    },
    [deviceCode, deviceId, flushQueue, montage, refreshQueue, wifiOnly],
  );

  return {
    webBluetoothAvailable: isWebBluetoothSupported(),
    bleStatus,
    pairedDeviceId,
    savePairedDeviceId,
    bleDeviceName,
    bleLiveSamples,
    bleTelemetry,
    pendingBatches,
    wifiOnly,
    setWifiOnly,
    bleStreamMode,
    changeBleStreamMode,
    networkStatus,
    syncing,
    lastSyncAt,
    statusMessage,
    connectRealBle,
    disconnectBle,
    sendBleCommand,
    simulateOutdoorBleCapture,
    forceSyncNow: () => flushQueue(true),
  };
}
