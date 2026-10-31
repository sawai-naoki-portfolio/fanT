import { defineParams, type ParamRange, type ParamValues } from '../params';

/**
 * Single source of truth for every film parameter: its bounds and default.
 * Zero turns an effect off (except `intensity`, `lutIntensity` and `grainSize`).
 */
export const FILM_PARAM_RANGES = {
  /** Blend between the original image (0) and the full film look (1) (FLM-05). */
  intensity: { min: 0, max: 1, defaultValue: 1 },
  /** How much of the film's 3D LUT is applied; 0 when the film has none. */
  lutIntensity: { min: 0, max: 1, defaultValue: 0 },
  /** Colour temperature shift: negative is cooler, positive is warmer. */
  warmth: { min: -1, max: 1, defaultValue: 0.15 },
  /** Green (negative) to magenta (positive). */
  tint: { min: -1, max: 1, defaultValue: 0 },
  saturation: { min: -1, max: 1, defaultValue: 0 },
  contrast: { min: -1, max: 1, defaultValue: 0 },
  /** Lifted blacks for a washed-out print look. */
  fade: { min: 0, max: 1, defaultValue: 0.1 },
  /** Soft glow around highlights, like a CCD sensor's bleed. */
  bloom: { min: 0, max: 1, defaultValue: 0 },
  /** Strength of this shot's light leak; the position and colour follow the seed. */
  lightLeak: { min: 0, max: 1, defaultValue: 0 },
  /** Star glints on highlights, like a purikura booth's sparkle filter (PRI-03). */
  sparkle: { min: 0, max: 1, defaultValue: 0 },
  /** Colour fringes towards the edges of the frame. */
  chromaticAberration: { min: 0, max: 1, defaultValue: 0 },
  /** Darkening towards the corners. */
  vignette: { min: 0, max: 1, defaultValue: 0.25 },
  /** Luminance-weighted film grain. */
  grain: { min: 0, max: 1, defaultValue: 0.12 },
  /** Grain cell size relative to the default. */
  grainSize: { min: 0.5, max: 3, defaultValue: 1 },
  /** Low resolution: 0 keeps every pixel, 1 drops to a few hundred pixels across. */
  lowRes: { min: 0, max: 1, defaultValue: 0 },
  /** Blocky compression artefacts and banding of an early digital camera. */
  jpegNoise: { min: 0, max: 1, defaultValue: 0 },
} as const satisfies Record<string, ParamRange>;

export type FilmParamName = keyof typeof FILM_PARAM_RANGES;

export type FilmParams = ParamValues<FilmParamName>;

const filmParams = defineParams(FILM_PARAM_RANGES);

export const DEFAULT_FILM_PARAMS: FilmParams = filmParams.defaults;

export const normalizeFilmParams = filmParams.normalize;

/** Film effects that depend on where a pixel is, or on its neighbours. */
const SPATIAL_FILM_PARAMS = [
  'bloom',
  'lightLeak',
  'sparkle',
  'chromaticAberration',
  'vignette',
  'grain',
  'lowRes',
  'jpegNoise',
] as const satisfies readonly FilmParamName[];

/**
 * Only the film's colour (LUT and grading), each pixel on its own, so it can be
 * baked into a 3D LUT for video (CAM-13).
 */
export function colorOnlyFilmParams(params: FilmParams): FilmParams {
  const spatial = Object.fromEntries(SPATIAL_FILM_PARAMS.map((name) => [name, 0]));
  return { ...params, ...spatial };
}
