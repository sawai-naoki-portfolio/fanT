import { z } from 'zod';

/** Content IDs: lowercase slugs, stable across versions (used as storage keys). */
export const contentIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_]{0,47}$/, 'IDs are lowercase letters, digits and underscores');

/** Who can save with an item; premium items can still be tried in the preview (PAY-07). */
export const tierSchema = z.enum(['free', 'premium']);
export type Tier = z.infer<typeof tierSchema>;

/**
 * User-facing text per language. Japanese is required (MVP language); others are
 * optional so translations can be added without a schema change.
 */
export const localizedTextSchema = z.strictObject({
  ja: z.string().min(1).max(80),
  en: z.string().min(1).max(80).optional(),
});
export type LocalizedText = z.infer<typeof localizedTextSchema>;

/**
 * A file shipped with content. The path is relative to the content root and cannot
 * escape it (it becomes a cache file name); `sha256` lets the app reject a file that
 * was corrupted or tampered with on the way.
 */
export const assetRefSchema = z.strictObject({
  path: z
    .string()
    .max(128)
    .regex(
      /^(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:png|webp)$/,
      'Asset paths are lowercase, relative, without "..", and end in .png or .webp',
    ),
  sha256: z.string().regex(/^[0-9a-f]{64}$/, 'sha256 is 64 lowercase hex digits'),
});
export type AssetRef = z.infer<typeof assetRefSchema>;

/** `#rrggbb` colours, the only form content may use. */
export const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/, 'Colours are #rrggbb');

/**
 * Delivery window for seasonal content (CNT-04). `publishedAt` also drives the NEW
 * badge (CNT-03).
 */
export const availabilitySchema = z.strictObject({
  publishedAt: z.iso.datetime({ offset: true }),
  availableUntil: z.iso.datetime({ offset: true }).optional(),
});
export type Availability = z.infer<typeof availabilitySchema>;

/** Fields every content item has. */
export const contentItemBase = {
  id: contentIdSchema,
  version: z.number().int().min(1),
  name: localizedTextSchema,
  tier: tierSchema,
  availability: availabilitySchema.optional(),
};
