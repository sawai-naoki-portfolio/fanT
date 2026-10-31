import { describe, expect, it } from 'vitest';

import {
  compileRuntimeEffect,
  EXPOSURE_FUSION_SHADER_NAME,
  EXPOSURE_FUSION_SHADER_SOURCE,
  type ExposureFusionUniforms,
} from '../src';
import { createBitmap, loadCanvasKit, pixelAt, renderEffect, uniformNames } from './canvaskit';

const ck = await loadCanvasKit();
const effect = compileRuntimeEffect(
  ck.RuntimeEffect,
  EXPOSURE_FUSION_SHADER_NAME,
  EXPOSURE_FUSION_SHADER_SOURCE,
);
const SIZE = 32;

/**
 * One scene shot twice: the dark shot shows the bright sky (left), the bright shot
 * the dark ground (right), and each loses the other half to clipping.
 */
const DARK = createBitmap(SIZE, SIZE, (x) => (x < 16 ? [110, 140, 200, 255] : [5, 5, 5, 255]));
const BRIGHT = createBitmap(SIZE, SIZE, (x) =>
  x < 16 ? [255, 255, 255, 255] : [90, 140, 70, 255],
);

function fuse(children: ReturnType<typeof createBitmap>[], count: number) {
  const uniforms = { resolution: [SIZE, SIZE], count } satisfies ExposureFusionUniforms;
  const [first, ...rest] = children;
  if (first === undefined) throw new Error('no photo');
  return renderEffect(
    ck,
    effect,
    uniforms,
    first,
    [...rest, ...children].slice(0, 2).map((bitmap) => ({ bitmap })),
  );
}

describe(`${EXPOSURE_FUSION_SHADER_NAME} shader`, () => {
  it('declares its uniforms', () => {
    expect(uniformNames(effect).sort()).toEqual(['count', 'resolution']);
  });

  it('keeps the well-exposed part of each shot', () => {
    const fused = fuse([DARK, BRIGHT], 2);
    // The sky comes from the dark shot (not clipped white)…
    const [sr, , sb] = pixelAt(fused, 4, 16);
    expect(sb).toBeGreaterThan(sr + 30);
    expect(sr).toBeLessThan(200);
    // …and the ground from the bright shot (not black).
    expect(pixelAt(fused, 28, 16)[1]).toBeGreaterThan(100);
  });

  it('gives back a photo merged with itself unchanged', () => {
    const fused = fuse([BRIGHT, BRIGHT], 2);
    expect(pixelAt(fused, 28, 16)).toEqual(pixelAt(BRIGHT, 28, 16));
  });
});
