import { describe, expect, it } from 'vitest';

import { applyProjective } from './projective';
import { FULL_CROP, type PhotoRecipe } from './recipe';
import { recipeTransform, straightenZoom } from './transform';

const SIZE = { width: 400, height: 300 };

type Transform = PhotoRecipe['transform'];

function transformOf(patch: Partial<Transform> = {}): Transform {
  return {
    rotation: 0,
    mirror: false,
    straighten: 0,
    perspective: { vertical: 0, horizontal: 0 },
    crop: FULL_CROP,
    ...patch,
  };
}

function mapped(patch: Partial<Transform>, x: number, y: number) {
  const p = applyProjective(recipeTransform(SIZE, transformOf(patch)), { x, y });
  return [Math.round(p.x), Math.round(p.y)];
}

/**
 * Where the original's corners land. When none is inside the frame, the photo
 * covers the whole frame: no empty corner.
 */
function inverseCorners(patch: Partial<Transform>) {
  const m = recipeTransform(SIZE, transformOf(patch));
  return [
    [0, 0],
    [400, 0],
    [0, 300],
    [400, 300],
  ].map(([x = 0, y = 0]) => applyProjective(m, { x, y }));
}

describe('recipeTransform', () => {
  it('is the identity without a transform', () => {
    expect(mapped({}, 10, 20)).toEqual([10, 20]);
  });

  it('mirrors horizontally', () => {
    expect(mapped({ mirror: true }, 10, 20)).toEqual([390, 20]);
  });

  it('turns a quarter clockwise: the top-left corner goes to the top-right', () => {
    expect(mapped({ rotation: 90 }, 0, 0)).toEqual([300, 0]);
    expect(mapped({ rotation: 90 }, 400, 300)).toEqual([0, 400]);
  });

  it('turns half and three quarters', () => {
    expect(mapped({ rotation: 180 }, 0, 0)).toEqual([400, 300]);
    expect(mapped({ rotation: 270 }, 0, 0)).toEqual([0, 400]);
  });

  it('crops after turning', () => {
    const crop = { x: 0.5, y: 0.25, width: 0.5, height: 0.5 };
    // Rotated size is 300×400: the crop starts at (150, 100).
    expect(mapped({ rotation: 90, crop }, 0, 0)).toEqual([150, -100]);
  });

  it('straightens around the centre, zoomed in so no corner is left empty', () => {
    expect(mapped({ straighten: 10 }, 200, 150)).toEqual([200, 150]);
    // Every corner of the original lands outside the frame: the frame is all photo.
    for (const corner of inverseCorners({ straighten: 10 })) {
      const outside =
        corner.x <= 1e-6 || corner.x >= 400 - 1e-6 || corner.y <= 1e-6 || corner.y >= 300 - 1e-6;
      expect(outside).toBe(true);
    }
  });

  it('zooms just enough to straighten', () => {
    expect(straightenZoom(SIZE, 0)).toBe(1);
    expect(straightenZoom(SIZE, -10)).toBe(straightenZoom(SIZE, 10));
    expect(straightenZoom({ width: 300, height: 400 }, 10)).toBe(straightenZoom(SIZE, 10));
  });

  it('straightens after quarter turns and before the crop', () => {
    const crop = { x: 0.5, y: 0, width: 0.5, height: 1 };
    // The centre of the photo stays put; the crop then moves it to the left edge.
    expect(mapped({ rotation: 90, straighten: 5, crop }, 200, 150)).toEqual(
      mapped({ rotation: 90, crop }, 200, 150),
    );
    expect(mapped({ rotation: 90, straighten: 5, crop }, 200, 150)[0]).toBe(0);
  });

  it('widens the top to correct converging verticals, without empty corners', () => {
    const vertical = { perspective: { vertical: 1, horizontal: 0 } };
    // The bottom corners stay; the top corners are pushed out past the frame.
    expect(mapped(vertical, 0, 300)).toEqual([0, 300]);
    expect(mapped(vertical, 400, 300)).toEqual([400, 300]);
    const [topLeft, topRight] = inverseCorners(vertical);
    expect(topLeft?.x).toBeLessThan(0);
    expect(topRight?.x).toBeGreaterThan(400);
    // A point inset by the keystone at the top lands on the frame's corner.
    expect(mapped(vertical, 120, 0)).toEqual([0, 0]);
  });

  it('corrects the sides with horizontal perspective', () => {
    const horizontal = { perspective: { vertical: 0, horizontal: -1 } };
    expect(mapped(horizontal, 400, 0)).toEqual([400, 0]);
    expect(mapped(horizontal, 0, 90)).toEqual([0, 0]);
  });
});
