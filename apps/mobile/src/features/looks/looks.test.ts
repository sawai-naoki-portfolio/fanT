import { describe, expect, it } from 'vitest';

import { LOOK_KEYS, lookSchema, neutralRecipe, type PhotoRecipe } from '../photo/recipe';
import { lookOf, withLook } from './look';
import { MAX_PRESETS, usePresets } from './presets-store';

const EDITED: PhotoRecipe = {
  ...neutralRecipe(0.4),
  film: { id: 'mono', intensity: 0.8 },
  adjust: { ...neutralRecipe(0.4).adjust, contrast: 0.3 },
  transform: { ...neutralRecipe(0.4).transform, rotation: 90 },
  heal: [{ x: 0.5, y: 0.5, radius: 0.02 }],
};

describe('looks', () => {
  it('takes only what makes the look', () => {
    const look = lookOf(EDITED);
    expect(Object.keys(look).sort()).toEqual([...LOOK_KEYS].sort());
    expect(look.film).toEqual({ id: 'mono', intensity: 0.8 });
    expect(lookSchema.safeParse(look).success).toBe(true);
  });

  it('puts a look on another photo and keeps its framing and retouching', () => {
    const other = { ...neutralRecipe(0.9), heal: [{ x: 0.1, y: 0.1, radius: 0.03 }] };
    const pasted = withLook(other, lookOf(EDITED));
    expect(pasted.film.id).toBe('mono');
    expect(pasted.adjust.contrast).toBe(0.3);
    expect(pasted.transform.rotation).toBe(0);
    expect(pasted.heal).toEqual(other.heal);
    expect(pasted.seed).toBe(0.9);
  });
});

describe('presets', () => {
  it('saves presets up to the limit and removes them', () => {
    const look = lookOf(EDITED);
    for (let index = 0; index < MAX_PRESETS; index++) {
      expect(usePresets.getState().add(`Preset ${String(index)}`, look)).toBe(true);
    }
    expect(usePresets.getState().add('One too many', look)).toBe(false);
    const [first] = usePresets.getState().presets;
    usePresets.getState().remove(first?.id ?? '');
    expect(usePresets.getState().presets).toHaveLength(MAX_PRESETS - 1);
  });
});
