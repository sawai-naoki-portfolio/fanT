import { builtInManifest } from '@fant/content';
import { mergeManifests, parseManifest, type Manifest } from '@fant/content-schema';
import { Directory, File, Paths } from 'expo-file-system';
import { create } from 'zustand';

import { APP_CONFIG } from '../../config';
import { reportError } from '../analytics/analytics';
import { fetchJson } from './fetch-json';

const CACHE_DIRECTORY = new Directory(Paths.document, 'content');
const CACHE = new File(CACHE_DIRECTORY, 'manifest.json');
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

/** The last downloaded manifest, if it is still valid; anything else is ignored. */
function readCachedManifest(): Manifest | null {
  try {
    return CACHE.exists ? parseManifest(JSON.parse(CACHE.textSync())) : null;
  } catch {
    return null;
  }
}

interface ContentState {
  /** Built-in content plus the last valid download (CNT-01/05). */
  readonly manifest: Manifest;
  /** Downloads the latest manifest; keeps the current one when offline or invalid. */
  readonly refresh: () => Promise<void>;
}

export const useContent = create<ContentState>()((set) => ({
  manifest: mergeManifests(builtInManifest(), readCachedManifest()),
  refresh: async () => {
    const { contentBaseUrl } = APP_CONFIG;
    if (contentBaseUrl === null) return;
    try {
      const remote = parseManifest(
        await fetchJson(`${contentBaseUrl}/manifest.json`, {
          timeoutMs: TIMEOUT_MS,
          maxBytes: MAX_MANIFEST_BYTES,
        }),
      );
      CACHE_DIRECTORY.create({ intermediates: true, idempotent: true });
      CACHE.writeSync(JSON.stringify(remote));
      set({ manifest: mergeManifests(builtInManifest(), remote) });
    } catch (error) {
      // Offline or a bad delivery: the built-in and cached content keep working (03 §4).
      reportError(error, 'content.refresh');
    }
  },
}));
