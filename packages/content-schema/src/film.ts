import { FILM_PARAM_RANGES, normalizeFilmParams, type FilmParams } from '@fant/filters';
import { z } from 'zod';

import { assetRefSchema, contentItemBase } from './common';

/** Parameters chosen per shot or by the user, so a film definition cannot set them. */
const PER_SHOT_PARAMS = ['intensity', 'lightLeak'] as const;

type DefinedFilmParam = Exclude<keyof typeof FILM_PARAM_RANGES, (typeof PER_SHOT_PARAMS)[number]>;

const filmParamsSchema = z.strictObject(
  Object.fromEntries(
    Object.entries(FILM_PARAM_RANGES)
      .filter(([name]) => !(PER_SHOT_PARAMS as readonly string[]).includes(name))
      .map(([name, { min, max }]) => [name, z.number().min(min).max(max).optional()]),
  ) as Record<DefinedFilmParam, z.ZodOptional<z.ZodNumber>>,
);

const unitSchema = z.number().min(0).max(1);

/** A film's light leak: whether a shot gets one, and how strong it is (FLM-06). */
const lightLeakSchema = z
  .strictObject({
    probability: unitSchema,
    opacity: z.tuple([unitSchema, unitSchema]),
  })
  .refine(({ opacity: [min, max] }) => min <= max, 'opacity is [min, max]');

/** A film (FLM-02): parameters for the built-in `film_v1` pipeline plus an optional LUT. */
export const filmSchema = z.strictObject({
  ...contentItemBase,
  /** The shader it runs on; only shaders built into the app can be used (07 §7). */
  pipeline: z.literal('film_v1'),
  lut: assetRefSchema.optional(),
  params: filmParamsSchema,
  lightLeak: lightLeakSchema.optional(),
  /** Whether the date imprint starts switched on with this film (FLM-04). */
  dateStampByDefault: z.boolean(),
});
export type Film = z.infer<typeof filmSchema>;

/** Deterministic value in [0, 1) derived from a seed and a salt. */
function seededUnit(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * The shader parameters for one shot: the film's own values, the user's strength
 * (FLM-05) and this shot's light leak, chosen from the seed so the preview and the
 * saved photo agree.
 */
export function resolveFilmParams(
  film: Film,
  shot: { readonly intensity: number; readonly seed: number },
): FilmParams {
  const leak = film.lightLeak;
  let lightLeak = 0;
  if (leak !== undefined && seededUnit(shot.seed, 1) < leak.probability) {
    const [min, max] = leak.opacity;
    lightLeak = min + (max - min) * seededUnit(shot.seed, 2);
  }
  return normalizeFilmParams({ ...film.params, intensity: shot.intensity, lightLeak });
}
