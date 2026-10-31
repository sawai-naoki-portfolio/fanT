import Storage from 'expo-sqlite/kv-store';
import { randomUUID } from 'expo-crypto';
import { AppState, Platform } from 'react-native';

import { APP_CONFIG } from '../../config';
import { fetchWithTimeout } from '../../lib/fetch-with-timeout';
import { toErrorEvent, type AnalyticsEvent } from './events';

const INSTALL_ID_KEY = 'analytics.installId';
const PENDING_KEY = 'analytics.pending';
const FLUSH_INTERVAL_MS = 30_000;
const MAX_BATCH = 50;
const MAX_PENDING = 200;
const FLUSH_TIMEOUT_MS = 15_000;

interface Envelope {
  readonly event: AnalyticsEvent;
  readonly at: number;
}

let queue: Envelope[] = [];
let started = false;
/** One request at a time, so a batch is never sent twice. */
let flushing = false;

/** Anonymous per-install ID (SET-04); reset by reinstalling the app. Also keys A/B tests. */
export function getInstallId(): string {
  let id = Storage.getItemSync(INSTALL_ID_KEY);
  if (id === null) {
    id = randomUUID();
    Storage.setItemSync(INSTALL_ID_KEY, id);
  }
  return id;
}

/** Keeps unsent events across launches (a crash stops the app before it can send). */
function persistQueue(): void {
  try {
    Storage.setItemSync(PENDING_KEY, JSON.stringify(queue.slice(-MAX_PENDING)));
  } catch {
    // Storage full or unavailable: the events are still sent from memory.
  }
}

function restoreQueue(): void {
  try {
    const saved: unknown = JSON.parse(Storage.getItemSync(PENDING_KEY) ?? '[]');
    if (Array.isArray(saved)) queue = (saved as Envelope[]).slice(-MAX_PENDING);
  } catch {
    queue = [];
  }
}

/** Whether a batch is done with: sent, or rejected in a way a retry cannot fix. */
function isSettled(status: number): boolean {
  if (status >= 200 && status < 300) return true;
  // A malformed batch (e.g. from an older version) would otherwise block the queue forever;
  // timeouts, rate limits and server errors are retried.
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

async function flush(): Promise<void> {
  const { apiBaseUrl } = APP_CONFIG;
  if (apiBaseUrl === null || queue.length === 0 || flushing) return;
  flushing = true;
  const batch = queue.slice(0, MAX_BATCH);
  try {
    const status = await fetchWithTimeout(
      `${apiBaseUrl}/v1/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installId: getInstallId(),
          platform: Platform.OS,
          appVersion: APP_CONFIG.appVersion,
          events: batch,
        }),
      },
      FLUSH_TIMEOUT_MS,
      (response) => Promise.resolve(response.status),
    );
    if (isSettled(status)) {
      // By identity: the queue may have grown or been trimmed while the request ran.
      const sent = new Set(batch);
      queue = queue.filter((envelope) => !sent.has(envelope));
      persistQueue();
    }
  } catch {
    // Offline: the events stay queued for the next flush.
  } finally {
    flushing = false;
  }
}

/** Records an event; sent in batches (ANL-01). Never throws, so it is safe anywhere in the UI. */
export function track(event: AnalyticsEvent): void {
  if (__DEV__) console.info('[analytics]', event);
  queue.push({ event, at: Date.now() });
  if (queue.length > MAX_PENDING) queue = queue.slice(-MAX_PENDING);
  persistQueue();
}

/** Reports a handled error (ANL-02); never throws. */
export function reportError(error: unknown, context: string): void {
  if (__DEV__) console.warn(`[${context}]`, error);
  try {
    track(toErrorEvent(error, context, false));
  } catch {
    // Reporting must never cause another failure.
  }
}

/**
 * Starts batching and installs a handler that records fatal JS errors before the
 * default handler shows or ends the app (ANL-02). Call once at startup.
 */
export function startAnalytics(): void {
  if (started) return;
  started = true;
  restoreQueue();
  const previous = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    try {
      track(toErrorEvent(error, 'global', isFatal === true));
    } finally {
      previous(error, isFatal);
    }
  });
  setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  AppState.addEventListener('change', (state) => {
    if (state === 'background') void flush();
  });
  track({ name: 'app_open' });
  void flush();
}
