import { z } from 'zod';

/** `fetch`, injectable for tests. */
export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** An OAuth access token for Google Cloud APIs. */
export type TokenSource = (signal: AbortSignal) => Promise<string>;

const METADATA_TOKEN_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
const tokenSchema = z.object({ access_token: z.string().min(1), expires_in: z.number() });

/**
 * The function's own service account token from the metadata server, cached until
 * shortly before it expires. No key file or secret is involved.
 */
export function metadataTokenSource(fetchFn: Fetch = fetch): TokenSource {
  let cached: { token: string; until: number } | null = null;
  return async (signal) => {
    if (cached !== null && Date.now() < cached.until) return cached.token;
    const response = await fetchFn(METADATA_TOKEN_URL, {
      headers: { 'Metadata-Flavor': 'Google' },
      signal,
    });
    if (!response.ok) throw new Error(`Metadata token: HTTP ${String(response.status)}`);
    const { access_token: token, expires_in: expiresIn } = tokenSchema.parse(await response.json());
    cached = { token, until: Date.now() + (expiresIn - 60) * 1000 };
    return token;
  };
}

export async function postJson(
  fetchFn: Fetch,
  token: TokenSource,
  url: string,
  body: unknown,
  signal: AbortSignal,
): Promise<unknown> {
  const response = await fetchFn(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await token(signal)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  });
  // Error bodies may echo the request; only the status is reported.
  if (!response.ok) throw new Error(`${new URL(url).host}: HTTP ${String(response.status)}`);
  return response.json();
}
