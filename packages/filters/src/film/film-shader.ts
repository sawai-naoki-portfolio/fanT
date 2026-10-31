import { GRADE_SKSL, HASH_SKSL, LUMA_SKSL } from '../sksl';

/**
 * `film_v1`: the film look applied on top of the (retouched) camera image (FLM-03).
 *
 * Children: `image` (the source) and `lut` (a 3D LUT laid out as `lutSize` slices of
 * `lutSize`×`lutSize` side by side, blue selecting the slice; see `identityLut`).
 * Every size is relative to the frame, so the preview and the full-resolution photo
 * look the same, and every random pattern follows `seed` (FLM-06).
 *
 * Uniform names must match `FilmUniforms`; a test compiles this source and checks
 * that the two stay in sync.
 */
export const FILM_SHADER_NAME = 'film_v1';

export const FILM_SHADER_SOURCE = /* sksl */ `
uniform shader image;
uniform shader lut;
uniform float2 resolution;
uniform float seed;
uniform float lutSize;
uniform float intensity;
uniform float lutIntensity;
uniform float warmth;
uniform float tint;
uniform float saturation;
uniform float contrast;
uniform float fade;
uniform float bloom;
uniform float lightLeak;
uniform float sparkle;
uniform float chromaticAberration;
uniform float vignette;
uniform float grain;
uniform float grainSize;
uniform float lowRes;
uniform float jpegNoise;
uniform float quality;
${LUMA_SKSL}
${HASH_SKSL}
${GRADE_SKSL}
// Grain cells along the short edge at grainSize 1.
const float GRAIN_CELLS = 1080.0;
// Long edge, in blocks, at lowRes 1.
const float LOW_RES_EDGE = 320.0;
const float BLOOM_RADIUS = 0.02;
const float BLOOM_THRESHOLD = 0.7;
const float ABERRATION = 0.006;
const float SPARKLE_CELL = 0.06;

half3 sampleRgb(float2 p) {
  return unpremul(image.eval(p)).rgb;
}

half3 applyLut(half3 color) {
  float last = lutSize - 1.0;
  float blue = saturate(float(color.b)) * last;
  float slice = floor(blue);
  float2 rg = saturate(float2(color.rg)) * last + 0.5;
  half3 lower = lut.eval(float2(slice * lutSize + rg.x, rg.y)).rgb;
  half3 upper = lut.eval(float2(min(slice + 1.0, last) * lutSize + rg.x, rg.y)).rgb;
  return mix(lower, upper, half(blue - slice));
}

// A warm glow entering from one side of the frame, placed by the seed.
half3 leakColor(float2 uv) {
  float side = hash(float2(1.0, 2.0), seed);
  float along = hash(float2(3.0, 4.0), seed);
  float2 center = side < 0.5 ? float2(side < 0.25 ? -0.1 : 1.1, along) : float2(along, side < 0.75 ? -0.1 : 1.1);
  float radius = mix(0.35, 0.6, hash(float2(5.0, 6.0), seed));
  float glow = exp(-pow(distance(uv, center) / radius, 2.0) * 2.0);
  half3 hot = mix(half3(1.0, 0.35, 0.1), half3(1.0, 0.75, 0.3), half(hash(float2(7.0, 8.0), seed)));
  return hot * half(glow);
}

// Four-pointed star glints centred in random cells over bright areas.
half sparkleAt(float2 coord, float shortEdge) {
  float cellSize = SPARKLE_CELL * shortEdge;
  float2 cell = floor(coord / cellSize);
  if (hash(cell, seed + 0.37) > 0.2) return 0.0;
  float2 center = (cell + 0.25 + 0.5 * float2(hash(cell, seed + 0.11), hash(cell, seed + 0.23))) * cellSize;
  // Bright areas only (lights, sky, white clothes), sparse.
  half brightness = smoothstep(0.76, 0.95, dot(sampleRgb(center), LUMA));
  float2 d = abs(coord - center) / (cellSize * 0.25);
  float star = max(max(0.0, 1.0 - d.x) * exp(-d.y * 12.0), max(0.0, 1.0 - d.y) * exp(-d.x * 12.0));
  float core = exp(-dot(d, d) * 20.0);
  return brightness * half(saturate(star + core));
}

half4 main(float2 coord) {
  half4 source = image.eval(coord);
  half alpha = source.a;
  float shortEdge = min(resolution.x, resolution.y);
  float longEdge = max(resolution.x, resolution.y);
  float2 uv = coord / resolution;

  // Low resolution: sample one point per block.
  float2 p = coord;
  float block = 1.0;
  if (lowRes > 0.0) {
    block = max(1.0, longEdge / mix(longEdge, LOW_RES_EDGE, lowRes));
    p = (floor(coord / block) + 0.5) * block;
  }

  half3 color;
  if (chromaticAberration > 0.0) {
    float2 shift = (uv - 0.5) * chromaticAberration * ABERRATION * shortEdge * 2.0;
    color = half3(sampleRgb(p + shift).r, sampleRgb(p).g, sampleRgb(p - shift).b);
  } else {
    color = sampleRgb(p);
  }
  half3 original = unpremul(source).rgb;

  if (lutIntensity > 0.0) {
    color = mix(color, applyLut(color), half(lutIntensity));
  }
  color = grade(color, warmth, tint, saturation, contrast, fade);

  if (bloom > 0.0) {
    float radius = BLOOM_RADIUS * shortEdge;
    half3 glow = half3(0.0);
    // Reduced quality samples every other tap and doubles their weight.
    float tapWeight = quality < 0.5 ? 2.0 : 1.0;
    for (int i = 0; i < 8; i++) {
      if (quality < 0.5 && mod(float(i), 2.0) > 0.5) continue;
      float angle = float(i) * 0.785398;
      half3 s = sampleRgb(p + radius * float2(cos(angle), sin(angle)));
      glow += s * max(dot(s, LUMA) - half(BLOOM_THRESHOLD), 0.0) * half(tapWeight);
    }
    color += glow * half(bloom * 0.6);
  }

  if (lightLeak > 0.0) {
    half3 leak = leakColor(uv) * half(lightLeak);
    color = 1.0 - (1.0 - saturate(color)) * (1.0 - leak);
  }

  if (sparkle > 0.0) {
    color += sparkleAt(coord, shortEdge) * half(sparkle) * 1.5;
  }

  if (jpegNoise > 0.0) {
    float2 jpegBlock = floor(coord / (block * 8.0));
    half3 blockShift = half3(hash(jpegBlock, seed + 0.5), hash(jpegBlock, seed + 0.6), hash(jpegBlock, seed + 0.7)) - 0.5;
    color += blockShift * half(jpegNoise) * 0.06;
    half levels = half(mix(64.0, 10.0, jpegNoise));
    color = floor(saturate(color) * levels + 0.5) / levels;
  }

  // Grain: stronger in the shadows than in the highlights.
  if (grain > 0.0) {
    half luma = dot(color, LUMA);
    float2 grainCell = floor(coord * (GRAIN_CELLS / (shortEdge * grainSize)));
    half noise = half(hash(grainCell, seed) - 0.5);
    color += noise * half(grain) * 0.25 * (1.0 - luma * 0.5);
  }

  float edge = smoothstep(0.35, 0.85, distance(uv, float2(0.5)));
  color *= half(1.0 - vignette * edge);

  color = mix(original, saturate(color), half(intensity));
  return half4(color * alpha, alpha);
}
`;
