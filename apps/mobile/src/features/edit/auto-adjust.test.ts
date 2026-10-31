import { describe, expect, it } from 'vitest';

import { neutralRecipe } from '../photo/recipe';
import { autoAdjust, autoAdjusted, statsOf, type ImageStats } from './auto-adjust';

/** RGBA pixels of the given colours, repeated in order. */
function pixels(colors: readonly (readonly [number, number, number])[], count = 100) {
  const data = new Uint8Array(count * 4);
  for (let index = 0; index < count; index++) {
    const [r, g, b] = colors[index % colors.length] ?? [0, 0, 0];
    data.set([r, g, b, 255], index * 4);
  }
  return data;
}

const BALANCED: ImageStats = {
  low: 0.02,
  median: 0.46,
  high: 0.96,
  mean: [0.45, 0.45, 0.45],
  saturation: 0.3,
};

describe('statsOf', () => {
  it('finds the tonal range and the average colour', () => {
    const stats = statsOf(
      pixels(
        [
          [0, 0, 0],
          [128, 128, 128],
          [255, 255, 255],
        ],
        300,
      ),
    );
    expect(stats.low).toBe(0);
    expect(stats.median).toBeCloseTo(128 / 255, 2);
    expect(stats.high).toBe(1);
    expect(stats.mean[0]).toBeCloseTo((0 + 128 + 255) / 3 / 255, 5);
    expect(stats.saturation).toBe(0);
  });

  it('measures how colourful the photo is', () => {
    expect(statsOf(pixels([[255, 0, 0]])).saturation).toBe(1);
  });

  it('refuses an empty image', () => {
    expect(() => statsOf(new Uint8Array())).toThrow(RangeError);
  });
});

describe('autoAdjust', () => {
  it('leaves a well-balanced photo nearly alone', () => {
    const { adjust, detail } = autoAdjust(BALANCED);
    expect(adjust).toEqual({ brightness: 0, contrast: 0, temperature: 0 });
    expect(detail).toEqual({ highlights: 0, shadows: 0, vibrance: 0.1 });
  });

  it('brightens a dark photo and darkens a bright one, within limits', () => {
    expect(autoAdjust({ ...BALANCED, median: 0.2 }).adjust.brightness).toBeGreaterThan(0.5);
    expect(autoAdjust({ ...BALANCED, median: 0.8 }).adjust.brightness).toBeLessThan(-0.3);
    expect(autoAdjust({ ...BALANCED, median: 0 }).adjust.brightness).toBe(0.8);
  });

  it('adds contrast to a flat, hazy photo', () => {
    expect(autoAdjust({ ...BALANCED, low: 0.3, high: 0.7 }).adjust.contrast).toBe(0.5);
  });

  it('recovers clipped highlights and lifts dark shadows', () => {
    const { detail } = autoAdjust({ ...BALANCED, low: 0, median: 0.3, high: 1 });
    expect(detail.highlights).toBeLessThan(0);
    expect(detail.shadows).toBeGreaterThan(0);
  });

  it('warms a blue cast and cools an orange one', () => {
    expect(autoAdjust({ ...BALANCED, mean: [0.4, 0.45, 0.52] }).adjust.temperature).toBeGreaterThan(
      0,
    );
    expect(autoAdjust({ ...BALANCED, mean: [0.55, 0.45, 0.35] }).adjust.temperature).toBeLessThan(
      0,
    );
  });

  it('gives dull colours more vibrance', () => {
    expect(autoAdjust({ ...BALANCED, saturation: 0.05 }).detail.vibrance).toBe(0.25);
  });
});

describe('autoAdjusted', () => {
  it('changes only the auto-adjusted values of the recipe', () => {
    const recipe = {
      ...neutralRecipe(0.5),
      adjust: { ...neutralRecipe(0.5).adjust, saturation: 0.4 },
      detail: { ...neutralRecipe(0.5).detail, sky: 0.7 },
    };
    const dark = pixels([[30, 30, 30]]);

    const { adjust, detail } = autoAdjusted(recipe, dark);

    expect(adjust.brightness).toBeGreaterThan(0);
    expect(adjust.saturation).toBe(0.4);
    expect(detail.sky).toBe(0.7);
  });
});
