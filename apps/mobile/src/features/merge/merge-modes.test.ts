import { describe, expect, it } from 'vitest';

import { canMerge, isMergeMode } from './merge-modes';

describe('merge modes', () => {
  it('knows its modes and nothing else', () => {
    expect(isMergeMode('hdr')).toBe(true);
    expect(isMergeMode('panorama')).toBe(true);
    expect(isMergeMode('collage')).toBe(false);
    expect(isMergeMode(undefined)).toBe(false);
  });

  it('merges two or three exposures, and two to six pan shots', () => {
    expect([1, 2, 3, 4].map((count) => canMerge('hdr', count))).toEqual([false, true, true, false]);
    expect([1, 2, 6, 7].map((count) => canMerge('panorama', count))).toEqual([
      false,
      true,
      true,
      false,
    ]);
  });
});
