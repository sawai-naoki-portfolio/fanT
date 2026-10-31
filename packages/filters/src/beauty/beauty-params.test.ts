import { describe, expect, it } from 'vitest';

import { BEAUTY_LEVELS, DEFAULT_BEAUTY_PARAMS, normalizeBeautyParams } from './beauty-params';

describe('beauty parameters', () => {
  it.each(Object.entries(BEAUTY_LEVELS))('preset %s is already within range', (_, params) => {
    expect(normalizeBeautyParams(params)).toEqual(params);
  });

  it('presets grow stronger from off to high', () => {
    const { off, low, medium, high } = BEAUTY_LEVELS;
    expect([off, low, medium, high].map(({ smoothing }) => smoothing)).toEqual(
      [off, low, medium, high].map(({ smoothing }) => smoothing).sort((a, b) => a - b),
    );
  });

  it('defaults to the medium preset', () => {
    expect(BEAUTY_LEVELS.medium).toBe(DEFAULT_BEAUTY_PARAMS);
  });
});
