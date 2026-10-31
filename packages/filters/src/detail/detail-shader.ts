import { GRADE_SKSL, LUMA_SKSL } from '../sksl';

/**
 * `detail_v1`: the editor's detailed adjustments, after the basic ones and the
 * skin retouching: sharpening (EDT-07), clarity and dehaze (EDT-15), local areas
 * and graduated filters (EDT-10, EDT-17), the tone curve (EDT-09), highlights and shadows, colour bands (EDT-08),
 * colour grading (EDT-21), sky and sunset (EDT-15), and vibrance.
 *
 * Uniform names must match `DetailUniforms`; a test checks that they stay in sync.
 */
export const DETAIL_SHADER_NAME = 'detail_v1';

export const DETAIL_SHADER_SOURCE = /* sksl */ `
uniform shader image;
uniform float2 resolution;
uniform float sharpen;
uniform float highlights;
uniform float shadows;
uniform float vibrance;
uniform float dehaze;
uniform float clarity;
uniform float sky;
uniform float sunset;
uniform float4 gradeHues;
uniform float4 gradeAmounts;
// Tone curves: shadows, darks, lights, highlights; brightness, then per channel.
uniform float4 curve;
uniform float4 curveRed;
uniform float4 curveGreen;
uniform float4 curveBlue;
// Blacks and whites (EDT-31).
uniform float2 levels;
// Colour bands red, orange, yellow, green (A) and aqua, blue, purple, magenta (B).
uniform float4 hueA;
uniform float4 hueB;
uniform float4 saturationA;
uniform float4 saturationB;
uniform float4 luminanceA;
uniform float4 luminanceB;
// Local areas: (x, y, radius, feather) in photo fractions and (brightness,
// saturation, temperature, shape): shape 0 is empty, 1 a circle, 2 a graduated
// filter whose direction is in 'localAngles'.
uniform float4 localAngles;
uniform float4 local0Area;
uniform float4 local0Adjust;
uniform float4 local1Area;
uniform float4 local1Adjust;
uniform float4 local2Area;
uniform float4 local2Adjust;
uniform float4 local3Area;
uniform float4 local3Adjust;
${LUMA_SKSL}
${GRADE_SKSL}
// Sharpening radius as a fraction of the short edge, the same in preview and photo.
const float SHARPEN_RADIUS = 0.0012;
// Clarity and dehaze compare a pixel with its surroundings at this radius.
const float SURROUND_RADIUS = 0.012;
// The colour mist fades towards when dehaze is negative.
const half3 MIST = half3(0.86, 0.89, 0.93);

half3 rgbToHsv(half3 c) {
  half4 k = half4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  half4 p = mix(half4(c.bg, k.wz), half4(c.gb, k.xy), step(c.b, c.g));
  half4 q = mix(half4(p.xyw, c.r), half4(c.r, p.yzx), step(p.x, c.r));
  half d = q.x - min(q.w, q.y);
  half e = 1.0e-4;
  return half3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

half3 hsvToRgb(half3 c) {
  half4 k = half4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  half3 p = abs(fract(c.xxx + k.xyz) * 6.0 - k.www);
  return c.z * mix(k.xxx, saturate(p - k.xxx), c.y);
}

// How much a hue (0-1) belongs to a band centred at 'centre' with half-width 'width'.
half bandWeight(half hue, half centre, half width) {
  half d = abs(hue - centre);
  d = min(d, 1.0 - d);
  return saturate(1.0 - d / width);
}

half3 colourBands(half3 color) {
  half3 hsv = rgbToHsv(saturate(color));
  // Grey has no hue: the bands fade out as saturation drops.
  half amount = smoothstep(0.05, 0.3, hsv.y);
  if (amount <= 0.0) return color;
  half4 wA = half4(
    bandWeight(hsv.x, 0.0, 0.07), bandWeight(hsv.x, 0.083, 0.06),
    bandWeight(hsv.x, 0.16, 0.08), bandWeight(hsv.x, 0.33, 0.12));
  half4 wB = half4(
    bandWeight(hsv.x, 0.5, 0.1), bandWeight(hsv.x, 0.61, 0.1),
    bandWeight(hsv.x, 0.75, 0.08), bandWeight(hsv.x, 0.88, 0.08));
  half total = dot(wA, half4(1.0)) + dot(wB, half4(1.0));
  if (total <= 0.0) return color;
  wA /= total;
  wB /= total;
  half hueShift = dot(wA, half4(hueA)) + dot(wB, half4(hueB));
  half satShift = dot(wA, half4(saturationA)) + dot(wB, half4(saturationB));
  half lumShift = dot(wA, half4(luminanceA)) + dot(wB, half4(luminanceB));
  hsv.x = fract(hsv.x + hueShift * 0.08 * amount);
  hsv.y = saturate(hsv.y * (1.0 + satShift * amount));
  hsv.z = saturate(hsv.z * (1.0 + lumShift * 0.3 * amount));
  return hsvToRgb(hsv);
}

// The average colour on a ring of radius 'r' around 'coord'.
half3 surroundOf(float2 coord, float r) {
  float d = r * 0.7071;
  half3 sum = unpremul(image.eval(coord + float2(r, 0.0))).rgb
    + unpremul(image.eval(coord - float2(r, 0.0))).rgb
    + unpremul(image.eval(coord + float2(0.0, r))).rgb
    + unpremul(image.eval(coord - float2(0.0, r))).rgb
    + unpremul(image.eval(coord + float2(d, d))).rgb
    + unpremul(image.eval(coord - float2(d, d))).rgb
    + unpremul(image.eval(coord + float2(d, -d))).rgb
    + unpremul(image.eval(coord - float2(d, -d))).rgb;
  return sum * 0.125;
}

// Blue skies get deeper (positive) or paler (negative); clouds and blue clothes
// low in the frame are mostly left alone.
half3 skyTone(half3 color, float2 uv) {
  half3 hsv = rgbToHsv(saturate(color));
  half weight = bandWeight(hsv.x, 0.58, 0.11) * smoothstep(0.08, 0.25, hsv.y)
    * smoothstep(0.2, 0.45, hsv.z) * half(mix(0.5, 1.0, 1.0 - uv.y));
  if (weight <= 0.0) return color;
  hsv.y = saturate(hsv.y * (1.0 + half(sky) * 0.8 * weight));
  hsv.z = saturate(hsv.z * (1.0 - half(sky) * 0.15 * weight));
  return hsvToRgb(hsv);
}

// Warm colours richer and a golden glow in the highlights (positive), or cooler.
half3 sunsetTone(half3 color) {
  half3 hsv = rgbToHsv(saturate(color));
  half warm = max(bandWeight(hsv.x, 0.06, 0.12), bandWeight(hsv.x, 0.97, 0.05))
    * smoothstep(0.05, 0.2, hsv.y);
  hsv.y = saturate(hsv.y * (1.0 + half(sunset) * 0.6 * warm));
  half3 rich = hsvToRgb(hsv);
  half luma = dot(rich, LUMA);
  return rich + half3(1.0, 0.45, -0.7) * half(sunset) * 0.09 * luma * luma;
}

// The colour of a hue in degrees, without its brightness: what a grade adds.
half3 tintOf(float degrees) {
  half3 rgb = hsvToRgb(half3(half(fract(degrees / 360.0)), 1.0, 1.0));
  return rgb - dot(rgb, LUMA);
}

// Colour grading: shadows, midtones and highlights each pulled towards their hue.
half3 grading(half3 color) {
  half luma = dot(saturate(color), LUMA);
  half shadows = (1.0 - luma) * (1.0 - luma);
  half highlights = luma * luma;
  half midtones = saturate(1.0 - shadows - highlights);
  return color
    + tintOf(gradeHues.x) * half(gradeAmounts.x) * shadows * 0.35
    + tintOf(gradeHues.y) * half(gradeAmounts.y) * midtones * 0.35
    + tintOf(gradeHues.z) * half(gradeAmounts.z) * highlights * 0.35;
}

// A smooth bump of width 1/4 centred at 'centre'.
half bump(half x, half centre) {
  half t = saturate(1.0 - abs(x - centre) * 4.0);
  return t * t * (3.0 - 2.0 * t);
}

half curveOf(half x, float4 points) {
  half lift = half(points.x) * bump(x, 0.125) + half(points.y) * bump(x, 0.375)
    + half(points.z) * bump(x, 0.625) + half(points.w) * bump(x, 0.875);
  return saturate(x + lift * 0.12);
}

half3 local(half3 color, float2 uv, float aspect, float4 area, float4 adjust, float angle) {
  if (adjust.w < 0.5) return color;
  // Distances in short-edge units, so a circle is round on the photo.
  float2 d = (uv - area.xy) * (aspect > 1.0 ? float2(aspect, 1.0) : float2(1.0, 1.0 / aspect));
  float r = max(area.z, 1e-4);
  half weight;
  if (adjust.w < 1.5) {
    weight = half(1.0 - smoothstep(r * (1.0 - area.w), r, length(d)));
  } else {
    // Graduated: full beyond the line on the side 'angle' points to, fading across 2r.
    float along = dot(d, float2(sin(angle), -cos(angle)));
    weight = half(smoothstep(-r, r, along));
  }
  if (weight <= 0.0) return color;
  half3 adjusted = color * half(exp2(adjust.x));
  adjusted = grade(adjusted, adjust.z, 0.0, adjust.y, 0.0, 0.0);
  return mix(color, adjusted, weight);
}

half4 main(float2 coord) {
  half4 source = unpremul(image.eval(coord));
  half3 color = source.rgb;
  float shortEdge = min(resolution.x, resolution.y);

  if (sharpen > 0.0) {
    float r = max(1.0, SHARPEN_RADIUS * shortEdge);
    half3 blur = (unpremul(image.eval(coord + float2(r, 0.0))).rgb
      + unpremul(image.eval(coord - float2(r, 0.0))).rgb
      + unpremul(image.eval(coord + float2(0.0, r))).rgb
      + unpremul(image.eval(coord - float2(0.0, r))).rgb) * 0.25;
    color += (color - blur) * half(sharpen * 1.5);
  }

  if (clarity != 0.0 || dehaze != 0.0) {
    half3 surround = surroundOf(coord, max(2.0, SURROUND_RADIUS * shortEdge));
    if (clarity != 0.0) {
      // Midtones only, so skies and deep shadows do not band or clip.
      half midtones = 1.0 - abs(dot(saturate(color), LUMA) * 2.0 - 1.0);
      color += (color - surround) * half(clarity) * midtones * 1.2;
    }
    if (dehaze > 0.0) {
      // Haze lifts the darkest channel of a whole area (the dark-channel prior with
      // white air light): take that veil off and stretch back what is left.
      half veil = half(dehaze) * 0.6 * min(min(surround.r, surround.g), surround.b);
      color = (color - veil) / max(1.0 - veil, 0.3);
    } else if (dehaze < 0.0) {
      color = mix(color, MIST, half(-dehaze) * 0.4);
    }
  }

  float2 uv = coord / resolution;
  float aspect = resolution.x / resolution.y;
  color = local(color, uv, aspect, local0Area, local0Adjust, localAngles.x);
  color = local(color, uv, aspect, local1Area, local1Adjust, localAngles.y);
  color = local(color, uv, aspect, local2Area, local2Adjust, localAngles.z);
  color = local(color, uv, aspect, local3Area, local3Adjust, localAngles.w);

  if (levels.x != 0.0 || levels.y != 0.0) {
    // Moves the black and white points: the tones between stretch to follow.
    half black = half(-levels.x * 0.1);
    half white = half(1.0 - levels.y * 0.1);
    color = (color - black) / (white - black);
  }

  if (any(notEqual(curve, float4(0.0)))) {
    color = half3(curveOf(color.r, curve), curveOf(color.g, curve), curveOf(color.b, curve));
  }
  if (any(notEqual(curveRed, float4(0.0)))) color.r = curveOf(color.r, curveRed);
  if (any(notEqual(curveGreen, float4(0.0)))) color.g = curveOf(color.g, curveGreen);
  if (any(notEqual(curveBlue, float4(0.0)))) color.b = curveOf(color.b, curveBlue);

  half luma = dot(saturate(color), LUMA);
  // Shadows act on the dark third, highlights on the bright third.
  half shadowWeight = (1.0 - luma) * (1.0 - luma) * (1.0 - luma);
  half highlightWeight = luma * luma * luma;
  color *= 1.0 + half(shadows) * shadowWeight * 0.8 + half(highlights) * highlightWeight * 0.4;

  if (any(notEqual(hueA, float4(0.0))) || any(notEqual(hueB, float4(0.0)))
      || any(notEqual(saturationA, float4(0.0))) || any(notEqual(saturationB, float4(0.0)))
      || any(notEqual(luminanceA, float4(0.0))) || any(notEqual(luminanceB, float4(0.0)))) {
    color = colourBands(color);
  }

  if (any(notEqual(gradeAmounts, float4(0.0)))) color = grading(color);
  if (sky != 0.0) color = skyTone(color, uv);
  if (sunset != 0.0) color = sunsetTone(color);

  if (vibrance != 0.0) {
    half grey = dot(color, LUMA);
    half saturation = max(max(color.r, color.g), color.b) - min(min(color.r, color.g), color.b);
    // Dull colours gain the most; vivid ones are left nearly alone.
    color = mix(half3(grey), color, 1.0 + half(vibrance) * (1.0 - saturate(saturation)));
  }

  return half4(saturate(color) * source.a, source.a);
}
`;
