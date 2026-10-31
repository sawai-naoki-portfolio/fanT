import { describe, expect, it } from 'vitest';

import {
  BODY_SHADER_NAME,
  BODY_SHADER_SOURCE,
  compileRuntimeEffect,
  DEFAULT_BODY_PARAMS,
  toBodyUniforms,
  type BodyParams,
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
const effect = compileRuntimeEffect(ck.RuntimeEffect, BODY_SHADER_NAME, BODY_SHADER_SOURCE);

const SIZE = 100;
/** Red follows the row, green the column: movement shows up as a changed colour. */
const GRID = createBitmap(SIZE, SIZE, (x, y) => [y * 2, x * 2, 0, 255]);

function render(params: Partial<BodyParams>) {
  const uniforms = toBodyUniforms(
    { ...DEFAULT_BODY_PARAMS, ...params },
    { width: SIZE, height: SIZE },
  );
  return renderEffect(ck, effect, uniforms, GRID);
}

describe(`${BODY_SHADER_NAME} shader`, () => {
  it('declares exactly the uniforms produced by toBodyUniforms', () => {
    const uniforms = toBodyUniforms(DEFAULT_BODY_PARAMS, { width: 1, height: 1 });
    expect(uniformNames(effect).sort()).toEqual(Object.keys(uniforms).sort());
  });

  it('changes nothing with no reshaping', () => {
    expect(maxChannelDifference(render({ legLine: 0.3, bodyX: 0.2 }), GRID)).toBe(0);
  });

  it('stretches only below the leg line', () => {
    const output = render({ legs: 1, legLine: 0.5 });
    expect(pixelAt(output, 50, 30)).toEqual(pixelAt(GRID, 50, 30));
    // Sampled closer to the line: a smaller row.
    expect(pixelAt(output, 50, 95)[0]).toBeLessThan(pixelAt(GRID, 50, 95)[0]);
  });

  it('narrows around the middle, not at the edges', () => {
    const output = render({ slim: 1, bodyX: 0.5 });
    // Left of the middle, sampled farther left: a smaller column.
    expect(pixelAt(output, 35, 50)[1]).toBeLessThan(pixelAt(GRID, 35, 50)[1]);
    expect(pixelAt(output, 0, 50)).toEqual(pixelAt(GRID, 0, 50));
  });
});
