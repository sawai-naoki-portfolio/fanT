/**
 * 2D affine transforms as `[a, b, c, d, e, f]`: x' = a·x + b·y + c, y' = d·x + e·y + f.
 * Pure math shared by the camera thread (worklets) and the photo renderer, so the
 * preview, the saved photo and face positions always use the same geometry.
 */
export type Affine = readonly [number, number, number, number, number, number];

export interface Point {
  readonly x: number;
  readonly y: number;
}

export const IDENTITY: Affine = [1, 0, 0, 0, 1, 0];

/** `outer ∘ inner`: applies `inner` first. */
export function compose(outer: Affine, inner: Affine): Affine {
  'worklet';
  const [a1, b1, c1, d1, e1, f1] = outer;
  const [a2, b2, c2, d2, e2, f2] = inner;
  return [
    a1 * a2 + b1 * d2,
    a1 * b2 + b1 * e2,
    a1 * c2 + b1 * f2 + c1,
    d1 * a2 + e1 * d2,
    d1 * b2 + e1 * e2,
    d1 * c2 + e1 * f2 + f1,
  ];
}

export function invert(m: Affine): Affine {
  'worklet';
  const [a, b, c, d, e, f] = m;
  const determinant = a * e - b * d;
  if (Math.abs(determinant) < 1e-12) throw new RangeError('Transform is not invertible');
  const ia = e / determinant;
  const ib = -b / determinant;
  const id = -d / determinant;
  const ie = a / determinant;
  return [ia, ib, -(ia * c + ib * f), id, ie, -(id * c + ie * f)];
}

export function apply(m: Affine, point: Point): Point {
  'worklet';
  const [a, b, c, d, e, f] = m;
  return { x: a * point.x + b * point.y + c, y: d * point.x + e * point.y + f };
}

/** Skia's row-major 3×3 matrix values. */
export function toMatrix3(m: Affine): number[] {
  'worklet';
  return [m[0], m[1], m[2], m[3], m[4], m[5], 0, 0, 1];
}

/** The affine part of Skia's 3×3 matrix values (perspective is not used). */
export function fromMatrix3(values: readonly number[]): Affine {
  'worklet';
  return [
    values[0] ?? 1,
    values[1] ?? 0,
    values[2] ?? 0,
    values[3] ?? 0,
    values[4] ?? 1,
    values[5] ?? 0,
  ];
}

export function translate(x: number, y: number): Affine {
  'worklet';
  return [1, 0, x, 0, 1, y];
}

export function scale(x: number, y: number): Affine {
  'worklet';
  return [x, 0, 0, 0, y, 0];
}

/** Rotation by `degrees` clockwise (y points down) around `center`. */
export function rotateAround(degrees: number, center: Point): Affine {
  'worklet';
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return compose(
    translate(center.x, center.y),
    compose([cos, -sin, 0, sin, cos, 0], translate(-center.x, -center.y)),
  );
}
