import { describe, expect, it } from 'vitest';

import { coverPlacement, framedPhotoRect } from './frames';

const SIZE = { width: 1000, height: 1500 };

describe('framedPhotoRect', () => {
  it('uses the whole output without a frame or with the digicam read-out', () => {
    expect(framedPhotoRect(null, SIZE)).toEqual({ x: 0, y: 0, width: 1000, height: 1500 });
    expect(framedPhotoRect({ type: 'digicam', color: '#ffffff' }, SIZE)).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 1500,
    });
  });

  it('leaves a wider bottom border for an instant print', () => {
    expect(framedPhotoRect({ type: 'polaroid', color: '#ffffff' }, SIZE)).toEqual({
      x: 50,
      y: 50,
      width: 900,
      height: 1250,
    });
  });
});

describe('coverPlacement', () => {
  it('fills the rect with a uniform scale, centred', () => {
    const placement = coverPlacement(SIZE, { x: 50, y: 50, width: 900, height: 1250 });
    expect(placement.scale).toBeCloseTo(0.9);
    expect(placement.x).toBeCloseTo(50);
    expect(placement.y).toBeCloseTo(50 + (1250 - 1350) / 2);
  });
});
