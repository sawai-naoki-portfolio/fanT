/**
 * SkSL snippets shared by several shaders. Each shader concatenates the ones it
 * needs, so a formula (e.g. how warmth shifts colour) is written once and the
 * film look, the edit adjustments and the studio always agree.
 */

/** Rec. 709 luma weights. */
export const LUMA_SKSL = /* sksl */ `
const half3 LUMA = half3(0.2126, 0.7152, 0.0722);
`;

/** Deterministic hash in [0, 1) for a 2D cell and a seed. */
export const HASH_SKSL = /* sksl */ `
float hash(float2 p, float salt) {
  float3 p3 = fract(float3(p.xyx) * 0.1031 + salt);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;

/**
 * Colour grading with every control in [-1, 1] (fade in [0, 1]); zero leaves the
 * colour unchanged. Requires `LUMA_SKSL`.
 */
export const GRADE_SKSL = /* sksl */ `
half3 grade(half3 color, float warmth, float tint, float saturation, float contrast, float fade) {
  // Warmth: red up, blue down. Tint: magenta (positive) or green (negative).
  color += half3(warmth, 0.0, -warmth) * 0.08;
  color += half3(tint * 0.5, -tint, tint * 0.5) * 0.06;
  half luma = dot(color, LUMA);
  color = mix(half3(luma), color, half(1.0 + saturation));
  color = (color - 0.5) * half(1.0 + contrast * 0.5) + 0.5;
  // Fade: lift the blacks for a washed-out print.
  color = mix(color, color * 0.85 + 0.15, half(fade));
  return color;
}
`;

/** Soft skin likelihood (0–1) of a colour, by chroma alone so it works across skin tones. */
export const SKIN_SKSL = /* sksl */ `
// Soft skin likelihood from BT.601 chroma, ignoring deep shadows.
float skinMask(float3 c) {
  float y = dot(c, float3(0.299, 0.587, 0.114));
  float cb = 0.5 - 0.168736 * c.r - 0.331264 * c.g + 0.5 * c.b;
  float cr = 0.5 + 0.5 * c.r - 0.418688 * c.g - 0.081312 * c.b;
  float distanceToSkin = length((float2(cb, cr) - float2(0.40, 0.60)) / float2(0.10, 0.08));
  return (1.0 - smoothstep(0.7, 1.0, distanceToSkin)) * smoothstep(0.08, 0.2, y);
}
`;
