import { halve, type Gray } from './gray';

/** Where the next photo starts, in sample pixels from the left one's top-left corner. */
export interface Offset {
  readonly dx: number;
  readonly dy: number;
}

/** Overlaps narrower than this (of the width) are too thin to trust. */
const MIN_OVERLAP = 0.12;
/** How far up or down a handheld pan may drift, as a fraction of the height. */
const MAX_DRIFT = 0.1;

/**
 * How different the overlap is when `right` starts at `offset`: the mean absolute
 * difference after evening out each side's brightness (exposure may vary).
 */
function overlapCost(left: Gray, right: Gray, offset: Offset): number {
  const x0 = offset.dx;
  const x1 = Math.min(left.width, offset.dx + right.width);
  const y0 = Math.max(0, offset.dy);
  const y1 = Math.min(left.height, offset.dy + right.height);
  if (x1 - x0 < 2 || y1 - y0 < 2) return Number.POSITIVE_INFINITY;
  let sumL = 0;
  let sumR = 0;
  let count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      sumL += left.data[y * left.width + x] ?? 0;
      sumR += right.data[(y - offset.dy) * right.width + (x - offset.dx)] ?? 0;
      count++;
    }
  }
  const shift = (sumL - sumR) / count;
  let cost = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const l = left.data[y * left.width + x] ?? 0;
      const r = right.data[(y - offset.dy) * right.width + (x - offset.dx)] ?? 0;
      cost += Math.abs(l - r - shift);
    }
  }
  return cost / count;
}

function search(left: Gray, right: Gray, xs: Iterable<number>, ys: Iterable<number>): Offset {
  let best: Offset = { dx: Math.round(left.width / 2), dy: 0 };
  let lowest = Number.POSITIVE_INFINITY;
  const rows = [...ys];
  for (const dx of xs) {
    for (const dy of rows) {
      const cost = overlapCost(left, right, { dx, dy });
      if (cost < lowest) {
        lowest = cost;
        best = { dx, dy };
      }
    }
  }
  return best;
}

function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index);
}

/**
 * Where `right` continues `left` in a pan from left to right (EDT-27): searched
 * on a half-size copy over every overlap from most of the width down to 12%, then
 * refined at full sample size.
 */
export function panoramaOffset(left: Gray, right: Gray): Offset {
  const smallLeft = halve(left);
  const smallRight = halve(right);
  const drift = Math.round(smallLeft.height * MAX_DRIFT);
  const coarse = search(
    smallLeft,
    smallRight,
    range(Math.round(smallLeft.width * 0.1), Math.round(smallLeft.width * (1 - MIN_OVERLAP))),
    range(-drift, drift),
  );
  return search(
    left,
    right,
    range(coarse.dx * 2 - 2, coarse.dx * 2 + 2),
    range(coarse.dy * 2 - 2, coarse.dy * 2 + 2),
  );
}

export interface PanoramaLayout {
  /** Each photo's top-left corner on the canvas, in the units of the offsets. */
  readonly positions: readonly Offset[];
  /** The canvas: every photo's width, and only the height all of them cover. */
  readonly width: number;
  readonly height: number;
  /** Where the canvas starts vertically, from the first photo's top. */
  readonly top: number;
}

/** Places photos of one size side by side by their offsets, cropped to a clean rectangle. */
export function panoramaLayout(
  photo: { readonly width: number; readonly height: number },
  offsets: readonly Offset[],
): PanoramaLayout {
  const positions: Offset[] = [{ dx: 0, dy: 0 }];
  for (const offset of offsets) {
    const previous = positions[positions.length - 1] ?? { dx: 0, dy: 0 };
    positions.push({ dx: previous.dx + offset.dx, dy: previous.dy + offset.dy });
  }
  const top = Math.max(...positions.map(({ dy }) => dy));
  const bottom = Math.min(...positions.map(({ dy }) => dy + photo.height));
  const last = positions[positions.length - 1] ?? { dx: 0, dy: 0 };
  return {
    positions,
    width: last.dx + photo.width,
    height: Math.max(1, bottom - top),
    top,
  };
}
