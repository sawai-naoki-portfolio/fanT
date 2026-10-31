import { describe, expect, it } from 'vitest';

import {
  apply,
  compose,
  fromMatrix3,
  IDENTITY,
  invert,
  rotateAround,
  scale,
  toMatrix3,
  translate,
} from './affine.worklet';

const close = (actual: { x: number; y: number }, expected: { x: number; y: number }) => {
  expect(actual.x).toBeCloseTo(expected.x, 9);
  expect(actual.y).toBeCloseTo(expected.y, 9);
};

describe('affine', () => {
  it('applies the inner transform first when composing', () => {
    const m = compose(translate(10, 0), scale(2, 2));
    close(apply(m, { x: 1, y: 1 }), { x: 12, y: 2 });
  });

  it('inverts a transform', () => {
    const m = compose(rotateAround(30, { x: 5, y: 5 }), compose(translate(3, -2), scale(2, 0.5)));
    const p = { x: 7, y: -4 };
    close(apply(invert(m), apply(m, p)), p);
  });

  it('rejects a singular transform', () => {
    expect(() => invert(scale(0, 1))).toThrow(RangeError);
  });

  it('rotates clockwise in screen coordinates', () => {
    close(apply(rotateAround(90, { x: 0, y: 0 }), { x: 1, y: 0 }), { x: 0, y: 1 });
  });

  it('round-trips through Skia matrix values', () => {
    const m = compose(translate(1, 2), scale(3, 4));
    expect(fromMatrix3(toMatrix3(m))).toEqual(m);
    expect(toMatrix3(IDENTITY)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });
});
