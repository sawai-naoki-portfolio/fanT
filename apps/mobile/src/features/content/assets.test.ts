import { File, Paths } from 'expo-file-system';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setDownloadHandler } from '../../../test/controls';
import { APP_CONFIG } from '../../config';
import { resolveAsset } from './assets';

vi.mock('@fant/content/bundled-assets', () => ({ BUNDLED_ASSETS: { 'luts/bundled.png': 7 } }));
vi.mock('expo-asset', () => ({
  Asset: {
    fromModule: (module: number) => ({
      downloadAsync: () => Promise.resolve({ localUri: `file:///bundle/${String(module)}.png` }),
    }),
  },
}));

const BYTES = new Uint8Array([1, 2, 3, 4]);
const SHA256 = '9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a';
const REF = { path: 'stamps/heart.png', sha256: SHA256 };

function cached(name: string): File {
  return new File(Paths.cache, 'content-assets', name);
}

describe('resolveAsset', () => {
  afterEach(() => {
    Object.assign(APP_CONFIG, { contentBaseUrl: 'https://content.example.com' });
  });

  it('uses the bundled copy of a built-in asset', async () => {
    await expect(resolveAsset({ path: 'luts/bundled.png', sha256: 'x' })).resolves.toBe(
      'file:///bundle/7.png',
    );
  });

  it('downloads an asset once and keeps it under its hash', async () => {
    const urls: string[] = [];
    setDownloadHandler((url) => {
      urls.push(url);
      return Promise.resolve(BYTES);
    });

    const [first, second] = await Promise.all([resolveAsset(REF), resolveAsset(REF)]);
    const later = await resolveAsset(REF);

    expect(urls).toEqual(['https://content.example.com/stamps/heart.png']);
    expect(first).toBe(cached(`${SHA256}.png`).uri);
    expect(second).toBe(first);
    expect(later).toBe(first);
    expect(new File(first).bytesSync()).toEqual(BYTES);
  });

  it('throws away a download whose hash does not match', async () => {
    setDownloadHandler(() => Promise.resolve(new Uint8Array([6, 6, 6])));

    await expect(resolveAsset(REF)).rejects.toThrow('Hash mismatch');

    expect(cached(`${SHA256}.png`).exists).toBe(false);
    expect(cached(`${SHA256}.partial`).exists).toBe(false);
  });

  it('tries again after a failed download', async () => {
    setDownloadHandler(() => Promise.reject(new Error('offline')));
    await expect(resolveAsset(REF)).rejects.toThrow('Download failed');

    setDownloadHandler(() => Promise.resolve(BYTES));
    await expect(resolveAsset(REF)).resolves.toBe(cached(`${SHA256}.png`).uri);
  });

  it('gives up on an oversized asset', async () => {
    setDownloadHandler(() => Promise.resolve(new Uint8Array(4 * 1024 * 1024 + 1)));

    await expect(resolveAsset(REF)).rejects.toThrow('Download failed');
    expect(cached(`${SHA256}.partial`).exists).toBe(false);
  });

  it('has nothing to download without a content server', async () => {
    Object.assign(APP_CONFIG, { contentBaseUrl: null });

    await expect(resolveAsset(REF)).rejects.toThrow('No content server');
  });
});
