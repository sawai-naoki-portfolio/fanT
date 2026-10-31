import { SKIN_SKSL } from '../sksl';

/**
 * `beauty_v1`: natural skin retouching applied before the film look.
 *
 * Skin is found by chroma alone (so it works across skin tones and lighting), then
 * smoothed with an edge-preserving filter that keeps eyes, brows and contours sharp.
 * Uniform names must match `BeautyUniforms`; a test checks that they stay in sync.
 */
export const BEAUTY_SHADER_NAME = 'beauty_v1';

export const BEAUTY_SHADER_SOURCE = /* sksl */ `
uniform shader image;
uniform float2 resolution;
uniform float smoothing;
uniform float brightness;
uniform float rosiness;
uniform float quality;

const half3 LUMA = half3(0.2126, 0.7152, 0.0722);
// Blur radius as a fraction of the short edge: the same look in the preview
// and in the full-resolution photo.
const float RADIUS_FRACTION = 0.006;
// Luma difference beyond which a neighbour stops contributing (keeps edges).
const float RANGE_SIGMA = 0.08;
const int RING_SAMPLES = 8;
// Share of the original texture kept even at full smoothing, so skin is not plastic.
const float TEXTURE_KEPT = 0.15;

${SKIN_SKSL}
half4 main(float2 coord) {
  half4 source = unpremul(image.eval(coord));
  float3 color = float3(source.rgb);
  float mask = skinMask(color);

  float amount = smoothing * mask;
  if (amount > 0.001) {
    float radius = RADIUS_FRACTION * min(resolution.x, resolution.y);
    float centerLuma = dot(color, float3(LUMA));
    float3 sum = color;
    float weightSum = 1.0;
    for (int ring = 1; ring <= 2; ring++) {
      if (ring == 2 && quality < 0.5) break;
      float ringRadius = radius * float(ring) * 0.5;
      float ringWeight = ring == 1 ? 1.0 : 0.6;
      for (int i = 0; i < RING_SAMPLES; i++) {
        float angle = (float(i) + 0.5 * float(ring)) * 6.2831853 / float(RING_SAMPLES);
        float3 neighbour = float3(unpremul(image.eval(coord + ringRadius * float2(cos(angle), sin(angle)))).rgb);
        float difference = dot(neighbour, float3(LUMA)) - centerLuma;
        float weight = ringWeight * exp(-(difference * difference) / (2.0 * RANGE_SIGMA * RANGE_SIGMA));
        sum += neighbour * weight;
        weightSum += weight;
      }
    }
    color = mix(color, sum / weightSum, amount * (1.0 - TEXTURE_KEPT));
  }

  // Skin-only tone: lift brightness, then add a little warmth to the cheeks.
  color += brightness * mask * 0.12;
  color += rosiness * mask * float3(0.06, -0.02, 0.0);

  return half4(half3(saturate(color)) * source.a, source.a);
}
`;
