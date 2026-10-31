import { halve, type Gray } from './gray';

/** A shift in sample pixels: where to draw a photo so it lines up with the reference. */
export interface Shift {
  readonly dx: number;
  readonly dy: number;
}

/** Pixels this close to the median say nothing about which side they are on. */
const NOISE = 4 / 255;

function median(gray: Gray): number {
  const sorted = Float32Array.from(gray.data).sort();
  return sorted[Math.floor(sorted.length / 2)] ?? 0.5;
}

/** Ward's median threshold bitmap: above/below the median, and whether that is reliable. */
function thresholdBitmap(gray: Gray) {
  const middle = median(gray);
  const above = new Uint8Array(gray.data.length);
  const reliable = new Uint8Array(gray.data.length);
  gray.data.forEach((value, index) => {
    above[index] = value > middle ? 1 : 0;
    reliable[index] = Math.abs(value - middle) > NOISE ? 1 : 0;
  });
  return { width: gray.width, height: gray.height, above, reliable };
}

type Bitmap = ReturnType<typeof thresholdBitmap>;

/** Disagreeing reliable pixels when `moving` is drawn at `shift` over `reference`. */
function mismatch(reference: Bitmap, moving: Bitmap, shift: Shift): number {
  let errors = 0;
  for (let y = 0; y < reference.height; y++) {
    const my = y - shift.dy;
    if (my < 0 || my >= moving.height) continue;
    for (let x = 0; x < reference.width; x++) {
      const mx = x - shift.dx;
      if (mx < 0 || mx >= moving.width) continue;
      const r = y * reference.width + x;
      const m = my * moving.width + mx;
      if (
        reference.reliable[r] === 1 &&
        moving.reliable[m] === 1 &&
        reference.above[r] !== moving.above[m]
      ) {
        errors++;
      }
    }
  }
  return errors;
}

/**
 * How to shift `moving` onto `reference`, two shots of one scene that may differ in
 * exposure (EDT-26): median threshold bitmaps compared from coarse to fine, so a
 * dark and a bright shot still agree. Finds shifts up to 2^levels − 1 pixels.
 */
export function alignShift(reference: Gray, moving: Gray, levels = 5): Shift {
  if (levels <= 0 || Math.min(reference.width, reference.height) < 8) {
    return bestAround(thresholdBitmap(reference), thresholdBitmap(moving), { dx: 0, dy: 0 });
  }
  const coarse = alignShift(halve(reference), halve(moving), levels - 1);
  return bestAround(thresholdBitmap(reference), thresholdBitmap(moving), {
    dx: coarse.dx * 2,
    dy: coarse.dy * 2,
  });
}

function bestAround(reference: Bitmap, moving: Bitmap, guess: Shift): Shift {
  let best = guess;
  let fewest = Number.POSITIVE_INFINITY;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const shift = { dx: guess.dx + dx, dy: guess.dy + dy };
      const errors = mismatch(reference, moving, shift);
      if (errors < fewest) {
        fewest = errors;
        best = shift;
      }
    }
  }
  return best;
}

/** The part every shifted photo covers, in pixels of a `width`×`height` photo. */
export function commonArea(
  width: number,
  height: number,
  shifts: readonly Shift[],
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  const left = Math.max(0, ...shifts.map(({ dx }) => dx));
  const top = Math.max(0, ...shifts.map(({ dy }) => dy));
  const right = Math.min(width, ...shifts.map(({ dx }) => width + dx));
  const bottom = Math.min(height, ...shifts.map(({ dy }) => height + dy));
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}
