/**
 * Persistent IndexedDB offline queue + Wi-Fi auto-sync helper for outdoor BLE EEG capture.
 * Falls back transparently to localStorage if IndexedDB is unavailable.
 */

export interface PendingBleBatch {
  id: string;
  deviceId: string;
  deviceCode: string;
  createdAt: string;
  sampleRateSps: number;
  montage: string;
  samples: number[][];
  telemetry?: Record<string, unknown>;
  captureSession?: boolean;
  sessionTitle?: string;
  sourceMode: 'ble_hardware' | 'ble_simulator';
}

export interface NetworkSyncStatus {
  online: boolean;
  connectionType: string;
  effectiveType: string;
  wifiReady: boolean;
}

const DB_NAME = 'neurolink_ble_field_v1';
const STORE_NAME = 'pending_batches';
const FALLBACK_KEY = 'neurolink_ble_fallback_queue_v1';

interface NavigatorConnectionLike {
  type?: string;
  effectiveType?: string;
}

export function getNetworkSyncStatus(wifiOnly: boolean): NetworkSyncStatus {
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const conn =
    typeof navigator !== 'undefined'
      ? ((navigator as unknown as { connection?: NavigatorConnectionLike }).connection ?? null)
      : null;

  const connectionType = conn?.type ?? 'unknown';
  const effectiveType = conn?.effectiveType ?? 'unknown';

  if (!online) {
    return { online: false, connectionType, effectiveType, wifiReady: false };
  }

  if (!wifiOnly) {
    return { online: true, connectionType, effectiveType, wifiReady: true };
  }

  // Android Chrome / WebView exposes `connection.type` ('wifi', 'cellular', 'ethernet').
  // Desktop browsers often omit `type` ('unknown') while only reporting online status.
  const wifiReady =
    connectionType === 'wifi' ||
    connectionType === 'ethernet' ||
    connectionType === 'unknown';

  return { online: true, connectionType, effectiveType, wifiReady };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

function readFallback(): PendingBleBatch[] {
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PendingBleBatch[]) : [];
  } catch {
    return [];
  }
}

function writeFallback(items: PendingBleBatch[]): void {
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors in restricted fallback mode
  }
}

export async function listPendingBleBatches(): Promise<PendingBleBatch[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const rows = (req.result as PendingBleBatch[]) ?? [];
        rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return readFallback();
  }
}

export async function enqueuePendingBleBatch(
  batch: Omit<PendingBleBatch, 'id' | 'createdAt'>,
): Promise<PendingBleBatch> {
  const entry: PendingBleBatch = {
    ...batch,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return entry;
  } catch {
    const current = readFallback();
    current.push(entry);
    writeFallback(current.slice(-100));
    return entry;
  }
}

export async function removePendingBleBatch(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    writeFallback(readFallback().filter((item) => item.id !== id));
  }
}
