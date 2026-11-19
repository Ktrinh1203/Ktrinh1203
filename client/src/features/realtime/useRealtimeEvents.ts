import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';

export const DEVICE_REALTIME_EVENT_NAME = 'neurolink:device-event';

type DeviceSseEventName =
  | 'device:waveform'
  | 'device:telemetry'
  | 'device:alert'
  | 'device:session';

const DEVICE_SSE_EVENTS: readonly DeviceSseEventName[] = [
  'device:waveform',
  'device:telemetry',
  'device:alert',
  'device:session',
];

function parseSseData(raw: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return {};
  }
}

export function useRealtimeEvents(enabled?: boolean) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isActive = enabled ?? Boolean(user?.id);

  useEffect(() => {
    if (!isActive || typeof EventSource === 'undefined') {
      return;
    }

    const es = new EventSource('/api/realtime/stream', { withCredentials: true });

    const onMessageNew = () => {
      void queryClient.invalidateQueries({ queryKey: ['messages'] });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };

    const onNotificationNew = () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    const onWalletOrPaymentUpdate = () => {
      void queryClient.invalidateQueries({ queryKey: ['rewards'] });
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['my-wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
    };

    const deviceHandlers = new Map<DeviceSseEventName, EventListener>();

    for (const eventName of DEVICE_SSE_EVENTS) {
      const handler: EventListener = (evt) => {
        const messageEvent = evt as MessageEvent<string>;
        const payload = parseSseData(messageEvent.data);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(DEVICE_REALTIME_EVENT_NAME, {
              detail: { type: eventName, payload },
            }),
          );
        }
        if (eventName !== 'device:waveform') {
          void queryClient.invalidateQueries({ queryKey: ['devices'] });
        }
      };
      deviceHandlers.set(eventName, handler);
      es.addEventListener(eventName, handler);
    }

    es.addEventListener('message:new', onMessageNew);
    es.addEventListener('notification:new', onNotificationNew);
    es.addEventListener('payment:paid', onWalletOrPaymentUpdate);
    es.addEventListener('wallet:updated', onWalletOrPaymentUpdate);

    return () => {
      es.removeEventListener('message:new', onMessageNew);
      es.removeEventListener('notification:new', onNotificationNew);
      es.removeEventListener('payment:paid', onWalletOrPaymentUpdate);
      es.removeEventListener('wallet:updated', onWalletOrPaymentUpdate);
      for (const [eventName, handler] of deviceHandlers.entries()) {
        es.removeEventListener(eventName, handler);
      }
      es.close();
    };
  }, [isActive, queryClient]);
}
