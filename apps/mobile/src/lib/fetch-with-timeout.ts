/**
 * `fetch` that gives up after `timeoutMs`, so a slow server cannot hang the app.
 * The timer also covers reading the body inside `read`.
 */
export async function fetchWithTimeout<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  read: (response: Response) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  try {
    return await read(await fetch(url, { ...init, signal: controller.signal }));
  } finally {
    clearTimeout(timer);
  }
}
