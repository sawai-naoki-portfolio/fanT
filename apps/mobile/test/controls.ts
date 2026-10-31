import { sharedState } from './shared-state';

/*
 * What tests control in the native-module fakes. Kept free of Node.js APIs, so the
 * app's own type check can include the tests that import it.
 */

export type DownloadHandler = (
  url: string,
  options: { readonly signal?: AbortSignal },
) => Promise<Uint8Array>;

const noDownloads: DownloadHandler = (url) =>
  Promise.reject(new Error(`No download handler for ${url}`));

export const downloads = sharedState('downloads', () => ({ handler: noDownloads }));

/** Answers `File.downloadFileAsync`; the test decides what each URL returns. */
export function setDownloadHandler(handler: DownloadHandler): void {
  downloads.handler = handler;
}

type AppStateListener = (state: string) => void;

export const appStateListeners = sharedState('app-state', () => new Set<AppStateListener>());

/** Moves the app to the foreground or background, as the OS would. */
export function emitAppState(state: string): void {
  for (const listener of appStateListeners) listener(state);
}

export function resetControls(): void {
  downloads.handler = noDownloads;
  appStateListeners.clear();
}
