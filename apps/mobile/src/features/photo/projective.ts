import type { Affine, Point } from '../../engine/affine.worklet';

/**
 * A 2D projective transform (homography) as Skia's row-major 3×3 matrix values:
 * x' = (a·x + b·y + c) / w, y' = (d·x + e·y + f) / w, w = g·x + h·y + i.
 * Photos need it for perspective correction (EDT-18); everything else is affine.
 */
export type Projective = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export function fromAffine([a, b, c, d, e, f]: Affine): Projective {
  return [a, b, c, d, e, f, 0, 0, 1];
}

/** `outer ∘ inner`: applies `inner` first. */
export function composeProjective(outer: Projective, inner: Projective): Projective {
  const at = (m: Projective, row: number, column: number) => m[row * 3 + column] ?? 0;
  const values = Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    return (
      at(outer, row, 0) * at(inner, 0, column) +
      at(outer, row, 1) * at(inner, 1, column) +
      at(outer, row, 2) * at(inner, 2, column)
    );
  });
  return values as unknown as Projective;
}

export function applyProjective(m: Projective, { x, y }: Point): Point {
  const w = m[6] * x + m[7] * y + m[8];
  return { x: (m[0] * x + m[1] * y + m[2]) / w, y: (m[3] * x + m[4] * y + m[5]) / w };
}

/**
 * The affine transform closest to `m` around `point` (its first-order expansion),
 * for things placed by affine maps, such as faces, under a perspective correction.
 */
export function affineAt(m: Projective, point: Point): Affine {
  const w = m[6] * point.x + m[7] * point.y + m[8];
  const mapped = applyProjective(m, point);
  // d(x')/dx = (a - x'·g) / w, and likewise for the other partial derivatives.
  const a = (m[0] - mapped.x * m[6]) / w;
  const b = (m[1] - mapped.x * m[7]) / w;
  const d = (m[3] - mapped.y * m[6]) / w;
  const e = (m[4] - mapped.y * m[7]) / w;
  return [a, b, mapped.x - a * point.x - b * point.y, d, e, mapped.y - d * point.x - e * point.y];
}

/** Solves `matrix · x = vector` by Gaussian elimination with partial pivoting. */
function solve(matrix: number[][], vector: number[]): number[] {
  const n = vector.length;
  const rows = matrix.map((row, index) => [...row, vector[index] ?? 0]);
  for (let column = 0; column < n; column++) {
    let pivot = column;
    for (let row = column + 1; row < n; row++) {
      if (Math.abs(rows[row]?.[column] ?? 0) > Math.abs(rows[pivot]?.[column] ?? 0)) pivot = row;
    }
    const pivotRow = rows[pivot];
    if (pivotRow === undefined || Math.abs(pivotRow[column] ?? 0) < 1e-12) {
      throw new RangeError('The points do not define a transform');
    }
    [rows[column], rows[pivot]] = [pivotRow, rows[column] ?? pivotRow];
    for (let row = 0; row < n; row++) {
      const target = rows[row];
      if (row === column || target === undefined) continue;
      const factor = (target[column] ?? 0) / (pivotRow[column] ?? 1);
      for (let k = column; k <= n; k++) target[k] = (target[k] ?? 0) - factor * (pivotRow[k] ?? 0);
    }
  }
  return rows.map((row, index) => (row[n] ?? 0) / (row[index] ?? 1));
}

/** The homography taking each of four points to its partner in `to`. */
export function homography(
  from: readonly [Point, Point, Point, Point],
  to: readonly [Point, Point, Point, Point],
): Projective {
  const matrix: number[][] = [];
  const vector: number[] = [];
  from.forEach((source, index) => {
    const target = to[index] ?? source;
    matrix.push([source.x, source.y, 1, 0, 0, 0, -source.x * target.x, -source.y * target.x]);
    vector.push(target.x);
    matrix.push([0, 0, 0, source.x, source.y, 1, -source.x * target.y, -source.y * target.y]);
    vector.push(target.y);
  });
  const [a, b, c, d, e, f, g, h] = solve(matrix, vector);
  return [a ?? 1, b ?? 0, c ?? 0, d ?? 0, e ?? 1, f ?? 0, g ?? 0, h ?? 0, 1];
}
