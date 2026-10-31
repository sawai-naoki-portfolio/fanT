/**
 * The caller's network address for per-address limits. Google's front end appends
 * the connecting address to `X-Forwarded-For`, so only the last entry is trusted:
 * earlier ones (and Express's `request.ip`, the first) can be set by the caller.
 */
export function clientAddress(
  forwardedFor: string | undefined,
  fallback: string | undefined,
): string {
  const last = forwardedFor?.split(',').at(-1)?.trim();
  return last !== undefined && last !== '' ? last : (fallback ?? 'unknown');
}
