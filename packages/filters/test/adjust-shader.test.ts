import { describe, expect, it } from 'vitest';

import {
  ADJUST_SHADER_NAME,
  ADJUST_SHADER_SOURCE,
  compileRuntimeEffect,
  DEFAULT_ADJUST_PARAMS,
  type AdjustParams,
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
const effect = compileRuntimeEffect(ck.RuntimeEffect, ADJUST_SHADER_NAME, ADJUST_SHADER_SOURCE);
const INPUT = createBitmap(16, 16, (x, y) => [x * 16, y * 16, 100, 255]);

const render = (params: Partial<AdjustParams>) =>
  renderEffect(ck, effect, { ...DEFAULT_ADJUST_PARAMS, ...params }, INPUT);

describe(`${ADJUST_SHADER_NAME} shader`, () => {
  it('declares exactly the adjust parameters', () => {
    expect(uniformNames(effect).sort()).toEqual(Object.keys(DEFAULT_ADJUST_PARAMS).sort());
  });

  it('is the identity at the defaults', () => {
    expect(maxChannelDifference(render({}), INPUT)).toBeLessThanOrEqual(1);
  });

  it('brightens and darkens', () => {
    const [r0] = pixelAt(INPUT, 8, 8);
    expect(pixelAt(render({ brightness: 0.5 }), 8, 8)[0]).toBeGreaterThan(r0);
    expect(pixelAt(render({ brightness: -0.5 }), 8, 8)[0]).toBeLessThan(r0);
  });

  it('warms with a positive temperature', () => {
    const [r, , b] = pixelAt(render({ temperature: 1 }), 8, 8);
    const [r0, , b0] = pixelAt(INPUT, 8, 8);
    expect(r).toBeGreaterThan(r0);
    expect(b).toBeLessThan(b0);
  });

  it('shifts the tint towards magenta or green', () => {
    const [r, g] = pixelAt(INPUT, 8, 8);
    const magenta = pixelAt(render({ tint: 1 }), 8, 8);
    const green = pixelAt(render({ tint: -1 }), 8, 8);
    expect(magenta[1]).toBeLessThan(g);
    expect(green[1]).toBeGreaterThan(g);
    expect(magenta[0]).toBeGreaterThanOrEqual(r);
  });
});
