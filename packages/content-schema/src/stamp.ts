import { z } from 'zod';

import { assetRefSchema, contentIdSchema, contentItemBase, hexColorSchema } from './common';

/** Vector stamps drawn by the app. */
export const STAMP_SHAPES = [
  'heart',
  'star',
  'sparkle',
  'crown',
  'ribbon',
  'flower',
  'music',
] as const;
export type StampShape = (typeof STAMP_SHAPES)[number];

/** Text stamp styles: gyaru-moji style outline, glowing neon, or a plain bubble. */
export const TEXT_STAMP_STYLES = ['outline', 'neon', 'bubble'] as const;
export type TextStampStyle = (typeof TEXT_STAMP_STYLES)[number];

const stampArtSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('shape'), shape: z.enum(STAMP_SHAPES), color: hexColorSchema }),
  z.strictObject({
    type: z.literal('text'),
    text: z.string().min(1).max(12),
    style: z.enum(TEXT_STAMP_STYLES),
    color: hexColorSchema,
  }),
  z.strictObject({ type: z.literal('image'), image: assetRefSchema }),
]);
export type StampArt = z.infer<typeof stampArtSchema>;

/** A decoration placed on a photo, scalable and rotatable (DCO-02). */
export const stampSchema = z.strictObject({
  ...contentItemBase,
  art: stampArtSchema,
});
export type Stamp = z.infer<typeof stampSchema>;

/** A Heisei word offered as a text template (DCO-03), e.g. 「ズッ友」. */
export const phraseSchema = z.strictObject({
  id: contentIdSchema,
  text: z.string().min(1).max(16),
});
export type Phrase = z.infer<typeof phraseSchema>;
