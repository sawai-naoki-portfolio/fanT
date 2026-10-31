import { assertFrameSize } from '../frame';

/** Glyph codes understood by `date_stamp_v1`. */
export const DATE_STAMP_GLYPHS = { space: 10, apostrophe: 11, dot: 12 } as const;

export const MAX_DATE_STAMP_GLYPHS = 12;

/** How the date is written, e.g. `'26 10 24` for "yy mm dd". */
export const DATE_STAMP_FORMATS = ['yy mm dd', 'mm dd yy', 'yyyy.mm.dd'] as const;

export type DateStampFormat = (typeof DATE_STAMP_FORMATS)[number];

/** A calendar date, independent of time zones. */
export interface CalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export interface DateStamp {
  readonly date: CalendarDate;
  readonly format: DateStampFormat;
  /** Linear RGB in [0, 1]; the classic look is orange. */
  readonly color: readonly [number, number, number];
}

export const DATE_STAMP_ORANGE: DateStamp['color'] = [1, 0.48, 0.1];

/**
 * Everything the date stamp shader needs except the frame size; computed once per stamp.
 * A type alias (not an interface) so it is assignable to `UniformValues`.
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type DateStampGlyphs = {
  readonly glyphs0: readonly [number, number, number, number];
  readonly glyphs1: readonly [number, number, number, number];
  readonly glyphs2: readonly [number, number, number, number];
  readonly glyphCount: number;
  readonly color: readonly [number, number, number];
};

/** Uniform values keyed exactly as declared in the date stamp shader. */
export type DateStampUniforms = DateStampGlyphs & {
  readonly resolution: readonly [number, number];
};

export function calendarDateOf(date: Date): CalendarDate {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

/** The text a date stamp shows, e.g. `'26 10 24`. */
export function formatDateStamp(date: CalendarDate, format: DateStampFormat): string {
  const { year, month, day } = date;
  const valid =
    Number.isInteger(year) &&
    year >= 1900 &&
    year <= 2099 &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    Number.isInteger(day) &&
    day >= 1 &&
    day <= 31;
  if (!valid) throw new RangeError(`Invalid date: ${String(year)}-${String(month)}-${String(day)}`);
  const pad = (value: number) => String(value).padStart(2, '0');
  const yy = `'${pad(year % 100)}`;
  switch (format) {
    case 'yy mm dd':
      return `${yy} ${pad(month)} ${pad(day)}`;
    case 'mm dd yy':
      return `${pad(month)} ${pad(day)} ${yy}`;
    case 'yyyy.mm.dd':
      return `${String(year)}.${pad(month)}.${pad(day)}`;
  }
}

/** Turns stamp text into glyph codes; throws on characters the shader cannot draw. */
export function toGlyphCodes(text: string): number[] {
  if (text.length > MAX_DATE_STAMP_GLYPHS) {
    throw new RangeError(`Date stamp too long: "${text}"`);
  }
  return Array.from(text, (char) => {
    if (char >= '0' && char <= '9') return Number(char);
    if (char === ' ') return DATE_STAMP_GLYPHS.space;
    if (char === "'") return DATE_STAMP_GLYPHS.apostrophe;
    if (char === '.') return DATE_STAMP_GLYPHS.dot;
    throw new RangeError(`Unsupported date stamp character: "${char}"`);
  });
}

/**
 * Shader inputs for a stamp; `null` draws nothing (the shader passes the image
 * through), so the pipeline never needs a separate code path for "no date".
 */
export function toDateStampGlyphs(stamp: DateStamp | null): DateStampGlyphs {
  const codes = stamp === null ? [] : toGlyphCodes(formatDateStamp(stamp.date, stamp.format));
  const at = (index: number) => codes[index] ?? DATE_STAMP_GLYPHS.space;
  const quad = (start: number) => [at(start), at(start + 1), at(start + 2), at(start + 3)] as const;
  const clamp = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const [r, g, b] = stamp?.color ?? DATE_STAMP_ORANGE;
  return {
    glyphs0: quad(0),
    glyphs1: quad(4),
    glyphs2: quad(8),
    glyphCount: codes.length,
    color: [clamp(r), clamp(g), clamp(b)],
  };
}

/** Marked as a worklet so it can run on the camera frame thread. */
export function toDateStampUniforms(
  glyphs: DateStampGlyphs,
  frame: { readonly width: number; readonly height: number },
): DateStampUniforms {
  'worklet';
  assertFrameSize(frame.width, frame.height);
  return { ...glyphs, resolution: [frame.width, frame.height] };
}
