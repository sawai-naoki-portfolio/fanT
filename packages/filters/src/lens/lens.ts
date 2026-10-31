import { assertFrameSize } from '../frame';
import { defineParams, type ParamRange, type ParamValues } from '../params';
import { LUMA_SKSL } from '../sksl';

/**
 * Corrections of the camera itself (EDT-20), before every creative edit: lens
 * distortion, the darkening towards the corners and sensor noise. Zero changes nothing.
 */
export const LENS_PARAM_RANGES = {
  /** Positive straightens bulging (barrel) lines, negative pinched (pincushion) ones. */
  distortion: { min: -1, max: 1, defaultValue: 0 },
  /** Positive brightens dark corners, negative darkens them. */
  vignette: { min: -1, max: 1, defaultValue: 0 },
  /** Smooths grainy brightness while keeping edges (night scenes, starry skies). */
  noise: { min: 0, max: 1, defaultValue: 0 },
  /** Smooths blotchy colour speckles. */
  colorNoise: { min: 0, max: 1, defaultValue: 0 },
} as const satisfies Record<string, ParamRange>;

export type LensParamName = keyof typeof LENS_PARAM_RANGES;
export type LensParams = ParamValues<LensParamName>;

const lensParams = defineParams(LENS_PARAM_RANGES);
export const DEFAULT_LENS_PARAMS: LensParams = lensParams.defaults;
export const normalizeLensParams = lensParams.normalize;

export type LensUniforms = LensParams & { readonly resolution: readonly [number, number] };

/** Marked as a worklet so it can run on the camera frame thread. */
export function toLensUniforms(
  params: LensParams,
  frame: { readonly width: number; readonly height: number },
): LensUniforms {
  'worklet';
  assertFrameSize(frame.width, frame.height);
  return { ...params, resolution: [frame.width, frame.height] };
}

export const LENS_SHADER_NAME = 'lens_v1';

/**
 * `lens_v1`: every sample is taken through the distortion correction, which only
 * zooms in, so no edge is left empty. Noise reduction averages neighbours whose
 * brightness is close (edges survive) and blurs colour over a wider area.
 */
export const LENS_SHADER_SOURCE = /* sksl */ `
uniform shader image;
uniform float2 resolution;
uniform float distortion;
uniform float vignette;
uniform float noise;
uniform float colorNoise;
${LUMA_SKSL}
// Neighbour distance for noise reduction, as a fraction of the short edge.
const float NOISE_RADIUS = 0.0015;

// Where an output pixel is sampled: radially scaled, normalised so the corners
// stay inside the photo whichever way the correction goes.
float2 warp(float2 coord) {
  if (distortion == 0.0) return coord;
  float2 centre = resolution * 0.5;
  float2 d = (coord - centre) / length(centre);
  float k = -distortion * 0.18;
  float scale = (1.0 + k * dot(d, d)) / (1.0 + max(k, 0.0));
  return centre + (coord - centre) * scale;
}

half3 src(float2 coord) {
  return unpremul(image.eval(warp(coord))).rgb;
}

half4 main(float2 coord) {
  half4 source = unpremul(image.eval(warp(coord)));
  half3 color = source.rgb;

  if (noise > 0.0 || colorNoise > 0.0) {
    float r = max(1.0, NOISE_RADIUS * min(resolution.x, resolution.y));
    half luma = dot(color, LUMA);
    // Brightness: a small bilateral filter over the 8 neighbours.
    half sigma = half(0.02 + noise * 0.1);
    half sum = luma;
    half total = 1.0;
    half3 chroma = color - luma;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.785398;
      half3 c = src(coord + float2(cos(a), sin(a)) * r * (1.0 + float(i - (i / 2) * 2)));
      half l = dot(c, LUMA);
      half w = exp(-(l - luma) * (l - luma) / (2.0 * sigma * sigma));
      sum += l * w;
      total += w;
      chroma += (c - l);
    }
    half smoothed = sum / total;
    luma = mix(luma, smoothed, half(noise));
    color = luma + mix(color - dot(color, LUMA), chroma / 9.0, half(colorNoise));
  }

  if (vignette != 0.0) {
    float2 d = (coord - resolution * 0.5) / length(resolution * 0.5);
    float falloff = dot(d, d);
    color *= half(1.0 + vignette * 0.7 * falloff * falloff);
  }

  return half4(saturate(color) * source.a, source.a);
}
`;
