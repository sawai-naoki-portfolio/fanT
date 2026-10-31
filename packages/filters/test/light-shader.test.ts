import { describe, expect, it } from 'vitest';

import {
  compileRuntimeEffect,
  DEFAULT_LIGHT_PARAMS,
  LIGHT_SHADER_NAME,
  LIGHT_SHADER_SOURCE,
  addsLight,
  toLightUniforms,
  type LightParams,
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
const effect = compileRuntimeEffect(ck.RuntimeEffect, LIGHT_SHADER_NAME, LIGHT_SHADER_SOURCE);
const SIZE = 64;
const DARK = createBitmap(SIZE, SIZE, () => [40, 50, 60, 255]);

const render = (params: Partial<LightParams>, seed = 0.3) =>
  renderEffect(
    ck,
    effect,
    toLightUniforms({ ...DEFAULT_LIGHT_PARAMS, ...params }, { width: SIZE, height: SIZE, seed }),
    DARK,
  );

const brightness = (bitmap: ReturnType<typeof createBitmap>, x: number, y: number) => {
  const [r, g, b] = pixelAt(bitmap, x, y);
  return r + g + b;
};

describe(`${LIGHT_SHADER_NAME} shader`, () => {
  it('declares exactly the uniforms produced by toLightUniforms', () => {
    const uniforms = toLightUniforms(DEFAULT_LIGHT_PARAMS, { width: 1, height: 1, seed: 0 });
    expect(uniformNames(effect).sort()).toEqual(Object.keys(uniforms).sort());
  });

  it('adds nothing at the defaults, wherever the source is', () => {
    expect(addsLight(DEFAULT_LIGHT_PARAMS)).toBe(false);
    expect(addsLight({ ...DEFAULT_LIGHT_PARAMS, sourceX: 0.1 })).toBe(false);
    expect(maxChannelDifference(render({}), DARK)).toBeLessThanOrEqual(1);
  });

  it('shines rays brightest near the source', () => {
    const lit = render({ rays: 1, sourceX: 0.2, sourceY: 0.2 });
    expect(brightness(lit, 13, 13)).toBeGreaterThan(brightness(lit, 60, 60));
    expect(brightness(lit, 13, 13)).toBeGreaterThan(brightness(DARK, 13, 13) + 100);
  });

  it('adds flare light on the line through the centre', () => {
    const flared = render({ flare: 1, sourceX: 0.1, sourceY: 0.1 });
    expect(maxChannelDifference(flared, DARK)).toBeGreaterThan(40);
  });

  it('veils a dark scene with mist, more towards the bottom', () => {
    const misty = render({ fog: 1 });
    expect(brightness(misty, 32, 60)).toBeGreaterThan(brightness(misty, 32, 2));
    expect(brightness(misty, 32, 2)).toBeGreaterThan(brightness(DARK, 32, 2));
  });

  it('draws rain and snow the same way for the same seed, differently for another', () => {
    for (const weather of [{ rain: 1 }, { snow: 1 }]) {
      const once = render(weather, 0.3);
      expect(maxChannelDifference(once, DARK)).toBeGreaterThan(60);
      expect(maxChannelDifference(once, render(weather, 0.3))).toBe(0);
      expect(maxChannelDifference(once, render(weather, 0.8))).toBeGreaterThan(0);
    }
  });
});
