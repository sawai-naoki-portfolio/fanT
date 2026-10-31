import { describe, expect, it } from 'vitest';

import {
  ASPECT_VALUES,
  centerCrop,
  containRect,
  croppedSize,
  fitLongEdge,
  rotatedSize,
  turnClockwise,
} from './geometry';

describe('centerCrop', () => {
  it('crops the sides of a wider image', () => {
    const crop = centerCrop({ width: 4000, height: 3000 }, 1);
    expect(crop.y).toBe(0);
    expect(crop.height).toBe(1);
    expect(crop.width).toBeCloseTo(0.75);
    expect(crop.x).toBeCloseTo(0.125);
  });

  it('crops the top and bottom of a taller image', () => {
    const crop = centerCrop({ width: 3000, height: 4000 }, ASPECT_VALUES['1:1']);
    expect(crop).toMatchObject({ x: 0, width: 1 });
    expect(crop.height).toBeCloseTo(0.75);
  });

  it('keeps an image that already has the ratio', () => {
    expect(centerCrop({ width: 3000, height: 4000 }, ASPECT_VALUES['3:4'])).toEqual({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });
  });
});

describe('sizes', () => {
  it('swaps the edges for quarter turns', () => {
    expect(rotatedSize({ width: 4, height: 3 }, 90)).toEqual({ width: 3, height: 4 });
    expect(rotatedSize({ width: 4, height: 3 }, 180)).toEqual({ width: 4, height: 3 });
  });

  it('computes the output of a rotated, cropped image', () => {
    expect(
      croppedSize({ width: 4000, height: 3000 }, 90, { x: 0, y: 0, width: 1, height: 0.5 }),
    ).toEqual({
      width: 3000,
      height: 2000,
    });
  });

  it('shrinks to the long edge limit without enlarging', () => {
    expect(fitLongEdge({ width: 3000, height: 4000 }, 2048)).toEqual({ width: 1536, height: 2048 });
    expect(fitLongEdge({ width: 300, height: 400 }, 2048)).toEqual({ width: 300, height: 400 });
  });

  it('centres content inside a container', () => {
    expect(containRect({ width: 100, height: 200 }, { width: 400, height: 400 })).toEqual({
      x: 100,
      y: 0,
      width: 200,
      height: 400,
    });
  });

  it('turns clockwise and wraps around', () => {
    expect(turnClockwise(270)).toBe(0);
    expect(turnClockwise(0)).toBe(90);
  });
});
