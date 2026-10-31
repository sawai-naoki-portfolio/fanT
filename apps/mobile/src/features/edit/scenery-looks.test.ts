import { ADJUST_PARAM_RANGES, DETAIL_PARAM_RANGES, LENS_PARAM_RANGES } from '@fant/filters';
import { describe, expect, it } from 'vitest';

import { neutralRecipe } from '../photo/recipe';
import { SCENERY_LOOKS, withSceneryLook, type SceneryLook } from './scenery-looks';

const RANGES = {
  adjust: ADJUST_PARAM_RANGES,
  detail: DETAIL_PARAM_RANGES,
  lens: LENS_PARAM_RANGES,
};

describe('scenery looks', () => {
  it('stay within every slider range', () => {
    for (const look of Object.values(SCENERY_LOOKS)) {
      for (const [group, values] of Object.entries(look)) {
        const ranges = RANGES[group as keyof typeof RANGES] as Record<
          string,
          { min: number; max: number }
        >;
        for (const [name, value] of Object.entries(values as Record<string, number>)) {
          expect(ranges[name], name).toBeDefined();
          expect(value).toBeGreaterThanOrEqual(ranges[name]?.min ?? NaN);
          expect(value).toBeLessThanOrEqual(ranges[name]?.max ?? NaN);
        }
      }
    }
  });

  it('sets the look and keeps everything else', () => {
    const recipe = {
      ...neutralRecipe(0.5),
      detail: { ...neutralRecipe(0.5).detail, sharpen: 0.3 },
    };
    const { adjust, detail, lens } = withSceneryLook(recipe, 'drama');
    expect(adjust.contrast).toBe(0.25);
    expect(detail.clarity).toBe(0.8);
    expect(detail.sharpen).toBe(0.3);
    expect(lens.vignette).toBe(-0.4);
  });

  it('offers HDR and drama', () => {
    expect(Object.keys(SCENERY_LOOKS)).toEqual(
      expect.arrayContaining<SceneryLook>(['hdr', 'drama']),
    );
  });
});
