import { hexColorSchema } from '@fant/content-schema';
import { z } from 'zod';

/** Coloured makeup parts (BTY-07), each with an amount and a colour. */
export const MAKEUP_PARTS = ['lip', 'blush', 'eyeshadow', 'brow', 'lens'] as const;
export type MakeupPart = (typeof MAKEUP_PARTS)[number];

const amount = z.number().min(0).max(1).default(0);

/**
 * Makeup and touch-ups drawn over the face before the film look: coloured parts
 * (BTY-07), whiter teeth (BTY-09) and lighter under-eyes (BTY-10). Every amount is
 * 0 (off) by default; fields added later read as off.
 */
export const makeupSchema = z.strictObject({
  lip: amount,
  lipColor: hexColorSchema.default('#e0466e'),
  blush: amount,
  blushColor: hexColorSchema.default('#ff8aa8'),
  eyeshadow: amount,
  eyeshadowColor: hexColorSchema.default('#c77d9a'),
  brow: amount,
  browColor: hexColorSchema.default('#5a3a2e'),
  lens: amount,
  lensColor: hexColorSchema.default('#7a5a3c'),
  teeth: amount,
  underEye: amount,
});
export type Makeup = z.infer<typeof makeupSchema>;

export const NO_MAKEUP: Makeup = makeupSchema.parse({});

/** Whether any makeup or touch-up is on (and so the faces' outlines are needed). */
export function hasMakeup(makeup: Makeup): boolean {
  'worklet';
  return (
    makeup.lip > 0 ||
    makeup.blush > 0 ||
    makeup.eyeshadow > 0 ||
    makeup.brow > 0 ||
    makeup.lens > 0 ||
    makeup.teeth > 0 ||
    makeup.underEye > 0
  );
}

/** Colours offered per part: everyday shades first, then playful ones. */
export const MAKEUP_PALETTES: Record<MakeupPart, readonly string[]> = {
  lip: ['#e0466e', '#c2185b', '#ff6f61', '#d9776d', '#9c2b4e', '#ff8fb1'],
  blush: ['#ff8aa8', '#ff9e7a', '#f06292', '#e57373', '#ce93d8'],
  eyeshadow: ['#c77d9a', '#b58b6d', '#9575cd', '#f48fb1', '#80cbc4', '#d4a017'],
  brow: ['#5a3a2e', '#3e2723', '#7b5e48', '#a1887f'],
  lens: ['#7a5a3c', '#4e342e', '#90a4ae', '#64b5f6', '#ba68c8', '#81c784'],
};
