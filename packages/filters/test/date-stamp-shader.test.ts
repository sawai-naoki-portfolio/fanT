import { describe, expect, it } from 'vitest';

import {
  compileRuntimeEffect,
  DATE_STAMP_ORANGE,
  DATE_STAMP_SHADER_NAME,
  DATE_STAMP_SHADER_SOURCE,
  toDateStampGlyphs,
  toDateStampUniforms,
  type DateStamp,
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
const effect = compileRuntimeEffect(
  ck.RuntimeEffect,
  DATE_STAMP_SHADER_NAME,
  DATE_STAMP_SHADER_SOURCE,
);

const SIZE = 200;
const BLACK = createBitmap(SIZE, SIZE, () => [0, 0, 0, 255]);
const STAMP: DateStamp = {
  date: { year: 2026, month: 10, day: 24 },
  format: 'yy mm dd',
  color: DATE_STAMP_ORANGE,
};

function render(stamp: DateStamp | null) {
  const uniforms = toDateStampUniforms(toDateStampGlyphs(stamp), { width: SIZE, height: SIZE });
  return renderEffect(ck, effect, uniforms, BLACK);
}

describe(`${DATE_STAMP_SHADER_NAME} shader`, () => {
  it('declares exactly the uniforms produced by toDateStampUniforms', () => {
    const uniforms = toDateStampUniforms(toDateStampGlyphs(null), { width: 1, height: 1 });
    expect(uniformNames(effect).sort()).toEqual(Object.keys(uniforms).sort());
  });

  it('passes the image through without a stamp', () => {
    expect(maxChannelDifference(render(null), BLACK)).toBe(0);
  });

  it('draws orange glyphs in the bottom-right corner only', () => {
    const output = render(STAMP);
    let lit = 0;
    let litTopLeft = 0;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const [r, g, b] = pixelAt(output, x, y);
        if (r > 128) {
          lit++;
          expect(r).toBeGreaterThan(g);
          expect(g).toBeGreaterThan(b);
          if (x < SIZE / 2 || y < SIZE / 2) litTopLeft++;
        }
      }
    }
    expect(lit).toBeGreaterThan(20);
    expect(litTopLeft).toBe(0);
  });

  it('draws different digits differently', () => {
    const other = render({ ...STAMP, date: { year: 2027, month: 1, day: 1 } });
    expect(maxChannelDifference(other, render(STAMP))).toBeGreaterThan(100);
  });
});
