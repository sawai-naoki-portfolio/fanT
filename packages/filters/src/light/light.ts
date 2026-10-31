import { assertFrameSize } from '../frame';
import { defineParams, type ParamRange, type ParamValues } from '../params';
import { HASH_SKSL, LUMA_SKSL } from '../sksl';

/**
 * Light and weather added to a scene (EDT-24): sun rays and a lens flare from a
 * light source, mist, rain and snow. Each is a strength; zero adds nothing.
 */
export const LIGHT_PARAM_RANGES = {
  rays: { min: 0, max: 1, defaultValue: 0 },
  flare: { min: 0, max: 1, defaultValue: 0 },
  fog: { min: 0, max: 1, defaultValue: 0 },
  rain: { min: 0, max: 1, defaultValue: 0 },
  snow: { min: 0, max: 1, defaultValue: 0 },
  /** Where rays and the flare come from, as fractions of the photo (the sun). */
  sourceX: { min: 0, max: 1, defaultValue: 0.75 },
  sourceY: { min: 0, max: 1, defaultValue: 0.15 },
} as const satisfies Record<string, ParamRange>;

export type LightParamName = keyof typeof LIGHT_PARAM_RANGES;
export type LightParams = ParamValues<LightParamName>;

const lightParams = defineParams(LIGHT_PARAM_RANGES);
export const DEFAULT_LIGHT_PARAMS: LightParams = lightParams.defaults;
export const normalizeLightParams = lightParams.normalize;

/** The strengths: the source position alone adds nothing. */
export const LIGHT_EFFECTS = ['rays', 'flare', 'fog', 'rain', 'snow'] as const;

/** Whether any light or weather is added at all. */
export function addsLight(params: LightParams): boolean {
  'worklet';
  return (
    params.rays > 0 || params.flare > 0 || params.fog > 0 || params.rain > 0 || params.snow > 0
  );
}

export type LightUniforms = Omit<LightParams, 'sourceX' | 'sourceY'> & {
  readonly resolution: readonly [number, number];
  readonly source: readonly [number, number];
  readonly seed: number;
};

/** Marked as a worklet so it can run on the camera frame thread. */
export function toLightUniforms(
  params: LightParams,
  frame: { readonly width: number; readonly height: number; readonly seed: number },
): LightUniforms {
  'worklet';
  assertFrameSize(frame.width, frame.height);
  return {
    rays: params.rays,
    flare: params.flare,
    fog: params.fog,
    rain: params.rain,
    snow: params.snow,
    resolution: [frame.width, frame.height],
    source: [params.sourceX, params.sourceY],
    seed: frame.seed,
  };
}

export const LIGHT_SHADER_NAME = 'light_v1';

/**
 * `light_v1`: everything is measured in short-edge units, so it looks the same at
 * any size, and drawn from the shot's seed, so the preview and the photo match.
 */
export const LIGHT_SHADER_SOURCE = /* sksl */ `
uniform shader image;
uniform float2 resolution;
uniform float2 source;
uniform float seed;
uniform float rays;
uniform float flare;
uniform float fog;
uniform float rain;
uniform float snow;
${LUMA_SKSL}
${HASH_SKSL}
const half3 SUNLIGHT = half3(1.0, 0.9, 0.72);
const half3 MIST = half3(0.88, 0.9, 0.94);

// Smooth 1D noise: streaks of light around the source.
float streaks(float angle) {
  float x = angle * 9.0;
  float i = floor(x);
  float f = fract(x);
  return mix(hash(float2(i, 0.0), seed), hash(float2(i + 1.0, 0.0), seed), f * f * (3.0 - 2.0 * f));
}

// A soft ring or disc of the flare, 'radius' in short-edge units.
float ghost(float2 p, float2 centre, float radius) {
  float d = length(p - centre) / radius;
  return (1.0 - smoothstep(0.7, 1.0, d)) * (0.4 + 0.6 * smoothstep(0.3, 1.0, d));
}

// Thin slanted rain streaks in a grid of columns.
float rainAt(float2 p) {
  float2 q = float2(p.x + p.y * 0.15, p.y);
  float column = floor(q.x * 90.0);
  float offset = hash(float2(column, 1.0), seed);
  float along = fract(q.y * 3.0 + offset * 7.0);
  float across = abs(fract(q.x * 90.0) - 0.5);
  float drop = step(0.72, hash(float2(column, floor(q.y * 3.0 + offset * 7.0)), seed));
  return drop * (1.0 - smoothstep(0.04, 0.12, across)) * smoothstep(0.0, 0.3, along)
    * (1.0 - smoothstep(0.6, 1.0, along));
}

// Round flakes, near and far: one in some cells of each grid.
float snowAt(float2 p) {
  float flakes = 0.0;
  for (int layer = 0; layer < 2; layer++) {
    float cells = layer == 0 ? 14.0 : 30.0;
    float2 cell = floor(p * cells);
    float2 inCell = fract(p * cells);
    float salt = float(layer) * 17.0;
    float2 at = float2(hash(cell, seed + salt), hash(cell + 3.1, seed + salt));
    float size = (layer == 0 ? 0.16 : 0.1) * (0.5 + hash(cell + 7.7, seed + salt));
    float present = step(0.45, hash(cell + 11.3, seed + salt));
    flakes += present * (1.0 - smoothstep(size * 0.5, size, length(inCell - at)));
  }
  return saturate(flakes);
}

half4 main(float2 coord) {
  half4 original = unpremul(image.eval(coord));
  half3 color = original.rgb;
  float shortEdge = min(resolution.x, resolution.y);
  float2 p = coord / shortEdge;
  float2 sun = source * resolution / shortEdge;
  float2 fromSun = p - sun;
  float distance = length(fromSun);

  if (fog > 0.0) {
    // Thicker towards the bottom, where the distance (and the ground mist) is.
    float height = coord.y / resolution.y;
    half amount = half(fog * (0.35 + 0.45 * height));
    color = mix(color, MIST, amount);
  }
  if (rays > 0.0) {
    float streak = streaks(atan(fromSun.y, fromSun.x));
    float light = streak * streak * exp(-distance * 1.6) * 0.8 + exp(-distance * 7.0) * 0.6;
    color += SUNLIGHT * half(rays * light);
  }
  if (flare > 0.0) {
    float2 centre = resolution * 0.5 / shortEdge;
    float2 axis = centre - sun;
    float glow = ghost(p, sun + axis * 0.6, 0.05) * 0.35 + ghost(p, sun + axis * 1.25, 0.09) * 0.25
      + ghost(p, sun + axis * 1.7, 0.03) * 0.4 + ghost(p, sun + axis * 2.1, 0.14) * 0.15;
    color += half3(0.75, 0.85, 1.0) * half(flare * glow) + SUNLIGHT * half(flare * exp(-distance * 12.0));
  }
  if (rain > 0.0) {
    // Darker, wetter air, then the streaks.
    color *= half(1.0 - rain * 0.15);
    color += half3(0.75, 0.8, 0.85) * half(rain * 0.55 * rainAt(p));
  }
  if (snow > 0.0) {
    color = mix(color, half3(1.0), half(snow * snowAt(p)));
  }
  return half4(saturate(color) * original.a, original.a);
}
`;
