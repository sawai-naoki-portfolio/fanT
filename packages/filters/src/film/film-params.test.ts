import { describe, expect, it } from 'vitest';

import {
  colorOnlyFilmParams,
  DEFAULT_FILM_PARAMS,
  FILM_PARAM_RANGES,
  normalizeFilmParams,
} from './film-params';

describe('normalizeFilmParams', () => {
  it('returns the defaults when nothing is given', () => {
    expect(normalizeFilmParams()).toEqual(DEFAULT_FILM_PARAMS);
  });

  it('keeps in-range values', () => {
    expect(normalizeFilmParams({ intensity: 0.5, warmth: -0.3 })).toMatchObject({
      intensity: 0.5,
      warmth: -0.3,
    });
  });

  it('clamps out-of-range values to the nearest bound', () => {
    const params = normalizeFilmParams({ intensity: 2, warmth: -5, grain: -0.1 });
    expect(params.intensity).toBe(FILM_PARAM_RANGES.intensity.max);
    expect(params.warmth).toBe(FILM_PARAM_RANGES.warmth.min);
    expect(params.grain).toBe(FILM_PARAM_RANGES.grain.min);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, '0.5', null, undefined, {}])(
    'falls back to the default for %p',
    (value) => {
      expect(normalizeFilmParams({ fade: value }).fade).toBe(FILM_PARAM_RANGES.fade.defaultValue);
    },
  );

  it('drops unknown keys', () => {
    const input = { vignette: 0.4, unexpected: 1 } as Parameters<typeof normalizeFilmParams>[0];
    expect(Object.keys(normalizeFilmParams(input)).sort()).toEqual(
      Object.keys(FILM_PARAM_RANGES).sort(),
    );
  });

  it('returns an immutable object', () => {
    expect(Object.isFrozen(normalizeFilmParams())).toBe(true);
    expect(Object.isFrozen(DEFAULT_FILM_PARAMS)).toBe(true);
  });
});

describe('colorOnlyFilmParams', () => {
  it('keeps the colour and turns off effects that depend on position (CAM-13)', () => {
    const params = colorOnlyFilmParams(
      normalizeFilmParams({ warmth: 0.4, lutIntensity: 1, grain: 0.5, vignette: 0.6, bloom: 0.3 }),
    );
    expect(params).toMatchObject({ warmth: 0.4, lutIntensity: 1, grain: 0, vignette: 0, bloom: 0 });
    expect(params.lowRes).toBe(0);
    expect(params.lightLeak).toBe(0);
  });
});
