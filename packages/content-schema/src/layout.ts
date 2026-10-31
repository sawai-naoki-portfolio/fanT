import { z } from 'zod';

import { contentItemBase, hexColorSchema, localizedTextSchema } from './common';

const unit = z.number().min(0).max(1);

/** A photo slot on the sheet, in fractions of the sheet's size. */
const cellSchema = z
  .strictObject({ x: unit, y: unit, width: unit, height: unit })
  .refine(({ x, width }) => x + width <= 1 + 1e-9, 'Cell overflows the sheet horizontally')
  .refine(({ y, height }) => y + height <= 1 + 1e-9, 'Cell overflows the sheet vertically');
export type LayoutCell = z.infer<typeof cellSchema>;

export const SHEET_PATTERNS = ['plain', 'dots', 'stripes', 'hearts', 'checker'] as const;
export type SheetPattern = (typeof SHEET_PATTERNS)[number];

/** A purikura sheet (PRI-01): 2–6 photo cells, a background and pose prompts (PRI-02). */
export const layoutSchema = z.strictObject({
  ...contentItemBase,
  /** Sheet size in pixels at export. */
  width: z.number().int().min(600).max(4096),
  height: z.number().int().min(600).max(4096),
  cells: z.array(cellSchema).min(2).max(6),
  background: z.strictObject({
    color: hexColorSchema,
    pattern: z.enum(SHEET_PATTERNS),
    patternColor: hexColorSchema,
  }),
  /** Shown one per shot, e.g. 「推しのグッズを持って！」. */
  poses: z.array(localizedTextSchema).min(1).max(12),
});
export type Layout = z.infer<typeof layoutSchema>;
