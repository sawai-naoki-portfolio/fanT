import { LUMA_SKSL } from '../sksl';

export const EXPOSURE_FUSION_SHADER_NAME = 'exposure_fusion_v1';

const PHOTOS = ['first', 'second', 'third'] as const;

/**
 * The average of a ring and its centre: a photo's level around 'coord'. SkSL
 * cannot pass a shader to a function, so there is one per child.
 */
const aroundSksl = (photo: (typeof PHOTOS)[number]) => /* sksl */ `
half3 around_${photo}(float2 coord, float r) {
  half3 sum = unpremul(${photo}.eval(coord)).rgb;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    sum += unpremul(${photo}.eval(coord + float2(cos(a), sin(a)) * r)).rgb;
  }
  return sum / 9.0;
}
`;

/** Uniforms of the exposure fusion shader. */
export interface ExposureFusionUniforms {
  readonly resolution: readonly [number, number];
  /** How many of the three children are distinct photos (2 or 3). */
  readonly count: number;
}

/**
 * `exposure_fusion_v1`: merges two or three aligned exposures of one scene into
 * one photo (EDT-26). Each pixel is a weighted mix, weighted by how well exposed
 * and how colourful each photo is around it (a single-scale take on Mertens'
 * exposure fusion); judging the surroundings rather than the pixel alone keeps
 * the mix from changing abruptly, which would show as halos and seams.
 */
export const EXPOSURE_FUSION_SHADER_SOURCE = /* sksl */ `
uniform shader first;
uniform shader second;
uniform shader third;
uniform float2 resolution;
uniform float count;
${LUMA_SKSL}
// How far around a pixel its exposure is judged, as a fraction of the short edge.
const float SPREAD = 0.012;

${PHOTOS.map(aroundSksl).join('')}
half weightOf(half3 local) {
  half luma = dot(local, LUMA);
  half exposed = exp(-(luma - 0.5) * (luma - 0.5) / 0.08);
  half colourful = max(max(local.r, local.g), local.b) - min(min(local.r, local.g), local.b);
  return exposed * (0.2 + colourful) + 1e-4;
}

half4 main(float2 coord) {
  float r = max(2.0, SPREAD * min(resolution.x, resolution.y));
  half3 a = unpremul(first.eval(coord)).rgb;
  half3 b = unpremul(second.eval(coord)).rgb;
  half wa = weightOf(around_first(coord, r));
  half wb = weightOf(around_second(coord, r));
  half3 sum = a * wa + b * wb;
  half total = wa + wb;
  if (count > 2.5) {
    half3 c = unpremul(third.eval(coord)).rgb;
    half wc = weightOf(around_third(coord, r));
    sum += c * wc;
    total += wc;
  }
  return half4(saturate(sum / total), 1.0);
}
`;
