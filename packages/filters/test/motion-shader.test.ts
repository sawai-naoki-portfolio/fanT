import { describe, expect, it } from 'vitest';

import {
  compileRuntimeEffect,
  MOTION_SHADER_NAME,
  MOTION_SHADER_SOURCE,
  type MotionUniforms,
} from '../src';
import {
  createBitmap,
  loadCanvasKit,
  maxChannelDifference,
  pixelAt,
  renderEffect,
  uniformNames,
} from './canvaskit';

const ck = await loadCanvasKit();
const effect = compileRuntimeEffect(ck.RuntimeEffect, MOTION_SHADER_NAME, MOTION_SHADER_SOURCE);
const SIZE = 32;
/** Stripes that move visibly when shifted sideways. */
const STRIPES = createBitmap(SIZE, SIZE, (x) =>
  Math.floor(x / 4) % 2 === 0 ? [0, 0, 0, 255] : [255, 255, 255, 255],
);
/** The left half moves; the right half stays. */
const LEFT_HALF = createBitmap(SIZE, SIZE, (x) => (x < 16 ? [255, 255, 255, 255] : [0, 0, 0, 0]));

function frame(phase: number) {
  const uniforms = { resolution: [SIZE, SIZE], flow: [0.25, 0], phase } satisfies MotionUniforms;
  return renderEffect(ck, effect, uniforms, STRIPES, [{ bitmap: LEFT_HALF }]);
}

describe(`${MOTION_SHADER_NAME} shader`, () => {
  it('declares its uniforms', () => {
    expect(uniformNames(effect).sort()).toEqual(['flow', 'phase', 'resolution']);
  });

  it('moves only the masked area', () => {
    const halfway = frame(0.5);
    expect(maxChannelDifference(halfway, STRIPES)).toBeGreaterThan(50);
    for (let x = 16; x < SIZE; x++)
      expect(pixelAt(halfway, x, 10)).toEqual(pixelAt(STRIPES, x, 10));
  });

  it('loops: the frame just before the end matches the first', () => {
    // A shift of a whole stripe pair (8 px = 0.25 of 32) looks the same as none.
    expect(maxChannelDifference(frame(0), STRIPES)).toBeLessThanOrEqual(1);
    expect(maxChannelDifference(frame(0.999), frame(0))).toBeLessThanOrEqual(3);
  });
});
