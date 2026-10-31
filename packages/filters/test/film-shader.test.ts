import { describe, expect, it } from 'vitest';

import {
  compileRuntimeEffect,
  DEFAULT_FILM_PARAMS,
  FILM_SHADER_NAME,
  FILM_SHADER_SOURCE,
  IDENTITY_LUT,
  makeLut,
  normalizeFilmParams,
  toFilmUniforms,
  type FilmParams,
  type LutImage,
} from '../src';
import {
  createBitmap,
  loadCanvasKit,
  luminance,
  lutBitmap,
  maxChannelDifference,
  pixelAt,
  renderEffect,
  uniformNames,
  type Bitmap,
} from './canvaskit';

const ck = await loadCanvasKit();
const effect = compileRuntimeEffect(ck.RuntimeEffect, FILM_SHADER_NAME, FILM_SHADER_SOURCE);

const SIZE = 32;
const CENTER = SIZE / 2;
const GRAY = createBitmap(SIZE, SIZE, () => [128, 128, 128, 255]);
const GRADIENT = createBitmap(SIZE, SIZE, (x, y) => [x * 8, y * 8, 128, 255]);
const NO_EFFECTS = normalizeFilmParams({ warmth: 0, fade: 0, vignette: 0, grain: 0 });

interface RenderOptions {
  readonly input?: Bitmap;
  readonly seed?: number;
  readonly lut?: LutImage;
  /** Pretend the frame is this large (sizes in the shader are relative to it). */
  readonly resolution?: number;
}

function render(params: FilmParams, options: RenderOptions = {}): Bitmap {
  const { input = GRAY, seed = 0.5, lut = IDENTITY_LUT, resolution } = options;
  const uniforms = toFilmUniforms(params, {
    width: resolution ?? input.width,
    height: resolution ?? input.height,
    seed,
    lutSize: lut.size,
  });
  return renderEffect(ck, effect, uniforms, input, [lutBitmap(lut)]);
}

