import { describe, expect, it } from 'vitest';

import { FULL_CROP, neutralRecipe, type PhotoRecipe } from '../photo/recipe';
import { EDITED_VIEW, previewRecipeOf } from './preview-view';

const CROP = { x: 0.1, y: 0.1, width: 0.5, height: 0.5 };
const EDITED: PhotoRecipe = {
  ...neutralRecipe(0.4),
  film: { id: 'mono', intensity: 1 },
  adjust: { ...neutralRecipe(0.4).adjust, brightness: 0.5 },
  transform: { ...neutralRecipe(0.4).transform, rotation: 90, straighten: 3, crop: CROP },
  deco: [{ type: 'stamp', stampId: 'heart', x: 0.5, y: 0.5, size: 0.2, rotation: 0 }],
};

describe('previewRecipeOf', () => {
  it('shows the edited photo by default', () => {
    expect(previewRecipeOf(EDITED, EDITED_VIEW)).toEqual(EDITED);
  });

  it('shows the photo before its look, framed and turned as edited', () => {
    const before = previewRecipeOf(EDITED, { ...EDITED_VIEW, before: true });
    expect(before.film).toEqual(neutralRecipe(0.4).film);
    expect(before.adjust.brightness).toBe(0);
    expect(before.transform).toEqual(EDITED.transform);
    expect(before.deco).toEqual([]);
  });

  it('shows the whole photo while cropping, keeping the rest of the edit', () => {
    const whole = previewRecipeOf(EDITED, { ...EDITED_VIEW, uncropped: true });
    expect(whole.transform.crop).toEqual(FULL_CROP);
    expect(whole.transform.rotation).toBe(90);
    expect(whole.film.id).toBe('mono');
  });

  it('leaves the decorations out for the deco editor', () => {
    expect(previewRecipeOf(EDITED, { ...EDITED_VIEW, withoutDeco: true }).deco).toEqual([]);
  });
});
