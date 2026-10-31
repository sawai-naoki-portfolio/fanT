import { defineParams, type ParamRange, type ParamValues } from '../params';
import { GRADE_SKSL, LUMA_SKSL } from '../sksl';

/** Basic corrections in the editor (EDT-03); zero leaves the photo unchanged. */
export const ADJUST_PARAM_RANGES = {
  /** Exposure in stops, scaled: ±1 is about ±1 stop. */
  brightness: { min: -1, max: 1, defaultValue: 0 },
  contrast: { min: -1, max: 1, defaultValue: 0 },
  saturation: { min: -1, max: 1, defaultValue: 0 },
  /** Colour temperature: negative is cooler, positive is warmer. */
  temperature: { min: -1, max: 1, defaultValue: 0 },
  /** Colour cast across the other axis: negative is greener, positive more magenta (EDT-31). */
  tint: { min: -1, max: 1, defaultValue: 0 },
} as const satisfies Record<string, ParamRange>;

export type AdjustParamName = keyof typeof ADJUST_PARAM_RANGES;

export type AdjustParams = ParamValues<AdjustParamName>;

const adjustParams = defineParams(ADJUST_PARAM_RANGES);

export const DEFAULT_ADJUST_PARAMS: AdjustParams = adjustParams.defaults;

export const normalizeAdjustParams = adjustParams.normalize;

export const ADJUST_SHADER_NAME = 'adjust_v1';

/** Uses the same grading formula as the film look, so "warmer" means the same in both. */
export const ADJUST_SHADER_SOURCE = /* sksl */ `
uniform shader image;
uniform float brightness;
uniform float contrast;
uniform float saturation;
uniform float temperature;
uniform float tint;
${LUMA_SKSL}
${GRADE_SKSL}
half4 main(float2 coord) {
  half4 source = unpremul(image.eval(coord));
  half3 color = source.rgb * half(exp2(brightness));
  color = grade(color, temperature, tint, saturation, contrast, 0.0);
  return half4(saturate(color) * source.a, source.a);
}
`;
