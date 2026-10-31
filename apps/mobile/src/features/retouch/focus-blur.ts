import { z } from 'zod';

import type { Size } from '../photo/geometry';

/**
 * Tilt-shift (EDT-23): the photo stays sharp in a circle or a band around the
 * focus point and blurs beyond it. Unlike background blur it needs no people.
 */
export const focusBlurSchema = z.strictObject({
  shape: z.enum(['radial', 'band']).default('band'),
  /** 0 is off. */
  amount: z.number().min(0).max(1).default(0),
  x: z.number().min(0).max(1).default(0.5),
  y: z.number().min(0).max(1).default(0.55),
  /** Half the sharp area, as a fraction of the photo's short edge. */
  size: z.number().min(0.03).max(1).default(0.15),
  /** A band's direction, in degrees (0 is horizontal). */
  angle: z.number().min(-90).max(90).default(0),
});
export type FocusBlur = z.infer<typeof focusBlurSchema>;

export const NO_FOCUS_BLUR: FocusBlur = focusBlurSchema.parse({});

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Where the photo stays sharp, in output pixels: opaque inside, fading out over
 * as much again beyond it. For a gradient that keeps the sharp copy.
 */
export type FocusGradient =
  | {
      readonly kind: 'radial';
      readonly center: Point;
      readonly radius: number;
      readonly sharpTo: number;
    }
  | { readonly kind: 'linear'; readonly from: Point; readonly to: Point };

export function focusGradient(focus: FocusBlur, size: Size): FocusGradient {
  const short = Math.min(size.width, size.height);
  const center = { x: focus.x * size.width, y: focus.y * size.height };
  const sharp = focus.size * short;
  if (focus.shape === 'radial') {
    return { kind: 'radial', center, radius: sharp * 2, sharpTo: 0.5 };
  }
  // Across the band: perpendicular to its direction, over twice the sharp half-width.
  const radians = (focus.angle * Math.PI) / 180;
  const across = { x: -Math.sin(radians), y: Math.cos(radians) };
  const reach = sharp * 2;
  return {
    kind: 'linear',
    from: { x: center.x - across.x * reach, y: center.y - across.y * reach },
    to: { x: center.x + across.x * reach, y: center.y + across.y * reach },
  };
}

/** Blur strength in pixels at full amount, relative to the photo's short edge. */
export function focusBlurSigma(focus: FocusBlur, size: Size): number {
  return focus.amount * Math.min(size.width, size.height) * 0.015;
}
