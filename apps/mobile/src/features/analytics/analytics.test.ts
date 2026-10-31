import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { emitAppState } from '../../../test/controls';
import type { AnalyticsEvent } from './events';

interface Batch {
  readonly installId: string;
  readonly platform: string;
  readonly appVersion: string;
  readonly events: readonly { readonly event: AnalyticsEvent; readonly at: number }[];
}

/** A fake events API answering with `status()`; `pause` holds requests until released. */
function serveEvents(status: () => number = () => 204) {
  const batches: Batch[] = [];
  let release: (() => void) | null = null;
  const server = {
    batches,
    names: () => batches.map(({ events }) => events.map(({ event }) => event.name)),
    paused: false,
    release: () => {
      release?.();
    },
  };
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    expect(url).toBe('https://api.example.com/v1/events');
    batches.push(JSON.parse(init.body as string) as Batch);
    if (server.paused) {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    }
    return new Response(null, { status: status() });
  });
  return server;
}

let globalHandler: (error: unknown, isFatal?: boolean) => void;
const defaultHandler = vi.fn();

/** A fresh launch of the app: the module's queue and timers start over. */
async function launch() {
  vi.resetModules();
  const analytics = await import('./analytics');
  return analytics;
}

/** Lets pending requests and their callbacks finish. */
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('analytics', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval'] });
    globalHandler = defaultHandler;
    Object.assign(globalThis, {
      ErrorUtils: {
        getGlobalHandler: () => globalHandler,
        setGlobalHandler: (handler: typeof globalHandler) => {
          globalHandler = handler;
        },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    defaultHandler.mockClear();
  });

  it('sends events in batches with the anonymous install ID', async () => {
    const server = serveEvents();
    const { startAnalytics, track, getInstallId } = await launch();

    startAnalytics();
    await settle();
    track({ name: 'film_selected', filmId: 'mono' });
    vi.advanceTimersByTime(30_000);
    await settle();

    expect(server.names()).toEqual([['app_open'], ['film_selected']]);
    expect(server.batches[0]).toMatchObject({
      installId: getInstallId(),
      platform: 'ios',
      appVersion: '1.2.3',
    });
    expect((await launch()).getInstallId()).toBe(getInstallId());
  });

  it('keeps events while offline and sends them when the app goes to the background', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Network request failed')));
    const { startAnalytics, track } = await launch();
    startAnalytics();
    await settle();
    track({ name: 'photo_saved', kind: 'camera' });

    const server = serveEvents();
    emitAppState('background');
    await settle();

    expect(server.names()).toEqual([['app_open', 'photo_saved']]);
  });

  it('retries server errors and rate limits, but drops rejected batches', async () => {
    let status = 503;
    const server = serveEvents(() => status);
    const { startAnalytics } = await launch();
    startAnalytics();
    await settle();
    status = 429;
    emitAppState('background');
    await settle();
    status = 400;
    emitAppState('background');
    await settle();
    emitAppState('background');
    await settle();

    expect(server.names()).toEqual([['app_open'], ['app_open'], ['app_open']]);
  });

  it('sends events left from the last launch', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Network request failed')));
    const first = await launch();
    first.track({ name: 'photo_taken', mode: 'film', filmId: 'mono' });

    const server = serveEvents();
    (await launch()).startAnalytics();
    await settle();

    expect(server.names()).toEqual([['photo_taken', 'app_open']]);
  });

  it('keeps only the latest 200 events', async () => {
    const server = serveEvents();
    const { startAnalytics, track } = await launch();
    for (let count = 0; count < 250; count++) track({ name: 'collage_made', count });

    startAnalytics();
    await settle();
    for (let flushes = 0; flushes < 4; flushes++) {
      emitAppState('background');
      await settle();
    }

    const counts = server.batches.flatMap(({ events }) =>
      events.flatMap(({ event }) => (event.name === 'collage_made' ? [event.count] : [])),
    );
    expect(counts).toHaveLength(199);
    expect(counts[0]).toBe(51);
    expect(counts.at(-1)).toBe(249);
  });

  it('sends one batch at a time and keeps events tracked meanwhile', async () => {
    const server = serveEvents();
    server.paused = true;
    const { startAnalytics, track } = await launch();
    startAnalytics();
    await settle();

    track({ name: 'photo_saved', kind: 'puri' });
    emitAppState('background');
    await settle();
    expect(server.batches).toHaveLength(1);

    server.paused = false;
    server.release();
    await settle();
    emitAppState('background');
    await settle();

    expect(server.names()).toEqual([['app_open'], ['photo_saved']]);
  });

  it('records a fatal JS error before the default handler runs', async () => {
    const server = serveEvents();
    const { startAnalytics } = await launch();
    startAnalytics();
    await settle();
    const error = new TypeError('Cannot read file:///secret/path');

    globalHandler(error, true);
    emitAppState('background');
    await settle();

    expect(defaultHandler).toHaveBeenCalledWith(error, true);
    expect(server.batches[1]?.events[0]?.event).toEqual({
      name: 'error',
      context: 'global',
      errorName: 'TypeError',
      message: 'Cannot read <uri>',
      fatal: true,
    });
  });

  it('sends nothing without a server', async () => {
    const server = serveEvents();
    const { startAnalytics } = await launch();
    const { APP_CONFIG } = await import('../../config');
    Object.assign(APP_CONFIG, { apiBaseUrl: null });

    startAnalytics();
    await settle();

    expect(server.batches).toEqual([]);
  });
});
