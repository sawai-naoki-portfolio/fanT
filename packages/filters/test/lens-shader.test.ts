import { describe, expect, it } from 'vitest';

import {
  compileRuntimeEffect,
  DEFAULT_LENS_PARAMS,
  LENS_SHADER_NAME,
  LENS_SHADER_SOURCE,
  toLensUniforms,
  type LensParams,
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
const effect = compileRuntimeEffect(ck.RuntimeEffect, LENS_SHADER_NAME, LENS_SHADER_SOURCE);
const SIZE = 64;
const FLAT = createBitmap(SIZE, SIZE, () => [120, 120, 120, 255]);
/** Vertical stripes, so a radial warp shows as moved stripes. */
const STRIPES = createBitmap(SIZE, SIZE, (x) =>
  Math.floor(x / 4) % 2 === 0 ? [0, 0, 0, 255] : [255, 255, 255, 255],
);
/** Grey with salt-and-pepper speckles. */
const NOISY = createBitmap(SIZE, SIZE, (x, y) => {
  const n = ((x * 7 + y * 13) % 5) - 2;
  return [120 + n * 12, 120 - n * 12, 120 + n * 6, 255];
});

const render = (input: ReturnType<typeof createBitmap>, params: Partial<LensParams>) =>
  renderEffect(
    ck,
    effect,
    toLensUniforms({ ...DEFAULT_LENS_PARAMS, ...params }, { width: SIZE, height: SIZE }),
    input,
  );

/** How far the channels of neighbouring pixels differ, summed over the image. */
function roughness(bitmap: ReturnType<typeof createBitmap>) {
  let total = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 1; x < SIZE; x++) {
      const a = pixelAt(bitmap, x, y);
      const b = pixelAt(bitmap, x - 1, y);
      total += Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    }
  }
  return total;
}

describe(`${LENS_SHADER_NAME} shader`, () => {
  it('declares exactly the uniforms produced by toLensUniforms', () => {
    const uniforms = toLensUniforms(DEFAULT_LENS_PARAMS, { width: 1, height: 1 });
    expect(uniformNames(effect).sort()).toEqual(Object.keys(uniforms).sort());
  });

  it('leaves the photo unchanged at the defaults', () => {
    expect(maxChannelDifference(render(STRIPES, {}), STRIPES)).toBeLessThanOrEqual(1);
  });

  it('moves stripes near the edges when correcting distortion, and keeps the centre', () => {
    const corrected = render(STRIPES, { distortion: 1 });
    expect(maxChannelDifference(corrected, STRIPES)).toBeGreaterThan(100);
    expect(pixelAt(corrected, 32, 32)).toEqual(pixelAt(STRIPES, 32, 32));
  });

  it('brightens or darkens the corners and leaves the centre', () => {
    const lifted = render(FLAT, { vignette: 1 });
    expect(pixelAt(lifted, 0, 0)[0]).toBeGreaterThan(150);
    expect(pixelAt(lifted, 32, 32)[0]).toBe(120);
    expect(pixelAt(render(FLAT, { vignette: -1 }), 0, 0)[0]).toBeLessThan(90);
  });

  it('smooths noise', () => {
    expect(roughness(render(NOISY, { noise: 1, colorNoise: 1 }))).toBeLessThan(
      roughness(NOISY) * 0.6,
    );
  });
});
