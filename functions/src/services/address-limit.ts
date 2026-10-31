import { createHash } from 'node:crypto';

import { takeRate } from '../domain/rate-limit';
import type { Transaction } from '../ports';
import { ApiFailure } from './errors';

/**
 * Counts one action from a network address and rejects it past `limit` per
 * `windowMs`, inside the caller's transaction. Addresses are stored hashed.
 */
export async function takeAddressRate(
  tx: Transaction,
  scope: string,
  address: string,
  limit: { readonly count: number; readonly windowMs: number; readonly now: number },
): Promise<void> {
  const key = `${scope}:${createHash('sha256').update(address).digest('hex')}`;
  const window = takeRate(await tx.getRate(key), limit.now, limit.count, limit.windowMs);
  if (window === null) throw new ApiFailure('rate_limited', 'Too many requests from this network');
  tx.setRate(key, window);
}
