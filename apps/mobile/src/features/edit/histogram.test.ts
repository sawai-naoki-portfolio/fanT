import { describe, expect, it } from 'vitest';

import { lumaHistogram } from './histogram';

function pixels(values: readonly number[]) {
  return new Uint8Array(values.flatMap((value) => [value, value, value, 255]));
}

describe('lumaHistogram', () => {
  it('counts pixels into brightness bands, the fullest at 1', () => {
    const histogram = lumaHistogram(pixels([0, 0, 255, 128]), 4);
    expect(histogram).toEqual([1, 0, 0.5, 0.5]);
  });

  it('is empty for no pixels', () => {
    expect(lumaHistogram(new Uint8Array(), 4)).toEqual([0, 0, 0, 0]);
  });
});
