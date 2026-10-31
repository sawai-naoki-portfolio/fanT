import { describe, expect, it } from 'vitest';

import { BACKDROPS, findBackdrop } from './backdrops';
import { neutralRecipe, parseRecipe } from './recipe';

describe('backdrops', () => {
  it('have unique IDs that fit in a recipe', () => {
    const ids = BACKDROPS.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.length).toBeLessThanOrEqual(32);
  });

  it('give each gradient stop a colour', () => {
    for (const { gradient, stops } of BACKDROPS) {
      if (stops !== undefined) expect(stops).toHaveLength(gradient?.length ?? -1);
    }
  });

  it('finds a backdrop by ID, and none for an unknown one', () => {
    expect(findBackdrop('sky')?.emoji).toBe('🌤️');
    expect(findBackdrop(null)).toBeNull();
    expect(findBackdrop('from_a_newer_version')).toBeNull();
  });

  it('is stored in the recipe, and missing from older ones', () => {
    const recipe = { ...neutralRecipe(0.5), backdrop: 'starry' };
    expect(parseRecipe(JSON.stringify(recipe))?.backdrop).toBe('starry');

    const older: Record<string, unknown> = { ...neutralRecipe(0.5) };
    delete older.backdrop;
    expect(parseRecipe(JSON.stringify(older))?.backdrop).toBeNull();
  });
});
