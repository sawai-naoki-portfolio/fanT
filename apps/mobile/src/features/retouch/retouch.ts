import { hexColorSchema } from '@fant/content-schema';
import { z } from 'zod';

import { changesTone, type AreaTone } from '../selection/area-tone';

/** Blemish spots a photo can have (BTY-11); each is a few bytes in the recipe. */
export const MAX_HEAL_SPOTS = 200;

/** A blemish to smooth away, in output photo fractions (BTY-11). */
export const healSpotSchema = z.strictObject({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  /** As a fraction of the photo's short edge. */
  radius: z.number().min(0.004).max(0.2),
});
export type HealSpot = z.infer<typeof healSpotSchema>;

/** A blemish spot at a tapped point, or `null` when the photo has the most it can. */
export function addHealSpot(
  heal: readonly HealSpot[],
  point: { readonly x: number; readonly y: number },
  radius: number,
): HealSpot[] | null {
  if (heal.length >= MAX_HEAL_SPOTS) return null;
  return [...heal, { x: point.x, y: point.y, radius }];
}

/** Hair colour (EDT-12): how strongly, and towards which colour. */
export const hairSchema = z.strictObject({
  amount: z.number().min(0).max(1).default(0),
  color: hexColorSchema.default('#a0527a'),
});
export type Hair = z.infer<typeof hairSchema>;

export const NO_HAIR_COLOR: Hair = hairSchema.parse({});

/** Hair colours offered: browns and ash tones first, then playful ones. */
export const HAIR_COLORS = [
  '#a0527a',
  '#8d5a3b',
  '#c58b4a',
  '#9e9e9e',
  '#c9a0dc',
  '#ff8fb1',
  '#64b5f6',
  '#4db6ac',
] as const;

/**
 * What the person mask is needed for: a new backdrop (EDT-16), background blur
 * (EDT-11), hair colour (EDT-12) or toning the people or the background (EDT-34).
 */
export function needsPersonMask(recipe: {
  readonly backdrop: string | null;
  readonly backgroundBlur: number;
  readonly hair: Hair;
  readonly selective: { readonly people: AreaTone; readonly background: AreaTone };
}): boolean {
  return (
    recipe.backdrop !== null ||
    recipe.backgroundBlur > 0 ||
    recipe.hair.amount > 0 ||
    changesTone(recipe.selective.people) ||
    changesTone(recipe.selective.background)
  );
}

/** Converts `#rrggbb` to linear-ish 0–1 RGB for a shader. */
export function rgbOf(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}
