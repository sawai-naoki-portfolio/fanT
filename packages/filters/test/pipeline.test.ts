import type { Shader } from 'canvaskit-wasm';
import { describe, expect, it } from 'vitest';

import {
  chainFilters,
  compileFilterEffects,
  DEFAULT_ADJUST_PARAMS,
  DEFAULT_BODY_PARAMS,
  DEFAULT_DETAIL_PARAMS,
  DEFAULT_FACE_SHAPE_PARAMS,
  DEFAULT_LENS_PARAMS,
  DEFAULT_LIGHT_PARAMS,
  IDENTITY_LUT,
  normalizeBeautyParams,
  normalizeFilmParams,
  toDateStampGlyphs,
  type FilterFrame,
  type FilterSettings,
} from '../src';
import {
  createBitmap,
  loadCanvasKit,
  lutBitmap,
  maxChannelDifference,
  renderWith,
} from './canvaskit';

const ck = await loadCanvasKit();
const effects = compileFilterEffects(ck.RuntimeEffect);
const INPUT = createBitmap(32, 32, (x, y) => [x * 8, y * 8, 120, 255]);

const NEUTRAL: FilterSettings = {
  lens: DEFAULT_LENS_PARAMS,
  faceShape: DEFAULT_FACE_SHAPE_PARAMS,
  body: DEFAULT_BODY_PARAMS,
  adjust: DEFAULT_ADJUST_PARAMS,
  beauty: normalizeBeautyParams({ smoothing: 0, brightness: 0, rosiness: 0 }),
  detail: DEFAULT_DETAIL_PARAMS,
  local: [],
  light: DEFAULT_LIGHT_PARAMS,
  film: normalizeFilmParams({ warmth: 0, fade: 0, vignette: 0, grain: 0 }),
  dateStamp: toDateStampGlyphs(null),
};

function render(settings: FilterSettings, faces: FilterFrame['faces'] = []) {
  let created = 0;
  const output = renderWith(
    ck,
    INPUT,
    ([source, lut], track) => {
      if (source === undefined || lut === undefined) throw new Error('missing children');
      const chain = chainFilters(
        effects,
        settings,
        { width: 32, height: 32, seed: 0.3, faces },
        source,
        {
          shader: lut,
          size: IDENTITY_LUT.size,
        },
      );
      created = chain.created.length;
      chain.created.forEach((shader: Shader) => track(shader));
      return chain.shader;
    },
    [lutBitmap(IDENTITY_LUT)],
  );
  return { output, created };
}

describe('chainFilters', () => {
  it('compiles every shader of the chain', () => {
    expect(Object.keys(effects).sort()).toEqual([
      'adjust',
      'beauty',
      'body',
      'dateStamp',
      'detail',
      'faceShape',
      'film',
      'lens',
      'light',
    ]);
  });

  it('only runs the film stage when everything else is neutral', () => {
    const { output, created } = render(NEUTRAL);
    expect(created).toBe(1);
    expect(maxChannelDifference(output, INPUT)).toBeLessThanOrEqual(1);
  });

  it('adds a stage for each non-neutral setting', () => {
    const { created } = render({
      ...NEUTRAL,
      adjust: { ...DEFAULT_ADJUST_PARAMS, brightness: 0.2 },
      beauty: normalizeBeautyParams(),
      dateStamp: toDateStampGlyphs({
        date: { year: 2026, month: 1, day: 2 },
        format: 'yy mm dd',
        color: [1, 0.5, 0],
      }),
    });
    expect(created).toBe(4);
  });

  it('reshapes faces only when there are faces to reshape', () => {
    const shaped = { ...NEUTRAL, faceShape: { ...DEFAULT_FACE_SHAPE_PARAMS, eyes: 1 } };
    expect(render(shaped).created).toBe(1);
    const face = { leftEye: [10, 12], rightEye: [22, 12], center: [16, 16], width: 24 } as const;
    expect(render(shaped, [face]).created).toBe(2);
  });
});
