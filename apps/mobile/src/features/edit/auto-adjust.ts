import type { AdjustParams, DetailParams } from '@fant/filters';

import type { PhotoRecipe } from '../photo/recipe';

/** What auto adjustment looks at, all in 0–1. */
export interface ImageStats {
  /** Luma below which 1%, 50% and 99% of the pixels lie. */
  readonly low: number;
  readonly median: number;
  readonly high: number;
  /** The average colour, for a colour cast. */
  readonly mean: readonly [number, number, number];
  /** How colourful the photo is on average (max − min channel). */
  readonly saturation: number;
}

const LUMA = [0.2126, 0.7152, 0.0722] as const;

/** Statistics of RGBA8 pixels (e.g. from `samplePixels`). */
export function statsOf(pixels: Uint8Array): ImageStats {
  const count = Math.floor(pixels.length / 4);
  if (count === 0) throw new RangeError('No pixels');
  const histogram = new Array<number>(256).fill(0);
  const sum = [0, 0, 0];
  let saturation = 0;
  for (let index = 0; index < count; index++) {
    const r = (pixels[index * 4] ?? 0) / 255;
    const g = (pixels[index * 4 + 1] ?? 0) / 255;
    const b = (pixels[index * 4 + 2] ?? 0) / 255;
    const luma = LUMA[0] * r + LUMA[1] * g + LUMA[2] * b;
    const bin = Math.min(255, Math.round(luma * 255));
    histogram[bin] = (histogram[bin] ?? 0) + 1;
    sum[0] = (sum[0] ?? 0) + r;
    sum[1] = (sum[1] ?? 0) + g;
    sum[2] = (sum[2] ?? 0) + b;
    saturation += Math.max(r, g, b) - Math.min(r, g, b);
  }
  const percentile = (fraction: number) => {
    let seen = 0;
    for (let bin = 0; bin < 256; bin++) {
      seen += histogram[bin] ?? 0;
      if (seen >= fraction * count) return bin / 255;
    }
    return 1;
  };
  return {
    low: percentile(0.01),
    median: percentile(0.5),
    high: percentile(0.99),
    mean: [(sum[0] ?? 0) / count, (sum[1] ?? 0) / count, (sum[2] ?? 0) / count],
    saturation: saturation / count,
  };
}

const clamp = (value: number, limit: number) => Math.min(limit, Math.max(-limit, value));
/** Rounds to slider-friendly hundredths, so the values read as chosen. */
const round = (value: number) => Math.round(value * 100) / 100 || 0;

/** Where a well-exposed photo's middle luma sits. */
const TARGET_MEDIAN = 0.46;
/** A tonal range narrower than this looks flat and gets contrast. */
const FULL_RANGE = 0.85;

/**
 * One-tap correction (EDT-19): exposure towards a normal middle, contrast for a
 * flat photo, recovered highlights and lifted shadows where they clip, a colour
 * cast neutralised halfway and a little vibrance for dull colours. Gentle on
 * purpose, as a starting point the sliders then refine.
 */
export function autoAdjust(stats: ImageStats): {
  readonly adjust: Pick<AdjustParams, 'brightness' | 'contrast' | 'temperature'>;
  readonly detail: Pick<DetailParams, 'highlights' | 'shadows' | 'vibrance'>;
} {
  const median = Math.max(stats.median, 0.02);
  const range = stats.high - stats.low;
  const [red, , blue] = stats.mean;
  return {
    adjust: {
      brightness: round(clamp(Math.log2(TARGET_MEDIAN / median) * 0.7, 0.8)),
      contrast: round(clamp(Math.max(0, FULL_RANGE - range) * 1.5, 0.5)),
      // The grade shifts red and blue by 0.08 per unit of warmth: undo half the cast.
      temperature: round(clamp(((blue - red) / 0.16) * 0.5, 0.5)),
    },
    detail: {
      highlights: stats.high > 0.97 ? -0.4 : 0,
      shadows: stats.low < 0.03 && median < 0.35 ? 0.3 : 0,
      vibrance: stats.saturation < 0.2 ? 0.25 : 0.1,
    },
  };
}

/** The recipe change auto adjustment makes from a sample of the original's pixels. */
export function autoAdjusted(
  recipe: PhotoRecipe,
  pixels: Uint8Array,
): Pick<PhotoRecipe, 'adjust' | 'detail'> {
  const auto = autoAdjust(statsOf(pixels));
  return {
    adjust: { ...recipe.adjust, ...auto.adjust },
    detail: { ...recipe.detail, ...auto.detail },
  };
}
