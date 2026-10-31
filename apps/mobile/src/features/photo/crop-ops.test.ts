import { describe, expect, it } from 'vitest';

import { dragCorner, moveCrop } from './crop-ops';
import { FULL_CROP } from './recipe';

describe('crop ops', () => {
  it('drags one corner and keeps the opposite one', () => {
    const crop = dragCorner(FULL_CROP, 'topLeft', 0.2, 0.1);
    expect(crop.x).toBeCloseTo(0.2);
    expect(crop.y).toBeCloseTo(0.1);
    expect(crop.x + crop.width).toBeCloseTo(1);
    expect(crop.y + crop.height).toBeCloseTo(1);
    const other = dragCorner(FULL_CROP, 'bottomRight', -0.3, -0.4);
    expect(other).toMatchObject({ x: 0, y: 0 });
    expect(other.width).toBeCloseTo(0.7);
    expect(other.height).toBeCloseTo(0.6);
  });

  it('stays inside the photo and never collapses', () => {
    expect(dragCorner(FULL_CROP, 'topRight', 0.5, -0.5)).toMatchObject({ y: 0, width: 1 });
    const tiny = dragCorner(FULL_CROP, 'bottomLeft', 2, -2);
    expect(tiny.width).toBeCloseTo(0.1);
    expect(tiny.height).toBeCloseTo(0.1);
  });

  it('moves the crop without leaving the photo', () => {
    const half = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
    expect(moveCrop(half, 0.1, -0.1)).toEqual({ x: 0.35, y: 0.15, width: 0.5, height: 0.5 });
    expect(moveCrop(half, 1, 1)).toEqual({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 });
  });
});
