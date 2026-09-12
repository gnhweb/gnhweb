import type { RealtimeChannel } from '@supabase/supabase-js';

type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

type ChangeFilter = {
  event?: ChangeEvent;
  schema?: string;
  table?: string;
  filter?: string;
};

type Row = Record<string, unknown>;

type RealtimePayload = {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: Exclude<ChangeEvent, '*'>;
  new: Row;
  old: Row;
  errors: null;
};

type Subscription = {
  filter: ChangeFilter;
  callback: (payload: RealtimePayload) => void;
};

type ChannelState = {
  subscriptions: Subscription[];
  previousRows: Map<string, Row>;
  timer: ReturnType<typeof setInterval> | null;
  polling: boolean;
};

const states = new WeakMap<object, ChannelState>();
const POLL_INTERVAL_MS = 5000;

function rowKey(row: Row): string {
  const id = row.id;
  if (typeof id === 'string' || typeof id === 'number') return String(id);

  const stable = Object.keys(row)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = row[key];
      return result;
    }, {});
  return JSON.stringify(stable);
}

function matchesFilter(row: Row, filter?: string): boolean {
  if (!filter) return true;
  const match = filter.match(/^([^=]+)=eq\.(.*)$/);
  if (!match) return true;

  const [, field, expected] = match;
  const actual = row[field];
  return String(actual ?? '') === decodeURIComponent(expected);
}

function eventMatches(event: Exclude<ChangeEvent, '*'>, expected?: ChangeEvent): boolean {
  return !expected || expected === '*' || expected === event;
}

function createPayload(
  eventType: Exclude<ChangeEvent, '*'>,
  table: string,
  nextRow: Row,
  previousRow: Row,
): RealtimePayload {
  return {
    schema: 'public',
    table,
    commit_timestamp: new Date().toISOString(),
    eventType,
    new: eventType === 'DELETE' ? {} : nextRow,
    old: eventType === 'INSERT' ? {} : previousRow,
    errors: null,
  };
}

async function poll(
  channel: RealtimeChannel,
  queryRows: (table: string) => Promise<Row[]>,
): Promise<void> {
  const state = states.get(channel);
  if (!state || state.polling || state.subscriptions.length === 0) return;
  state.polling = true;

  try {
    const tables = [...new Set(state.subscriptions.map((subscription) => subscription.filter.table).filter(Boolean))] as string[];

    for (const table of tables) {
      const rows = await queryRows(table);
      const currentRows = new Map(rows.map((row) => [rowKey(row), row]));
      const previousRows = state.previousRows;

      if (previousRows.size === 0) {
        currentRows.forEach((row, key) => previousRows.set(`${table}:${key}`, row));
        continue;
      }

      const tablePrevious = new Map<string, Row>();
      previousRows.forEach((row, key) => {
        if (key.startsWith(`${table}:`)) tablePrevious.set(key.slice(table.length + 1), row);
      });

      currentRows.forEach((row, key) => {
        const previous = tablePrevious.get(key);
        const changed = !previous || JSON.stringify(previous) !== JSON.stringify(row);
        if (!changed) return;

        const eventType: Exclude<ChangeEvent, '*'> = previous ? 'UPDATE' : 'INSERT';
        state.subscriptions
          .filter((subscription) => subscription.filter.table === table)
          .filter((subscription) => eventMatches(eventType, subscription.filter.event))
          .filter((subscription) => matchesFilter(row, subscription.filter.filter) || matchesFilter(previous ?? {}, subscription.filter.filter))
          .forEach((subscription) => subscription.callback(createPayload(eventType, table, row, previous ?? {})));
      });

      tablePrevious.forEach((previous, key) => {
        if (currentRows.has(key)) return;

        state.subscriptions
          .filter((subscription) => subscription.filter.table === table)
          .filter((subscription) => eventMatches('DELETE', subscription.filter.event))
          .filter((subscription) => matchesFilter(previous, subscription.filter.filter))
          .forEach((subscription) => subscription.callback(createPayload('DELETE', table, {}, previous)));
      });

      previousRows.forEach((_row, key) => {
        if (key.startsWith(`${table}:`)) previousRows.delete(key);
      });
      currentRows.forEach((row, key) => previousRows.set(`${table}:${key}`, row));
    }
  } catch (error) {
    console.warn('[Neon Realtime] polling failed:', error);
  } finally {
    state.polling = false;
  }
}

export function createNeonRealtimeChannel(
  channel: RealtimeChannel,
  queryRows: (table: string) => Promise<Row[]>,
): RealtimeChannel {
  const state: ChannelState = {
    subscriptions: [],
    previousRows: new Map(),
    timer: null,
    polling: false,
  };
  states.set(channel, state);

  const wrapped = new Proxy(channel, {
    get(target, property, receiver) {
      if (property === 'on') {
        return (type: string, filter: unknown, callback: unknown) => {
          if (type !== 'postgres_changes' || typeof callback !== 'function' || typeof filter !== 'object' || filter === null) {
            const originalOn = Reflect.get(target, property, receiver);
            if (typeof originalOn !== 'function') return originalOn;
            return Reflect.apply(originalOn, target, [type, filter, callback]);
          }

          state.subscriptions.push({
            filter: filter as ChangeFilter,
            callback: callback as (payload: RealtimePayload) => void,
          });

          if (!state.timer) {
            void poll(target, queryRows);
            state.timer = setInterval(() => void poll(target, queryRows), POLL_INTERVAL_MS);
          }

          return wrapped;
        };
      }

      return Reflect.get(target, property, receiver);
    },
  });

  return wrapped;
}

export function disposeNeonRealtimeChannel(channel: RealtimeChannel): void {
  const state = states.get(channel);
  if (!state) return;
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
  state.subscriptions = [];
  state.previousRows.clear();
  states.delete(channel);
}
