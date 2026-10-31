import { describe, expect, it } from 'vitest';

import {
  BEAUTY_LEVELS,
  BEAUTY_SHADER_NAME,
  BEAUTY_SHADER_SOURCE,
  compileRuntimeEffect,
  toBeautyUniforms,
  type BeautyParams,
} from '../src';
import {
  createBitmap,
  loadCanvasKit,
  maxChannelDifference,
  pixelAt,
  renderEffect,
  uniformNames,
  type Bitmap,
} from './canvaskit';

const ck = await loadCanvasKit();
const effect = compileRuntimeEffect(ck.RuntimeEffect, BEAUTY_SHADER_NAME, BEAUTY_SHADER_SOURCE);

const SIZE = 32;
type Rgb = readonly [number, number, number];

/** Light, medium and deep skin tones: retouching must treat all of them as skin. */
const SKIN_TONES = {
  light: [236, 188, 160],
  medium: [198, 134, 98],
  deep: [120, 72, 44],
} as const satisfies Record<string, Rgb>;
const NON_SKIN = {
  blue: [40, 90, 200],
  green: [60, 160, 70],
  gray: [128, 128, 128],
} as const satisfies Record<string, Rgb>;
const SMOOTH_ONLY: BeautyParams = { smoothing: 1, brightness: 0, rosiness: 0 };

/** Deterministic per-pixel noise of ±amplitude around a base colour. */
function noisy([r, g, b]: Rgb, amplitude: number): Bitmap {
  let state = 12345;
  const next = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return (state / 2147483648) * 2 - 1;
  };
  return createBitmap(SIZE, SIZE, () => {
    const n = next() * amplitude;
    return [r + n, g + n, b + n, 255];
  });
}

const opaque = ([r, g, b]: Rgb) => [r, g, b, 255] as const;

function solid(rgb: Rgb): Bitmap {
  return createBitmap(SIZE, SIZE, () => opaque(rgb));
}

function render(params: BeautyParams, input: Bitmap, resolution = 1000): Bitmap {
  const uniforms = {
    ...toBeautyUniforms(params, { width: input.width, height: input.height }),
    // A frame large enough that the blur radius spans several pixels of the test image.
    resolution: [resolution, resolution],
  };
  return renderEffect(ck, effect, uniforms, input);
}

/** Standard deviation of the green channel over the image interior. */
function roughness(bitmap: Bitmap): number {
  const values: number[] = [];
  for (let y = 4; y < SIZE - 4; y++) {
    for (let x = 4; x < SIZE - 4; x++) values.push(pixelAt(bitmap, x, y)[1]);
  }
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
}

describe(`${BEAUTY_SHADER_NAME} shader`, () => {
  it('declares exactly the uniforms produced by toBeautyUniforms', () => {
    const uniforms = toBeautyUniforms(BEAUTY_LEVELS.medium, { width: 1, height: 1 });
    expect(uniformNames(effect).sort()).toEqual(Object.keys(uniforms).sort());
  });

  it('leaves the image untouched when switched off', () => {
    const input = noisy(SKIN_TONES.medium, 20);
    expect(maxChannelDifference(render(BEAUTY_LEVELS.off, input), input)).toBeLessThanOrEqual(1);
  });

  it.each(Object.entries(NON_SKIN))('does not touch non-skin colours (%s)', (_, rgb) => {
    const input = noisy(rgb, 20);
    const strongest = { smoothing: 1, brightness: 1, rosiness: 1 };
    expect(maxChannelDifference(render(strongest, input), input)).toBeLessThanOrEqual(1);
  });

  it.each(Object.entries(SKIN_TONES))('smooths %s skin', (_, rgb) => {
    const input = noisy(rgb, 20);
    expect(roughness(render(SMOOTH_ONLY, input))).toBeLessThan(roughness(input) * 0.6);
  });

  it('keeps edges between light and dark areas sharp', () => {
    const { light, deep } = SKIN_TONES;
    const input = createBitmap(SIZE, SIZE, (x) => opaque(x < SIZE / 2 ? light : deep));
    const output = render(SMOOTH_ONLY, input);
    const y = SIZE / 2;
    expect(pixelAt(output, SIZE / 2 - 1, y)).toEqual(pixelAt(input, SIZE / 2 - 1, y));
    expect(pixelAt(output, SIZE / 2, y)).toEqual(pixelAt(input, SIZE / 2, y));
  });

  it('scales the smoothing radius with the frame size', () => {
    const input = noisy(SKIN_TONES.medium, 20);
    // In a small frame the radius is a fraction of a pixel, so far less noise is removed.
    expect(roughness(render(SMOOTH_ONLY, input, 50))).toBeGreaterThan(
      roughness(render(SMOOTH_ONLY, input, 1000)) * 1.5,
    );
  });

  it('brightens skin and adds rosiness', () => {
    const skin = solid(SKIN_TONES.medium);
    const [r0, g0, b0] = pixelAt(skin, 0, 0);
    const [r1, g1, b1] = pixelAt(render({ smoothing: 0, brightness: 1, rosiness: 0 }, skin), 0, 0);
    expect(r1 + g1 + b1).toBeGreaterThan(r0 + g0 + b0);
    const [r2, g2] = pixelAt(render({ smoothing: 0, brightness: 0, rosiness: 1 }, skin), 0, 0);
    expect(r2 - g2).toBeGreaterThan(r0 - g0);
  });
});
