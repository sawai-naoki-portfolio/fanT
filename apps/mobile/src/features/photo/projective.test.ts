import { describe, expect, it } from 'vitest';

import { apply } from '../../engine/affine.worklet';
import {
  affineAt,
  applyProjective,
  composeProjective,
  fromAffine,
  homography,
  type Projective,
} from './projective';

const SQUARE = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
] as const;
const TRAPEZOID = [
  { x: 20, y: 0 },
  { x: 80, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
] as const;

describe('projective', () => {
  it('takes each point to its partner', () => {
    const m = homography(TRAPEZOID, SQUARE);
    TRAPEZOID.forEach((point, index) => {
      const target = applyProjective(m, point);
      expect(target.x).toBeCloseTo(SQUARE[index]?.x ?? NaN, 6);
      expect(target.y).toBeCloseTo(SQUARE[index]?.y ?? NaN, 6);
    });
  });

  it('is the identity between the same points', () => {
    const m = homography(SQUARE, SQUARE);
    expect(m.map((value) => Math.round(value * 1e6) / 1e6)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('refuses points that do not define a transform', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ] as const;
    expect(() => homography(line, SQUARE)).toThrow(RangeError);
  });

  it('composes like applying one after the other', () => {
    const inner = homography(TRAPEZOID, SQUARE);
    const outer: Projective = fromAffine([2, 0, 5, 0, 3, -1]);
    const point = { x: 37, y: 61 };
    const composed = applyProjective(composeProjective(outer, inner), point);
    const stepwise = applyProjective(outer, applyProjective(inner, point));
    expect(composed.x).toBeCloseTo(stepwise.x, 9);
    expect(composed.y).toBeCloseTo(stepwise.y, 9);
  });

  it('approximates a homography with an affine map around a point', () => {
    const m = homography(TRAPEZOID, SQUARE);
    const center = { x: 50, y: 50 };
    const local = affineAt(m, center);
    const exact = applyProjective(m, { x: 51, y: 52 });
    const approximate = apply(local, { x: 51, y: 52 });
    expect(apply(local, center).x).toBeCloseTo(applyProjective(m, center).x, 9);
    expect(approximate.x).toBeCloseTo(exact.x, 1);
    expect(approximate.y).toBeCloseTo(exact.y, 1);
  });
});
