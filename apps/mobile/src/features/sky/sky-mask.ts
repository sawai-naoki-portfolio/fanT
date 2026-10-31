/**
 * Finds the sky in a small RGBA sample of a photo (EDT-25), on the device and
 * without a model: bright, smooth pixels of sky-like colour (blue, white-grey
 * cloud, or sunset warm in the upper half) that connect to the top edge without
 * crossing a sharp change of colour. Buildings, trees and people stop the fill.
 */

export interface SkyMask {
  readonly width: number;
  readonly height: number;
  /** 0–255 per pixel: how surely it is sky, softened at the edges. */
  readonly alpha: Uint8Array;
}

/** Less sky than this (a fraction of the photo) is treated as none. */
const MIN_SKY = 0.03;
/** Neighbours further apart than this (0–1 per channel, summed) are not the same sky. */
const MAX_STEP = 0.11;

function rgbAt(pixels: Uint8Array, index: number): readonly [number, number, number] {
  return [
    (pixels[index * 4] ?? 0) / 255,
    (pixels[index * 4 + 1] ?? 0) / 255,
    (pixels[index * 4 + 2] ?? 0) / 255,
  ];
}

/** Whether a colour could be sky at height `y` (0 top, 1 bottom). */
function skyLike([r, g, b]: readonly [number, number, number], y: number): boolean {
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  const blue = b >= r && b >= g * 0.9 && luma > 0.25;
  const cloud = spread < 0.12 && luma > 0.55;
  // Bright enough that a brown wall or a face is not taken for an evening sky.
  const sunset = y < 0.6 && r > b && luma > 0.5;
  return blue || cloud || sunset;
}

function step(a: readonly number[], b: readonly number[]): number {
  return (
    Math.abs((a[0] ?? 0) - (b[0] ?? 0)) +
    Math.abs((a[1] ?? 0) - (b[1] ?? 0)) +
    Math.abs((a[2] ?? 0) - (b[2] ?? 0))
  );
}

/** The sky of `width`×`height` RGBA pixels, or `null` when the photo shows (almost) none. */
export function skyMask(pixels: Uint8Array, width: number, height: number): SkyMask | null {
  const count = width * height;
  if (pixels.length < count * 4 || count === 0) throw new RangeError('Not enough pixels');
  const sky = new Uint8Array(count);
  const queue: number[] = [];
  for (let x = 0; x < width; x++) {
    if (skyLike(rgbAt(pixels, x), 0)) {
      sky[x] = 1;
      queue.push(x);
    }
  }
  // Flood fill downwards and sideways from the top edge (the loop also visits what it adds).
  for (const index of queue) {
    const x = index % width;
    const y = Math.floor(index / width);
    const here = rgbAt(pixels, index);
    const neighbours = [
      x > 0 ? index - 1 : -1,
      x < width - 1 ? index + 1 : -1,
      y > 0 ? index - width : -1,
      y < height - 1 ? index + width : -1,
    ];
    for (const next of neighbours) {
      if (next < 0 || sky[next] === 1) continue;
      const colour = rgbAt(pixels, next);
      if (step(here, colour) > MAX_STEP || !skyLike(colour, Math.floor(next / width) / height))
        continue;
      sky[next] = 1;
      queue.push(next);
    }
  }
  if (queue.length < count * MIN_SKY) return null;

  // Soften the edge: average over each pixel and its eight neighbours.
  const alpha = new Uint8Array(count);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let samples = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          sum += sky[ny * width + nx] ?? 0;
          samples++;
        }
      }
      alpha[y * width + x] = Math.round((sum / samples) * 255);
    }
  }
  return { width, height, alpha };
}
