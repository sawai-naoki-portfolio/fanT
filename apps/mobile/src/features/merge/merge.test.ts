import { describe, expect, it } from 'vitest';

import { alignShift, commonArea } from './align';
import { halve, toGray, type Gray } from './gray';
import { panoramaLayout, panoramaOffset } from './panorama';

/** A wide scene with features at every scale (deterministic pseudo-random blobs). */
function scene(x: number, y: number): number {
  const v =
    Math.sin(x * 0.07) * Math.cos(y * 0.09) +
    0.6 * Math.sin(x * 0.23 + y * 0.11) +
    0.4 * Math.cos(x * 0.41 - y * 0.37);
  return 0.5 + v / 4.5;
}

/** A `width`×`height` view of the scene from `(left, top)`, at `exposure`. */
function view(width: number, height: number, left: number, top: number, exposure = 1): Gray {
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] = Math.min(1, scene(x + left, y + top) * exposure);
    }
  }
  return { width, height, data };
}

describe('gray', () => {
  it('turns RGBA into luma and halves it', () => {
    const gray = toGray({
      width: 2,
      height: 1,
      pixels: new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255]),
    });
    expect(Array.from(gray.data)).toEqual([1, 0]);
    expect(halve(view(8, 6, 0, 0)).width).toBe(4);
  });
});

describe('alignShift', () => {
  it('finds how far a second, darker shot moved', () => {
    const reference = view(160, 120, 20, 20);
    const moved = view(160, 120, 25, 17, 0.55);
    // The moved shot starts 5 across and 3 up the scene: drawn there, it lines up.
    expect(alignShift(reference, moved)).toEqual({ dx: 5, dy: -3 });
  });

  it('finds no shift between the same shot', () => {
    const shot = view(96, 64, 0, 0);
    expect(alignShift(shot, shot)).toEqual({ dx: 0, dy: 0 });
  });

  it('keeps only the part every shot covers', () => {
    expect(
      commonArea(100, 80, [
        { dx: 0, dy: 0 },
        { dx: 5, dy: -3 },
      ]),
    ).toEqual({
      x: 5,
      y: 0,
      width: 95,
      height: 77,
    });
  });
});

describe('panorama', () => {
  it('finds where the next shot of a pan starts', () => {
    const left = view(120, 90, 0, 0);
    // The next shot shows the scene from 70 across and 2 down, slightly brighter.
    const right = view(120, 90, 70, 2, 1.1);
    expect(panoramaOffset(left, right)).toEqual({ dx: 70, dy: 2 });
  });

  it('lays shots side by side, cropped to the height all of them cover', () => {
    const layout = panoramaLayout({ width: 100, height: 80 }, [
      { dx: 60, dy: 4 },
      { dx: 70, dy: -6 },
    ]);
    expect(layout.positions).toEqual([
      { dx: 0, dy: 0 },
      { dx: 60, dy: 4 },
      { dx: 130, dy: -2 },
    ]);
    expect(layout).toMatchObject({ width: 230, top: 4, height: 74 });
  });
});
