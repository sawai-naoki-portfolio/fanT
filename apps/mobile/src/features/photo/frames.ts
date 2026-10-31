import type { Size } from './geometry';

/**
 * Photo frames (FLM-07, PRI-08): an instant-print border, a Heisei digicam's LCD
 * read-out, and a border in the colour of one's favourite ("oshi") idol.
 */
export const FRAME_TYPES = ['polaroid', 'digicam', 'oshi'] as const;
export type FrameType = (typeof FRAME_TYPES)[number];

export interface Frame {
  readonly type: FrameType;
  /** The oshi colour (`#rrggbb`); the other frames ignore it. */
  readonly color: string;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Border widths as fractions of the output's short edge. */
const BORDERS: Record<FrameType, { side: number; bottom: number }> = {
  polaroid: { side: 0.05, bottom: 0.2 },
  digicam: { side: 0, bottom: 0 },
  oshi: { side: 0.045, bottom: 0.045 },
};

/** Where the photo sits inside its frame, in output pixels; the whole output without one. */
export function framedPhotoRect(frame: Frame | null, size: Size): Rect {
  if (frame === null) return { x: 0, y: 0, width: size.width, height: size.height };
  const short = Math.min(size.width, size.height);
  const { side, bottom } = BORDERS[frame.type];
  const border = side * short;
  return {
    x: border,
    y: border,
    width: size.width - border * 2,
    height: size.height - border - bottom * short,
  };
}

/**
 * How to draw a `size` image so it fills `rect` without distortion: a uniform scale
 * and the offset of its top-left corner, cropping the overflow evenly.
 */
export function coverPlacement(size: Size, rect: Rect): { scale: number; x: number; y: number } {
  const scale = Math.max(rect.width / size.width, rect.height / size.height);
  return {
    scale,
    x: rect.x + (rect.width - size.width * scale) / 2,
    y: rect.y + (rect.height - size.height * scale) / 2,
  };
}
