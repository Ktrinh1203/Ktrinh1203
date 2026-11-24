import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';

export const DEVICE_REALTIME_EVENT_NAME = 'neurolink:device-event';

const DEVICE_EVENTS = [
  'device:waveform',
  'device:telemetry',
  'device:alert',
  'device:session',
] as const;

export function useRealtimeEvents(enabled?: boolean) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isActive = enabled ?? Boolean(user?.id);

  useEffect(() => {
    if (!isActive || typeof EventSource === 'undefined') return;

    const es = new EventSource('/api/realtime/stream', { withCredentials: true });

    const onMessage = () => {
      void queryClient.invalidateQueries({ queryKey: ['messages'] });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };
    const onNotif = () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };
    const onWallet = () => {
      void queryClient.invalidateQueries({ queryKey: ['my-wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
    };

    const handlers = new Map<string, EventListener>();
    for (const evtName of DEVICE_EVENTS) {
      const fn: EventListener = (e) => {
        const raw = (e as MessageEvent<string>).data;
        let payload: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') payload = parsed as Record<string, unknown>;
        } catch {
          // ignore parse error
        }
        window.dispatchEvent(
          new CustomEvent(DEVICE_REALTIME_EVENT_NAME, { detail: { type: evtName, payload } }),
        );
        if (evtName !== 'device:waveform') {
          void queryClient.invalidateQueries({ queryKey: ['devices'] });
        }
      };
      handlers.set(evtName, fn);
      es.addEventListener(evtName, fn);
    }

    es.addEventListener('message:new', onMessage);
    es.addEventListener('notification:new', onNotif);
    es.addEventListener('payment:paid', onWallet);
    es.addEventListener('wallet:updated', onWallet);

    return () => {
      es.removeEventListener('message:new', onMessage);
      es.removeEventListener('notification:new', onNotif);
      es.removeEventListener('payment:paid', onWallet);
      es.removeEventListener('wallet:updated', onWallet);
      for (const [k, fn] of handlers.entries()) es.removeEventListener(k, fn);
      es.close();
    };
  }, [isActive, queryClient]);
}
