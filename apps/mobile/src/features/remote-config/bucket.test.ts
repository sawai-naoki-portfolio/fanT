import { describe, expect, it } from 'vitest';

import { bucketOf } from './bucket';

describe('bucketOf', () => {
  it('is stable for a key', () => {
    expect(bucketOf('install-1|paywall', 3)).toBe(bucketOf('install-1|paywall', 3));
  });

  it('spreads keys across every bucket', () => {
    const counts = new Map<number, number>();
    for (let i = 0; i < 3000; i++) {
      const bucket = bucketOf(`install-${String(i)}|paywall`, 3);
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([0, 1, 2]);
    for (const count of counts.values()) expect(count).toBeGreaterThan(800);
  });
});
