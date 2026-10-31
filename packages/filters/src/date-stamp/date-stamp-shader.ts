/**
 * `date_stamp_v1`: an orange seven-segment date in the bottom-right corner, like the
 * date imprint of a 2000s compact camera (FLM-04). Drawn procedurally, so it needs
 * no font and matches on every platform.
 *
 * Glyph codes (see `DATE_STAMP_GLYPHS`): 0–9 digits, 10 space, 11 apostrophe,
 * 12 dot. Uniform names must match `DateStampUniforms`.
 */
export const DATE_STAMP_SHADER_NAME = 'date_stamp_v1';

export const DATE_STAMP_SHADER_SOURCE = /* sksl */ `
uniform shader image;
uniform float2 resolution;
uniform float4 glyphs0;
uniform float4 glyphs1;
uniform float4 glyphs2;
uniform float glyphCount;
uniform float3 color;

// Glyph height and margin as fractions of the short edge.
const float HEIGHT = 0.045;
const float MARGIN = 0.04;
const float ASPECT = 0.6;
const float SPACING = 1.25;

float segment(float2 p, float2 a, float2 b, float halfWidth) {
  float2 pa = p - a;
  float2 ba = b - a;
  float h = saturate(dot(pa, ba) / dot(ba, ba));
  return length(pa - ba * h) - halfWidth;
}

bool lit(float mask, float bit) {
  return mod(floor(mask / bit), 2.0) >= 1.0;
}

float digitMask(float code) {
  if (code < 0.5) return 63.0;
  if (code < 1.5) return 6.0;
  if (code < 2.5) return 91.0;
  if (code < 3.5) return 79.0;
  if (code < 4.5) return 102.0;
  if (code < 5.5) return 109.0;
  if (code < 6.5) return 125.0;
  if (code < 7.5) return 7.0;
  if (code < 8.5) return 127.0;
  if (code < 9.5) return 111.0;
  return 0.0;
}

// Signed distance (in pixels) to the lit parts of one glyph, in glyph-local pixels.
float glyphDistance(float code, float2 p, float w, float h) {
  float t = h * 0.07;
  float gap = t * 0.6;
  float x0 = t;
  float x1 = w - t;
  float y0 = t;
  float y1 = h * 0.5;
  float y2 = h - t;
  float d = 1e6;
  if (code > 10.5 && code < 11.5) {
    return segment(p, float2(w * 0.55, y0), float2(w * 0.45, h * 0.28), t);
  }
  if (code > 11.5) {
    return length(p - float2(w * 0.5, y2)) - t * 1.2;
  }
  float mask = digitMask(code);
  if (lit(mask, 1.0)) d = min(d, segment(p, float2(x0 + gap, y0), float2(x1 - gap, y0), t));
  if (lit(mask, 2.0)) d = min(d, segment(p, float2(x1, y0 + gap), float2(x1, y1 - gap), t));
  if (lit(mask, 4.0)) d = min(d, segment(p, float2(x1, y1 + gap), float2(x1, y2 - gap), t));
  if (lit(mask, 8.0)) d = min(d, segment(p, float2(x0 + gap, y2), float2(x1 - gap, y2), t));
  if (lit(mask, 16.0)) d = min(d, segment(p, float2(x0, y1 + gap), float2(x0, y2 - gap), t));
  if (lit(mask, 32.0)) d = min(d, segment(p, float2(x0, y0 + gap), float2(x0, y1 - gap), t));
  if (lit(mask, 64.0)) d = min(d, segment(p, float2(x0 + gap, y1), float2(x1 - gap, y1), t));
  return d;
}

half4 main(float2 coord) {
  half4 source = image.eval(coord);
  if (glyphCount < 0.5) return source;

  float shortEdge = min(resolution.x, resolution.y);
  float h = HEIGHT * shortEdge;
  float w = h * ASPECT;
  float advance = w * SPACING;
  float margin = MARGIN * shortEdge;
  float2 origin = float2(resolution.x - margin - glyphCount * advance, resolution.y - margin - h);
  float2 local = coord - origin;
  float glowRadius = h * 0.25;
  if (local.x < -glowRadius || local.y < -glowRadius || local.x > glyphCount * advance + glowRadius || local.y > h + glowRadius) {
    return source;
  }

  float d = 1e6;
  for (int i = 0; i < 4; i++) {
    if (float(i) < glyphCount) d = min(d, glyphDistance(glyphs0[i], local - float2(float(i) * advance, 0.0), w, h));
  }
  for (int i = 0; i < 4; i++) {
    if (float(i + 4) < glyphCount) d = min(d, glyphDistance(glyphs1[i], local - float2(float(i + 4) * advance, 0.0), w, h));
  }
  for (int i = 0; i < 4; i++) {
    if (float(i + 8) < glyphCount) d = min(d, glyphDistance(glyphs2[i], local - float2(float(i + 8) * advance, 0.0), w, h));
  }

  half3 base = unpremul(source).rgb;
  half3 ink = half3(color);
  half core = half(smoothstep(1.0, -1.0, d));
  half glow = half(exp(-max(d, 0.0) / glowRadius) * 0.45);
  // A slightly lighter centre, like a glowing LED.
  half3 lit = mix(ink, half3(1.0, 0.92, 0.75), 0.25);
  half3 result = mix(base, lit, core) + ink * glow * (1.0 - core);
  return half4(saturate(result) * source.a, source.a);
}
`;
