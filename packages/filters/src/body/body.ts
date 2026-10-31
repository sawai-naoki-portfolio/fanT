import { assertFrameSize } from '../frame';
import { defineParams, type ParamRange, type ParamValues } from '../params';

/**
 * Body reshaping in the editor (EDT-13), kept subtle: legs at most about 12%
 * longer, the body at most about 8% narrower around its middle.
 */
export const BODY_PARAM_RANGES = {
  /** Longer legs: the photo below `legLine` is stretched downwards. */
  legs: { min: 0, max: 1, defaultValue: 0 },
  /** Where the legs start, as a fraction of the photo's height. */
  legLine: { min: 0, max: 1, defaultValue: 0.6 },
  /** A narrower body around `bodyX`. */
  slim: { min: 0, max: 1, defaultValue: 0 },
  /** The body's middle, as a fraction of the photo's width. */
  bodyX: { min: 0, max: 1, defaultValue: 0.5 },
} as const satisfies Record<string, ParamRange>;

export type BodyParamName = keyof typeof BODY_PARAM_RANGES;
export type BodyParams = ParamValues<BodyParamName>;

const bodyParams = defineParams(BODY_PARAM_RANGES);
export const DEFAULT_BODY_PARAMS: BodyParams = bodyParams.defaults;
export const normalizeBodyParams = bodyParams.normalize;

/** Whether the body is reshaped at all (the line and the middle alone change nothing). */
export function reshapesBody(params: BodyParams): boolean {
  'worklet';
  return params.legs > 0 || params.slim > 0;
}

export type BodyUniforms = BodyParams & { readonly resolution: readonly [number, number] };

/** Marked as a worklet so it can run on the camera frame thread. */
export function toBodyUniforms(
  params: BodyParams,
  frame: { readonly width: number; readonly height: number },
): BodyUniforms {
  'worklet';
  assertFrameSize(frame.width, frame.height);
  return { ...params, resolution: [frame.width, frame.height] };
}

export const BODY_SHADER_NAME = 'body_v1';

/**
 * `body_v1`: a backward warp. Below the leg line the photo is sampled closer to the
 * line (stretched, the bottom edge cropped); around the body's middle it is sampled
 * farther out (narrower), fading to nothing towards the sides.
 */
export const BODY_SHADER_SOURCE = /* sksl */ `
uniform shader image;
uniform float2 resolution;
uniform float legs;
uniform float legLine;
uniform float slim;
uniform float bodyX;

const float MAX_LEGS = 0.12;
const float MAX_SLIM = 0.08;
// Half-width of the slimmed band as a fraction of the photo's width.
const float BAND = 0.28;

half4 main(float2 coord) {
  float2 uv = coord / resolution;
  if (legs > 0.0 && uv.y > legLine) {
    uv.y = legLine + (uv.y - legLine) / (1.0 + legs * MAX_LEGS);
  }
  if (slim > 0.0) {
    float d = (uv.x - bodyX) / BAND;
    float falloff = exp(-d * d * 2.0);
    uv.x += (uv.x - bodyX) * slim * MAX_SLIM * falloff;
  }
  return image.eval(uv * resolution);
}
`;
