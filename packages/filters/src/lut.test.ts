import { describe, expect, it } from 'vitest';

import { IDENTITY_LUT, makeLut, parseCubeLut } from './lut';

const pixel = (lut: { width: number; pixels: Uint8Array }, x: number, y: number) =>
  Array.from(lut.pixels.subarray((y * lut.width + x) * 4, (y * lut.width + x) * 4 + 4));

describe('makeLut', () => {
  it('lays out slices by blue, columns by red and rows by green', () => {
    const lut = makeLut(3, (r, g, b) => [r, g, b]);
    expect([lut.width, lut.height]).toEqual([9, 3]);
    // Slice 2 (blue = 1), red index 1, green index 2.
    expect(pixel(lut, 2 * 3 + 1, 2)).toEqual([128, 255, 255, 255]);
  });

  it('clamps out-of-range colours', () => {
    const lut = makeLut(2, () => [2, -1, 0.5]);
    expect(pixel(lut, 0, 0)).toEqual([255, 0, 128, 255]);
  });

  it.each([1, 66, 2.5])('rejects size %p', (size) => {
    expect(() => makeLut(size, (r, g, b) => [r, g, b])).toThrow(RangeError);
  });

  it('provides a 2×2×2 identity LUT', () => {
    expect(IDENTITY_LUT.size).toBe(2);
    expect(pixel(IDENTITY_LUT, 3, 1)).toEqual([255, 255, 255, 255]);
  });
});

describe('parseCubeLut', () => {
  const identity2 = [
    'TITLE "identity"',
    '# comment',
    'LUT_3D_SIZE 2',
    '0 0 0',
    '1 0 0',
    '0 1 0',
    '1 1 0',
    '0 0 1',
    '1 0 1',
    '0 1 1',
    '1 1 1',
  ].join('\n');

  it('reads a 3D LUT with red varying fastest', () => {
    expect(parseCubeLut(identity2).pixels).toEqual(IDENTITY_LUT.pixels);
  });

  it('honours DOMAIN_MIN and DOMAIN_MAX', () => {
    const scaled = identity2
      .replace('LUT_3D_SIZE 2', 'LUT_3D_SIZE 2\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 2 2 2')
      .replace(/^1 1 1$/m, '2 2 2');
    expect(pixel(parseCubeLut(scaled), 3, 1)).toEqual([255, 255, 255, 255]);
  });

  it.each([
    ['a 1D LUT', 'LUT_1D_SIZE 2\n0 0 0\n1 1 1'],
    ['a missing size', '0 0 0'],
    ['too few entries', 'LUT_3D_SIZE 2\n0 0 0'],
    ['a non-numeric entry', identity2.replace('1 1 1', '1 x 1')],
    ['an entry with two values', identity2.replace('1 1 1', '1 1')],
    ['an oversized LUT', 'LUT_3D_SIZE 100'],
    ['too many entries', `${identity2}\n0 0 0`],
  ])('rejects %s', (_, text) => {
    expect(() => parseCubeLut(text)).toThrow();
  });
});
