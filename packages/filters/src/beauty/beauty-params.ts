import { defineParams, type ParamRange, type ParamValues } from '../params';

/** Single source of truth for every beauty parameter: its bounds and default. */
export const BEAUTY_PARAM_RANGES = {
  /** Edge-preserving smoothing applied to skin only. */
  smoothing: { min: 0, max: 1, defaultValue: 0.55 },
  /** Brightens skin. */
  brightness: { min: 0, max: 1, defaultValue: 0.15 },
  /** Adds a healthy flush to skin. */
  rosiness: { min: 0, max: 1, defaultValue: 0.1 },
} as const satisfies Record<string, ParamRange>;

export type BeautyParamName = keyof typeof BEAUTY_PARAM_RANGES;

export type BeautyParams = ParamValues<BeautyParamName>;

const beautyParams = defineParams(BEAUTY_PARAM_RANGES);

/** The natural look ("medium") the app starts with. */
export const DEFAULT_BEAUTY_PARAMS: BeautyParams = beautyParams.defaults;

export const normalizeBeautyParams = beautyParams.normalize;

/** User-facing strength presets: off / low / medium / high. */
export const BEAUTY_LEVELS = {
  off: { smoothing: 0, brightness: 0, rosiness: 0 },
  low: { smoothing: 0.3, brightness: 0.08, rosiness: 0.05 },
  medium: DEFAULT_BEAUTY_PARAMS,
  high: { smoothing: 0.8, brightness: 0.22, rosiness: 0.15 },
} as const satisfies Record<string, BeautyParams>;

export type BeautyLevel = keyof typeof BEAUTY_LEVELS;
