/**
 * Generates the colour LUTs of the built-in films into builtin/luts/. Films made in
 * the film studio bring their own LUT; these are the starting set (FLM-02).
 * Run `pnpm --filter @fant/content generate:luts`, then `hash` to update the films.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { makeLut } from '@fant/filters';

import { encodePng } from './png';

type Rgb = readonly [number, number, number];

const SIZE = 33;
const luma = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};
/** S-curve around mid-gray; `amount` 0 is linear. */
const curve = (value: number, amount: number) => value + amount * (smoothstep(0, 1, value) - value);
const curveRgb = (c: Rgb, amount: number): Rgb => [
  curve(c[0], amount),
  curve(c[1], amount),
  curve(c[2], amount),
];
/** Tints shadows and highlights separately (split toning). */
const splitTone = (c: Rgb, shadow: Rgb, highlight: Rgb, amount: number): Rgb => {
  const y = luma(c);
  const s = (1 - smoothstep(0, 0.5, y)) * amount;
  const h = smoothstep(0.5, 1, y) * amount;
  return [
    c[0] + (shadow[0] - 0.5) * s + (highlight[0] - 0.5) * h,
    c[1] + (shadow[1] - 0.5) * s + (highlight[1] - 0.5) * h,
    c[2] + (shadow[2] - 0.5) * s + (highlight[2] - 0.5) * h,
  ];
};
const saturate = (c: Rgb, amount: number): Rgb => mix([luma(c), luma(c), luma(c)], c, 1 + amount);
/** How green a colour is (0–1): foliage, lawns, fields. */
const greenness = ([r, g, b]: Rgb) => smoothstep(0.02, 0.15, g - Math.max(r, b));
/** How warm a colour is (0–1): skin, sunsets, lamps. */
const warmness = ([r, g, b]: Rgb) => smoothstep(0.05, 0.3, r - b) * smoothstep(-0.1, 0.1, r - g);

/** Colour looks; the rest of each film (grain, bloom, …) lives in its JSON. */
const LOOKS: Record<string, (c: Rgb) => Rgb> = {
  // 2000s compact CCD: teal shadows, warm magenta highlights, punchy colour.
  ccd_2005: (c) =>
    saturate(curveRgb(splitTone(c, [0.35, 0.6, 0.62], [0.68, 0.5, 0.48], 0.35), 0.35), 0.15),
  // Disposable film: green-yellow mids, muted blues, soft contrast.
  disposable: (c) => {
    const toned = splitTone(c, [0.45, 0.55, 0.45], [0.66, 0.6, 0.4], 0.4);
    return saturate([toned[0], toned[1], toned[2] * 0.92 + 0.03], -0.1);
  },
  // Instant print: cool shadows, creamy highlights, lifted and soft.
  instant: (c) => curveRgb(splitTone(c, [0.4, 0.5, 0.62], [0.62, 0.58, 0.45], 0.4), -0.2),
  // Purikura: pink-white highlights and clean, bright skin.
  puri: (c) =>
    saturate(splitTone(mix(c, [1, 1, 1], 0.08), [0.55, 0.45, 0.58], [0.64, 0.5, 0.58], 0.35), 0.05),
  // Night flash: deep shadows, cold background, bright flash-lit faces.
  night_flash: (c) => curveRgb(splitTone(c, [0.4, 0.45, 0.65], [0.6, 0.55, 0.5], 0.4), 0.6),
  // Fresh greenery (EDT-15 scenery films): leaves richer and a touch yellow, clean skies.
  shinryoku: (c) => {
    const leaf = greenness(c);
    const fresh = mix(c, saturate([c[0] + 0.03, c[1] + 0.02, c[2] - 0.04], 0.45), leaf);
    return curveRgb(splitTone(fresh, [0.45, 0.52, 0.55], [0.55, 0.55, 0.48], 0.25), 0.2);
  },
  // Sunset: golden highlights, rose-violet shadows, warm colours glowing.
  yuyake: (c) => {
    const glow = mix(c, saturate(c, 0.4), warmness(c));
    return curveRgb(splitTone(glow, [0.52, 0.4, 0.6], [0.72, 0.55, 0.36], 0.45), 0.25);
  },
  // Misty morning: lifted, cool and quiet, colours held back.
  kiri: (c) =>
    saturate(
      curveRgb(
        splitTone(mix(c, [0.82, 0.86, 0.9], 0.18), [0.45, 0.5, 0.6], [0.52, 0.54, 0.58], 0.3),
        -0.3,
      ),
      -0.3,
    ),
  // Night city: teal shadows, orange lights, deep contrast.
  yakei: (c) => {
    const lights = mix(c, saturate(c, 0.5), warmness(c));
    return curveRgb(splitTone(lights, [0.3, 0.55, 0.62], [0.7, 0.52, 0.35], 0.5), 0.45);
  },
};

const directory = join(import.meta.dirname, '..', 'builtin', 'luts');
for (const [name, look] of Object.entries(LOOKS)) {
  const lut = makeLut(SIZE, (r, g, b) => look([r, g, b]));
  writeFileSync(join(directory, `${name}.png`), encodePng(lut.width, lut.height, lut.pixels));
  console.log(`builtin/luts/${name}.png`);
}
