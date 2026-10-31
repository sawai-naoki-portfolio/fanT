import { describe, expect, it } from 'vitest';

import { compileRuntimeEffect, HAIR_SHADER_NAME, HAIR_SHADER_SOURCE, toHairUniforms } from '../src';
import {
  createBitmap,
  loadCanvasKit,
  maxChannelDifference,
  pixelAt,
  renderEffect,
  uniformNames,
} from './canvaskit';

const ck = await loadCanvasKit();
const effect = compileRuntimeEffect(ck.RuntimeEffect, HAIR_SHADER_NAME, HAIR_SHADER_SOURCE);

const SIZE = 100;
const HEAD = { center: [50, 50] as const, width: 30 };
/** Dark brown "hair" everywhere, with a skin-coloured patch in the middle. */
const PHOTO = createBitmap(SIZE, SIZE, (x, y) =>
  Math.abs(x - 50) < 8 && Math.abs(y - 50) < 8 ? [220, 170, 140, 255] : [60, 40, 30, 255],
);
const PERSON = createBitmap(SIZE, SIZE, () => [255, 255, 255, 255]);
const NOBODY = createBitmap(SIZE, SIZE, () => [0, 0, 0, 0]);

function render(amount: number, mask = PERSON) {
  const uniforms = toHairUniforms(amount, [0.9, 0.2, 0.5], [HEAD], { width: SIZE, height: SIZE });
  return renderEffect(ck, effect, uniforms, PHOTO, [{ bitmap: mask }]);
}

describe(`${HAIR_SHADER_NAME} shader`, () => {
  it('declares exactly the uniforms produced by toHairUniforms', () => {
    const uniforms = toHairUniforms(0, [0, 0, 0], [], { width: 1, height: 1 });
    expect(uniformNames(effect).sort()).toEqual(Object.keys(uniforms).sort());
  });

  it('recolours hair above the head and leaves skin, the background and nobody alone', () => {
    const output = render(1);
    const [r, g] = pixelAt(output, 50, 30);
    expect(r).toBeGreaterThan(g + 20);
    expect(pixelAt(output, 50, 50)).toEqual(pixelAt(PHOTO, 50, 50));
    expect(pixelAt(output, 5, 95)).toEqual(pixelAt(PHOTO, 5, 95));
    expect(maxChannelDifference(render(1, NOBODY), PHOTO)).toBe(0);
  });
});
