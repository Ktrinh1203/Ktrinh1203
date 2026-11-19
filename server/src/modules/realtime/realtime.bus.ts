import type { Response } from 'express';

const MAX_CONCURRENT_STREAMS_PER_USER = 5;
const HEARTBEAT_INTERVAL_MS = 20_000;

interface SseStreamEntry {
  res: Response;
  heartbeatTimer: ReturnType<typeof setInterval>;
  closed: boolean;
}

export interface RealtimeStats {
  connectedUsers: number;
  totalConnections: number;
}

export interface RealtimeBus {
  subscribe(userId: string, res: Response): () => void;
  emitToUser(userId: string, event: string, data: unknown): void;
  broadcast(event: string, data: unknown): void;
  getStats(): RealtimeStats;
}

function sanitizeEventName(event: string): string {
  return event.replace(/[\r\n]+/g, '').trim() || 'message';
}

function formatSseFrame(event: string, data: unknown): string {
  const safeEvent = sanitizeEventName(event);
  return `event: ${safeEvent}\ndata: ${JSON.stringify(data)}\n\n`;
}

class InMemoryRealtimeBus implements RealtimeBus {
  private readonly streamsByUser = new Map<string, SseStreamEntry[]>();

  public subscribe(userId: string, res: Response): () => void {
    let userStreams = this.streamsByUser.get(userId);
    if (!userStreams) {
      userStreams = [];
      this.streamsByUser.set(userId, userStreams);
    }

    // Cap max 5 concurrent streams per user by closing the oldest stream(s).
    while (userStreams.length >= MAX_CONCURRENT_STREAMS_PER_USER) {
      const oldest = userStreams.shift();
      if (oldest) {
        this.disposeEntry(userId, oldest, true);
      }
    }

    const entry: SseStreamEntry = {
      res,
      closed: false,
      heartbeatTimer: setInterval(() => {
        if (entry.closed || res.writableEnded || res.destroyed) {
          this.disposeEntry(userId, entry, false);
          return;
        }
        try {
          res.write(': heartbeat\n\n');
        } catch {
          this.disposeEntry(userId, entry, false);
        }
      }, HEARTBEAT_INTERVAL_MS),
    };

    entry.heartbeatTimer.unref();
    userStreams.push(entry);

    return () => {
      this.disposeEntry(userId, entry, false);
    };
  }

  public emitToUser(userId: string, event: string, data: unknown): void {
    const userStreams = this.streamsByUser.get(userId);
    if (!userStreams || userStreams.length === 0) return;

    const frame = formatSseFrame(event, data);
    // Snapshot array so in-loop disposal does not skip elements
    for (const entry of [...userStreams]) {
      if (entry.closed || entry.res.writableEnded || entry.res.destroyed) {
        this.disposeEntry(userId, entry, false);
        continue;
      }
      try {
        entry.res.write(frame);
      } catch {
        this.disposeEntry(userId, entry, false);
      }
    }
  }

  public broadcast(event: string, data: unknown): void {
    if (this.streamsByUser.size === 0) return;

    const frame = formatSseFrame(event, data);
    for (const [userId, userStreams] of [...this.streamsByUser.entries()]) {
      for (const entry of [...userStreams]) {
        if (entry.closed || entry.res.writableEnded || entry.res.destroyed) {
          this.disposeEntry(userId, entry, false);
          continue;
        }
        try {
          entry.res.write(frame);
        } catch {
          this.disposeEntry(userId, entry, false);
        }
      }
    }
  }

  public getStats(): RealtimeStats {
    let connectedUsers = 0;
    let totalConnections = 0;

    for (const [userId, streams] of [...this.streamsByUser.entries()]) {
      const active = streams.filter((s) => !s.closed && !s.res.writableEnded && !s.res.destroyed);
      if (active.length !== streams.length) {
        for (const s of streams) {
          if (s.closed || s.res.writableEnded || s.res.destroyed) {
            clearInterval(s.heartbeatTimer);
            s.closed = true;
          }
        }
        if (active.length === 0) {
          this.streamsByUser.delete(userId);
          continue;
        }
        this.streamsByUser.set(userId, active);
      }

      if (active.length > 0) {
        connectedUsers += 1;
        totalConnections += active.length;
      }
    }

    return { connectedUsers, totalConnections };
  }

  private disposeEntry(userId: string, entry: SseStreamEntry, endResponse: boolean): void {
    if (!entry.closed) {
      entry.closed = true;
      clearInterval(entry.heartbeatTimer);
    }

    const userStreams = this.streamsByUser.get(userId);
    if (userStreams) {
      const idx = userStreams.indexOf(entry);
      if (idx !== -1) {
        userStreams.splice(idx, 1);
      }
      if (userStreams.length === 0) {
        this.streamsByUser.delete(userId);
      }
    }

    if (endResponse && !entry.res.writableEnded && !entry.res.destroyed) {
      try {
        entry.res.end();
      } catch {
        // Ignore socket close race
      }
    }
  }
}

export const realtimeBus: RealtimeBus = new InMemoryRealtimeBus();
