import { File } from 'expo-file-system';

/** A download that took too long, was too large or failed; nothing is left behind. */
export class DownloadError extends Error {
  override readonly name = 'DownloadError';
}

/**
 * Downloads `url` to `target`, giving up after `timeoutMs` or past `maxBytes` so a
 * slow or oversized delivery cannot hang the app or fill the disk. On failure the
 * partial file is removed.
 */
export async function downloadFile(
  url: string,
  target: File,
  { timeoutMs, maxBytes }: { readonly timeoutMs: number; readonly maxBytes: number },
): Promise<void> {
  if (target.exists) target.delete();
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  try {
    await File.downloadFileAsync(url, target, {
      signal: controller.signal,
      onProgress: ({ bytesWritten }) => {
        if (bytesWritten > maxBytes) controller.abort();
      },
    });
  } catch (error) {
    if (target.exists) target.delete();
    throw new DownloadError(`Download failed: ${url}`, { cause: error });
  } finally {
    clearTimeout(timer);
  }
}
