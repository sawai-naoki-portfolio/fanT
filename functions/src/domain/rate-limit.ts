export interface RateWindow {
  readonly start: number;
  readonly count: number;
}

/**
 * A fixed window counter (03 §5): at most `limit` actions per `windowMs`. Returns
 * the updated window, or `null` when the action is not allowed.
 */
export function takeRate(
  window: RateWindow | null,
  now: number,
  limit: number,
  windowMs: number,
): RateWindow | null {
  if (window === null || now - window.start >= windowMs) return { start: now, count: 1 };
  if (window.count >= limit) return null;
  return { start: window.start, count: window.count + 1 };
}
