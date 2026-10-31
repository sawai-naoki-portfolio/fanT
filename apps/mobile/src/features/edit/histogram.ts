/**
 * How many pixels fall in each brightness band, from black to white (EDT-30),
 * scaled so the fullest band is 1. For RGBA8 pixels, e.g. from `samplePixels`.
 */
export function lumaHistogram(pixels: Uint8Array, bins = 64): number[] {
  const counts = new Array<number>(bins).fill(0);
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const luma =
      (0.2126 * (pixels[index] ?? 0) +
        0.7152 * (pixels[index + 1] ?? 0) +
        0.0722 * (pixels[index + 2] ?? 0)) /
      255;
    const bin = Math.min(bins - 1, Math.floor(luma * bins));
    counts[bin] = (counts[bin] ?? 0) + 1;
  }
  const fullest = Math.max(1, ...counts);
  return counts.map((count) => count / fullest);
}
