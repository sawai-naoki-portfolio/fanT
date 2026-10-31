import { describe, expect, it } from 'vitest';

import { DECO_COLORS } from '../deco/deco-ops';
import { neutralRecipe, parseRecipe } from './recipe';

describe('parseRecipe', () => {
  it('reads back a stored recipe', () => {
    const recipe = { ...neutralRecipe(0.5), frame: { type: 'oshi', color: '#ff5fa2' } };
    expect(parseRecipe(JSON.stringify(recipe))).toEqual(recipe);
  });

  it('reads recipes saved before newer fields existed with those fields off', () => {
    const older: Partial<ReturnType<typeof neutralRecipe>> = neutralRecipe(0.5);
    delete older.frame;
    delete older.faceShape;
    delete older.detail;
    delete older.local;
    const read = parseRecipe(JSON.stringify(older));
    expect(read?.frame).toBeNull();
    expect(read?.local).toEqual([]);
    expect(read?.detail.sharpen).toBe(0);
    expect(read?.faceShape.eyes).toBe(0);
  });

  it('reads text decorations saved before fonts existed in the system font', () => {
    const text = { type: 'text', text: 'ずっ友', style: 'outline', color: '#ff5fa2' };
    const older = {
      ...neutralRecipe(0.5),
      deco: [{ ...text, x: 0.5, y: 0.5, size: 0.1, rotation: 0 }],
    };
    const [layer] = parseRecipe(JSON.stringify(older))?.deco ?? [];
    expect(layer).toMatchObject({ type: 'text', font: 'system' });
  });

  it('rejects invalid or missing recipes', () => {
    expect(parseRecipe(null)).toBeNull();
    expect(parseRecipe('{')).toBeNull();
    expect(parseRecipe(JSON.stringify({ ...neutralRecipe(0.5), seed: 2 }))).toBeNull();
  });

  it('accepts every palette colour for frames and decorations', () => {
    for (const color of DECO_COLORS) {
      const recipe = { ...neutralRecipe(0.5), frame: { type: 'oshi', color } };
      expect(parseRecipe(JSON.stringify(recipe))).not.toBeNull();
    }
  });
});