describe(`${FILM_SHADER_NAME} shader`, () => {
  it('declares exactly the uniforms produced by toFilmUniforms', () => {
    const uniforms = toFilmUniforms(DEFAULT_FILM_PARAMS, {
      width: 1,
      height: 1,
      seed: 0,
      lutSize: 2,
    });
    expect(uniformNames(effect).sort()).toEqual(Object.keys(uniforms).sort());
  });

  it('leaves the image untouched at zero intensity', () => {
    const everything = normalizeFilmParams({
      intensity: 0,
      bloom: 1,
      lightLeak: 1,
      sparkle: 1,
      chromaticAberration: 1,
      lowRes: 1,
      jpegNoise: 1,
      grain: 1,
    });
    expect(
      maxChannelDifference(render(everything, { input: GRADIENT }), GRADIENT),
    ).toBeLessThanOrEqual(1);
  });

  it('is the identity when every effect is disabled', () => {
    expect(
      maxChannelDifference(render(NO_EFFECTS, { input: GRADIENT }), GRADIENT),
    ).toBeLessThanOrEqual(1);
  });

  it('is the identity through an identity LUT of any size', () => {
    const params = { ...NO_EFFECTS, lutIntensity: 1 };
    const identity17 = makeLut(17, (r, g, b) => [r, g, b]);
    for (const lut of [IDENTITY_LUT, identity17]) {
      expect(
        maxChannelDifference(render(params, { input: GRADIENT, lut }), GRADIENT),
      ).toBeLessThanOrEqual(2);
    }
  });

  it('maps colours through the LUT in proportion to lutIntensity', () => {
    const inverted = makeLut(2, (r, g, b) => [1 - r, 1 - g, 1 - b]);
    const input = createBitmap(SIZE, SIZE, () => [200, 40, 100, 255]);
    const [r, g, b] = pixelAt(
      render({ ...NO_EFFECTS, lutIntensity: 1 }, { input, lut: inverted }),
      0,
      0,
    );
    for (const [actual, expected] of [
      [r, 55],
      [g, 215],
      [b, 155],
    ] as const) {
      expect(Math.abs(actual - expected)).toBeLessThanOrEqual(2);
    }
    const [half] = pixelAt(
      render({ ...NO_EFFECTS, lutIntensity: 0.5 }, { input, lut: inverted }),
      0,
      0,
    );
    expect(half).toBeCloseTo(128, -1);
  });

  it('warms the image when warmth is positive', () => {
    const [r, g, b] = pixelAt(render({ ...NO_EFFECTS, warmth: 1 }), CENTER, CENTER);
    expect(r).toBeGreaterThan(128);
    expect(g).toBeCloseTo(128, -1);
    expect(b).toBeLessThan(128);
  });

  it('desaturates towards gray and adds contrast around mid-gray', () => {
    const input = createBitmap(SIZE, SIZE, () => [200, 100, 100, 255]);
    const [r, g] = pixelAt(render({ ...NO_EFFECTS, saturation: -1 }, { input }), 0, 0);
    expect(Math.abs(r - g)).toBeLessThanOrEqual(1);
    const contrasted = render({ ...NO_EFFECTS, contrast: 1 }, { input: GRADIENT });
    expect(pixelAt(contrasted, 0, 0)[2]).toBeCloseTo(128, -1);
    expect(pixelAt(contrasted, 31, 0)[0]).toBeGreaterThan(pixelAt(GRADIENT, 31, 0)[0]);
  });

  it('darkens the corners but not the centre with vignette', () => {
    const output = render({ ...NO_EFFECTS, vignette: 1 });
    expect(luminance(output, CENTER, CENTER)).toBeCloseTo(128, -1);
    expect(luminance(output, 0, 0)).toBeLessThan(luminance(output, CENTER, CENTER) - 20);
  });

  it('scales grain with the frame so high-resolution photos match the preview', () => {
    // A frame whose short edge spans two grain cells per pixel (GRAIN_CELLS = 1080).
    const output = render({ ...NO_EFFECTS, grain: 1 }, { seed: 0.25, resolution: 2160 });
    for (const [x, y] of [
      [0, 0],
      [2, 0],
      [0, 2],
    ] as const) {
      const cell = pixelAt(output, x, y);
      expect(pixelAt(output, x + 1, y)).toEqual(cell);
      expect(pixelAt(output, x, y + 1)).toEqual(cell);
    }
  });

  it('renders the same grain for the same seed and different grain for another seed', () => {
    const grainy = { ...NO_EFFECTS, grain: 1 };
    const first = render(grainy, { seed: 0.25 });
    expect(maxChannelDifference(first, GRAY)).toBeGreaterThan(0);
    expect(maxChannelDifference(render(grainy, { seed: 0.25 }), first)).toBe(0);
    expect(maxChannelDifference(render(grainy, { seed: 0.75 }), first)).toBeGreaterThan(0);
  });

  it('adds a seed-dependent warm light leak', () => {
    const leaky = { ...NO_EFFECTS, lightLeak: 1 };
    const first = render(leaky, { seed: 0.1 });
    const total = (bitmap: Bitmap) => bitmap.pixels.reduce((sum, v) => sum + v, 0);
    expect(total(first)).toBeGreaterThan(total(GRAY));
    let redder = 0;
    for (let i = 0; i < first.pixels.length; i += 4) {
      if ((first.pixels[i] ?? 0) > (first.pixels[i + 2] ?? 0)) redder++;
    }
    expect(redder).toBeGreaterThan(0);
    expect(maxChannelDifference(render(leaky, { seed: 0.9 }), first)).toBeGreaterThan(0);
  });

  it('blooms around highlights only', () => {
    const spot = createBitmap(SIZE, SIZE, (x, y) =>
      Math.hypot(x - CENTER, y - CENTER) < 3 ? [255, 255, 255, 255] : [40, 40, 40, 255],
    );
    const output = render({ ...NO_EFFECTS, bloom: 1 }, { input: spot, resolution: 400 });
    expect(luminance(output, CENTER + 8, CENTER)).toBeGreaterThan(
      luminance(spot, CENTER + 8, CENTER),
    );
    expect(luminance(output, 0, 0)).toBeCloseTo(luminance(spot, 0, 0), 0);
    const dark = createBitmap(SIZE, SIZE, () => [40, 40, 40, 255]);
    expect(maxChannelDifference(render({ ...NO_EFFECTS, bloom: 1 }, { input: dark }), dark)).toBe(
      0,
    );
  });

  it('keeps a similar bloom at reduced quality', () => {
    const spot = createBitmap(SIZE, SIZE, (x, y) =>
      Math.hypot(x - CENTER, y - CENTER) < 3 ? [255, 255, 255, 255] : [40, 40, 40, 255],
    );
    const params = { ...NO_EFFECTS, bloom: 1 };
    const uniforms = (quality: number) =>
      toFilmUniforms(params, { width: 400, height: 400, seed: 0.5, lutSize: 2, quality });
    const full = renderEffect(ck, effect, uniforms(1), spot, [lutBitmap(IDENTITY_LUT)]);
    const reduced = renderEffect(ck, effect, uniforms(0), spot, [lutBitmap(IDENTITY_LUT)]);
    expect(maxChannelDifference(full, reduced)).toBeGreaterThan(0);
    // Overall glow stays about the same; only its sampling is coarser.
    const total = (bitmap: Bitmap) => bitmap.pixels.reduce((sum, value) => sum + value, 0);
    expect(total(reduced) / total(full)).toBeCloseTo(1, 1);
  });

  it('pixelates into blocks at low resolution', () => {
    // At lowRes 1 a 32px frame keeps its size, so pretend the frame is 3200px wide.
    const output = render({ ...NO_EFFECTS, lowRes: 1 }, { input: GRADIENT, resolution: 3200 });
    // 3200 / 320 = 10px blocks.
    expect(pixelAt(output, 1, 1)).toEqual(pixelAt(output, 8, 8));
    expect(pixelAt(output, 1, 1)).not.toEqual(pixelAt(output, 11, 1));
  });

  it('splits colour channels towards the edges with chromatic aberration', () => {
    const wide = createBitmap(256, 256, (x) => [x, x, x, 255]);
    const output = render({ ...NO_EFFECTS, chromaticAberration: 1 }, { input: wide });
    const [r, g, b] = pixelAt(output, 4, 2);
    expect(r).not.toBe(g);
    expect(b).not.toBe(g);
    expect(pixelAt(output, 128, 2)).toEqual(pixelAt(wide, 128, 2));
  });

  it('adds sparkle only over bright areas', () => {
    const dark = createBitmap(SIZE, SIZE, () => [30, 30, 30, 255]);
    expect(maxChannelDifference(render({ ...NO_EFFECTS, sparkle: 1 }, { input: dark }), dark)).toBe(
      0,
    );
    const white = createBitmap(SIZE, SIZE, () => [240, 240, 240, 255]);
    expect(
      maxChannelDifference(render({ ...NO_EFFECTS, sparkle: 1 }, { input: white }), white),
    ).toBeGreaterThan(0);
  });

  it('bands colours with JPEG noise', () => {
    const output = render({ ...NO_EFFECTS, jpegNoise: 1 }, { input: GRADIENT });
    const reds = new Set<number>();
    for (let x = 0; x < SIZE; x++) reds.add(pixelAt(output, x, CENTER)[0]);
    expect(reds.size).toBeLessThan(SIZE / 2);
  });
});
