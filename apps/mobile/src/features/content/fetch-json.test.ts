import { afterEach, describe, expect, it, vi } from 'vitest';

import { DownloadError } from '../../lib/download-file';
import { fetchJson } from './fetch-json';

const LIMITS = { timeoutMs: 1000, maxBytes: 20 };

describe('fetchJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses the response', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(Response.json({ ok: true })));

    await expect(fetchJson('https://example.com/a.json', LIMITS)).resolves.toEqual({ ok: true });
  });

  it('rejects an error status', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('{}', { status: 500 })));

    await expect(fetchJson('https://example.com/a.json', LIMITS)).rejects.toBeInstanceOf(
      DownloadError,
    );
  });

  it('rejects a response larger than the limit, declared or not', async () => {
    const large = JSON.stringify({ text: 'x'.repeat(30) });
    vi.stubGlobal('fetch', () =>
      Promise.resolve(new Response('{}', { headers: { 'Content-Length': '999' } })),
    );
    await expect(fetchJson('https://example.com/a.json', LIMITS)).rejects.toThrow('too large');

    vi.stubGlobal('fetch', () => Promise.resolve(new Response(large)));
    await expect(fetchJson('https://example.com/a.json', LIMITS)).rejects.toThrow('too large');
  });

  it('measures the body in bytes, not characters', async () => {
    // 9 characters (within the limit of 20), but 23 bytes in UTF-8.
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('"あいうえおかき"')));
    await expect(fetchJson('https://example.com/a.json', LIMITS)).rejects.toThrow('too large');
  });

  it('gives up on a server that does not answer', async () => {
    vi.stubGlobal(
      'fetch',
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );

    await expect(
      fetchJson('https://example.com/a.json', { timeoutMs: 10, maxBytes: 20 }),
    ).rejects.toThrow('Aborted');
  });
});
