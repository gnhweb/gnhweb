import { neon } from '@/lib/neon';

type PresenceMeta = Record<string, unknown>;
type PresenceState = Record<string, PresenceMeta[]>;
type BroadcastHandler = (message: { payload: unknown }) => void;
type PresenceHandler = () => void;
type SubscribeHandler = (status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED') => void;
type ChannelMessage =
  | { type: 'ready'; room: string }
  | { type: 'presence_sync'; state: PresenceState }
  | { type: 'presence_join'; key: string; meta: PresenceMeta }
  | { type: 'presence_leave'; key: string }
  | { type: 'broadcast'; event: string; payload: unknown }
  | { type: 'pong' }
  | { type: 'error'; error: string };

type HandlerMap = Map<string, Set<BroadcastHandler>>;

const DEFAULT_REALTIME_URL = '';
const RECONNECT_DELAY_MS = 1000;

function getRealtimeUrl(): string {
  return String(import.meta.env.VITE_CF_REALTIME_URL || DEFAULT_REALTIME_URL).replace(/\/$/, '');
}

function toWebSocketUrl(baseUrl: string, room: string): string {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/v1/realtime';
  url.search = new URLSearchParams({ room }).toString();
  return url.toString();
}

async function getAccessToken(): Promise<string | null> {
  try {
    const session = await neon.auth.getSession();
    return session.data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export class CloudflareRealtimeChannel {
  private readonly room: string;
  private socket: WebSocket | null = null;
  private subscribed = false;
  private destroyed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private presence: PresenceState = {};
  private trackedPresence: PresenceMeta | null = null;
  private readonly broadcastHandlers: HandlerMap = new Map();
  private readonly presenceHandlers = new Map<string, Set<PresenceHandler>>();
  private subscribeHandlers: SubscribeHandler[] = [];

  constructor(room: string) {
    this.room = room;
  }

  on(
    type: 'broadcast' | 'presence',
    filter: { event: string },
    callback: BroadcastHandler | PresenceHandler,
  ): this {
    if (type === 'broadcast') {
      const handlers = this.broadcastHandlers.get(filter.event) ?? new Set<BroadcastHandler>();
      handlers.add(callback as BroadcastHandler);
      this.broadcastHandlers.set(filter.event, handlers);
    } else {
      const handlers = this.presenceHandlers.get(filter.event) ?? new Set<PresenceHandler>();
      handlers.add(callback as PresenceHandler);
      this.presenceHandlers.set(filter.event, handlers);
    }
    return this;
  }

  subscribe(callback?: SubscribeHandler): this {
    if (callback) this.subscribeHandlers.push(callback);
    if (this.socket || this.destroyed) return this;

    const baseUrl = getRealtimeUrl();
    if (!baseUrl) {
      this.notifySubscribe('CHANNEL_ERROR');
      return this;
    }

    void this.connect(baseUrl);
    return this;
  }

  private async connect(baseUrl: string): Promise<void> {
    const token = await getAccessToken();
    if (!token || this.destroyed) {
      this.notifySubscribe('CHANNEL_ERROR');
      return;
    }

    try {
      const socket = new WebSocket(toWebSocketUrl(baseUrl, this.room), ['neon-auth', token]);
      this.socket = socket;

      socket.addEventListener('open', () => {
        if (this.destroyed || this.socket !== socket) return;
        this.subscribed = true;
        this.notifySubscribe('SUBSCRIBED');
        if (this.trackedPresence) {
          void this.sendRaw({ type: 'presence_track', payload: this.trackedPresence });
        }
      });
      socket.addEventListener('message', (event) => this.handleMessage(event.data));
      socket.addEventListener('error', () => this.notifySubscribe('CHANNEL_ERROR'));
      socket.addEventListener('close', () => {
        if (this.socket !== socket) return;
        this.subscribed = false;
        this.socket = null;
        this.notifySubscribe('CLOSED');
        this.scheduleReconnect(baseUrl);
      });
    } catch {
      this.socket = null;
      this.subscribed = false;
      this.notifySubscribe('CHANNEL_ERROR');
      this.scheduleReconnect(baseUrl);
    }
  }

  private scheduleReconnect(baseUrl: string): void {
    if (this.destroyed || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.destroyed && !this.socket) void this.connect(baseUrl);
    }, RECONNECT_DELAY_MS);
  }

  private notifySubscribe(status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED'): void {
    this.subscribeHandlers.forEach((handler) => handler(status));
  }

  private handleMessage(raw: unknown): void {
    if (typeof raw !== 'string') return;
    let message: ChannelMessage;
    try {
      message = JSON.parse(raw) as ChannelMessage;
    } catch {
      return;
    }

    if (message.type === 'presence_sync') {
      this.presence = message.state;
      this.emitPresence('sync');
      return;
    }

    if (message.type === 'presence_join') {
      this.presence[message.key] = [message.meta];
      this.emitPresence('join');
      this.emitPresence('sync');
      return;
    }

    if (message.type === 'presence_leave') {
      delete this.presence[message.key];
      this.emitPresence('leave');
      this.emitPresence('sync');
      return;
    }

    if (message.type === 'broadcast') {
      this.broadcastHandlers.get(message.event)?.forEach((handler) => handler({ payload: message.payload }));
    }
  }

  private emitPresence(event: string): void {
    this.presenceHandlers.get(event)?.forEach((handler) => handler());
  }

  async track(payload: PresenceMeta): Promise<'ok' | 'error'> {
    this.trackedPresence = payload;
    return this.sendRaw({ type: 'presence_track', payload });
  }

  presenceState(): PresenceState {
    return this.presence;
  }

  async send(message: { type: 'broadcast'; event: string; payload?: unknown }): Promise<'ok' | 'error'> {
    return this.sendRaw({ type: 'broadcast', event: message.event, payload: message.payload ?? null });
  }

  private async waitForConnection(): Promise<boolean> {
    if (this.socket?.readyState === WebSocket.OPEN) return true;
    if (this.destroyed) return false;

    return new Promise((resolve) => {
      let settled = false;
      const settle = (status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED') => {
        if (settled) return;
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          settled = true;
          this.subscribeHandlers = this.subscribeHandlers.filter((handler) => handler !== settle);
          resolve(status === 'SUBSCRIBED');
        }
      };

      this.subscribeHandlers.push(settle);
      if (!this.socket) this.subscribe();
    });
  }

  private async sendRaw(message: Record<string, unknown>): Promise<'ok' | 'error'> {
    if (!(await this.waitForConnection())) return 'error';
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return 'error';
    try {
      this.socket.send(JSON.stringify(message));
      return 'ok';
    } catch {
      return 'error';
    }
  }

  unsubscribe(): Promise<'ok'> {
    this.destroyed = true;
    this.subscribed = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) this.socket.close(1000, 'client closed');
    this.socket = null;
    this.trackedPresence = null;
    return Promise.resolve('ok');
  }
}

export function isCloudflareGameRoom(name: string): boolean {
  return /^(galilee-room|pharisee-room|wolves-room|wolves-role)-/.test(name);
}
