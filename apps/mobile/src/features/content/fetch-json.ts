import { DownloadError } from '../../lib/download-file';
import { fetchWithTimeout } from '../../lib/fetch-with-timeout';

/**
 * Fetches JSON with a timeout and a size limit, so a slow or hostile server cannot
 * hang the app or exhaust its memory. The result is untrusted: validate it.
 */
export async function fetchJson(
  url: string,
  { timeoutMs, maxBytes, init }: { timeoutMs: number; maxBytes: number; init?: RequestInit },
): Promise<unknown> {
  const text = await fetchWithTimeout(url, init ?? {}, timeoutMs, async (response) => {
    if (!response.ok) throw new DownloadError(`HTTP ${String(response.status)} for ${url}`);
    const declared = Number(response.headers.get('content-length') ?? '0');
    if (declared > maxBytes) throw new DownloadError(`Response too large: ${url}`);
    return response.text();
  });
  // The declared length can be missing or wrong; the body itself is what counts.
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new DownloadError(`Response too large: ${url}`);
  }
  return JSON.parse(text) as unknown;
}
