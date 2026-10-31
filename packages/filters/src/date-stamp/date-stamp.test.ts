import { describe, expect, it } from 'vitest';

import {
  DATE_STAMP_GLYPHS,
  DATE_STAMP_ORANGE,
  formatDateStamp,
  toDateStampGlyphs,
  toDateStampUniforms,
  toGlyphCodes,
} from './date-stamp';

const DATE = { year: 2026, month: 10, day: 4 };

describe('formatDateStamp', () => {
  it.each([
    ['yy mm dd', "'26 10 04"],
    ['mm dd yy', "10 04 '26"],
    ['yyyy.mm.dd', '2026.10.04'],
  ] as const)('writes %s as %s', (format, text) => {
    expect(formatDateStamp(DATE, format)).toBe(text);
  });

  it.each([
    { year: 2026, month: 13, day: 1 },
    { year: 2026, month: 1, day: 0 },
    { year: 1800, month: 1, day: 1 },
    { year: 2026.5, month: 1, day: 1 },
  ])('rejects an invalid date %o', (date) => {
    expect(() => formatDateStamp(date, 'yy mm dd')).toThrow(RangeError);
  });
});

describe('toGlyphCodes', () => {
  it('maps digits and separators to shader codes', () => {
    expect(toGlyphCodes("'26.1 ")).toEqual([
      DATE_STAMP_GLYPHS.apostrophe,
      2,
      6,
      DATE_STAMP_GLYPHS.dot,
      1,
      DATE_STAMP_GLYPHS.space,
    ]);
  });

  it('rejects characters the shader cannot draw and text that is too long', () => {
    expect(() => toGlyphCodes('26/10')).toThrow(RangeError);
    expect(() => toGlyphCodes('1234567890123')).toThrow(RangeError);
  });
});

describe('toDateStampGlyphs', () => {
  it('draws nothing without a stamp', () => {
    expect(toDateStampGlyphs(null).glyphCount).toBe(0);
  });

  it('packs the glyphs into three groups of four', () => {
    const glyphs = toDateStampGlyphs({
      date: DATE,
      format: 'yyyy.mm.dd',
      color: DATE_STAMP_ORANGE,
    });
    expect(glyphs.glyphCount).toBe(10);
    expect(glyphs.glyphs0).toEqual([2, 0, 2, 6]);
    expect(glyphs.glyphs1).toEqual([DATE_STAMP_GLYPHS.dot, 1, 0, DATE_STAMP_GLYPHS.dot]);
    expect(glyphs.glyphs2).toEqual([0, 4, DATE_STAMP_GLYPHS.space, DATE_STAMP_GLYPHS.space]);
  });

  it('clamps the colour to [0, 1]', () => {
    const glyphs = toDateStampGlyphs({
      date: DATE,
      format: 'yy mm dd',
      color: [2, -1, Number.NaN],
    });
    expect(glyphs.color).toEqual([1, 0, 0]);
  });
});

describe('toDateStampUniforms', () => {
  it('adds the frame size and rejects an invalid one', () => {
    const glyphs = toDateStampGlyphs(null);
    expect(toDateStampUniforms(glyphs, { width: 3, height: 4 }).resolution).toEqual([3, 4]);
    expect(() => toDateStampUniforms(glyphs, { width: 0, height: 4 })).toThrow(RangeError);
  });
});
