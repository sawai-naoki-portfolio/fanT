import { builtInManifest } from '@fant/content';
import { Directory, File, Paths } from 'expo-file-system';
import { afterEach, describe, expect, it, vi } from 'vitest';

const reportError = vi.hoisted(() => vi.fn());
vi.mock('../analytics/analytics', () => ({ reportError }));

const CACHE = new File(Paths.document, 'content', 'manifest.json');
/** A delivered manifest that differs from the built-in one in its config. */
const REMOTE = { ...builtInManifest(), config: { features: { ai: false } } };

/** A fresh store: the cached manifest is read when the module loads. */
async function load() {
  vi.resetModules();
  return (await import('./content-store')).useContent;
}

function serveManifest(body: unknown, init: ResponseInit = {}) {
  vi.stubGlobal('fetch', (url: string) => {
    expect(url).toBe('https://content.example.com/manifest.json');
    return Promise.resolve(Response.json(body, init));
  });
}

describe('content-store', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    reportError.mockClear();
  });

  it('starts with the built-in content', async () => {
    const useContent = await load();

    expect(useContent.getState().manifest).toEqual(builtInManifest());
  });

  it('uses a delivered manifest and keeps it for the next launch', async () => {
    const useContent = await load();
    serveManifest(REMOTE);

    await useContent.getState().refresh();

    expect(useContent.getState().manifest.config).toEqual(REMOTE.config);
    expect((await load()).getState().manifest.config).toEqual(REMOTE.config);
  });

  it('keeps the current content when the delivery is invalid', async () => {
    const useContent = await load();
    serveManifest({ schemaVersion: 1, films: 'not a list' });

    await useContent.getState().refresh();

    expect(useContent.getState().manifest).toEqual(builtInManifest());
    expect(CACHE.exists).toBe(false);
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), 'content.refresh');
  });

  it('keeps the current content when the server fails or is unreachable', async () => {
    const useContent = await load();
    serveManifest({}, { status: 503 });
    await useContent.getState().refresh();
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Network request failed')));
    await useContent.getState().refresh();

    expect(useContent.getState().manifest).toEqual(builtInManifest());
    expect(reportError).toHaveBeenCalledTimes(2);
  });

  it('ignores a cached manifest that is no longer valid', async () => {
    new Directory(Paths.document, 'content').create();
    CACHE.writeSync('{"schemaVersion": 99}');

    expect((await load()).getState().manifest).toEqual(builtInManifest());
  });
});
