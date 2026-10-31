import { z } from 'zod';

const centered = z.number().min(-1).max(1).default(0);

/**
 * A change of brightness, colour and warmth for one part of a photo: the sky
 * (EDT-25), the people or the background (EDT-34), or a painted area (EDT-35).
 */
export const areaToneSchema = z.strictObject({
  brightness: centered,
  saturation: centered,
  warmth: centered,
});
export type AreaTone = z.infer<typeof areaToneSchema>;

export const NO_AREA_TONE: AreaTone = areaToneSchema.parse({});

export function changesTone(tone: AreaTone): boolean {
  return tone.brightness !== 0 || tone.saturation !== 0 || tone.warmth !== 0;
}

const LUMA = [0.2126, 0.7152, 0.0722] as const;

/**
 * The change as a 4×5 colour matrix (rows R, G, B, A; no offsets): saturation
 * around the luma, then warmth and brightness as channel gains.
 */
export function toneMatrix(tone: AreaTone): number[] {
  const s = 1 + tone.saturation;
  const gain = 2 ** (tone.brightness * 0.8);
  const gains = [gain * (1 + tone.warmth * 0.12), gain, gain * (1 - tone.warmth * 0.12)];
  const rows = [0, 1, 2].map((row) => [
    ...LUMA.map(
      (weight, column) => ((row === column ? s : 0) + weight * (1 - s)) * (gains[row] ?? 1),
    ),
    0,
    0,
  ]);
  return [...rows.flat(), 0, 0, 0, 1, 0];
}
