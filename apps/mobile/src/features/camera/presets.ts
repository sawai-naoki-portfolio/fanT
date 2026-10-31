import { BEAUTY_LEVELS, type BeautyLevel, type BeautyParams } from '@fant/filters';

/** Beauty strengths in the order a tap or a wink steps through them (BTY-02). */
export const BEAUTY_LEVEL_ORDER: readonly BeautyLevel[] = ['off', 'low', 'medium', 'high'];

/** The level these parameters match, or `null` when the user fine-tuned them (BTY-03). */
export function beautyLevelOf(params: BeautyParams): BeautyLevel | null {
  return (
    BEAUTY_LEVEL_ORDER.find((level) => {
      const preset = BEAUTY_LEVELS[level];
      return (Object.keys(preset) as (keyof BeautyParams)[]).every(
        (key) => preset[key] === params[key],
      );
    }) ?? null
  );
}

/** The item after `current`, wrapping around; the first one when `current` is not listed. */
export function nextItem<T>(items: readonly T[], current: T): T {
  const index = items.indexOf(current);
  const next = items[(index + 1) % items.length];
  if (next === undefined) throw new Error('Cannot step through an empty list');
  return next;
}

/** The next strength; fine-tuned values step to "off". */
export function nextBeautyLevel(params: BeautyParams): BeautyLevel {
  const level = beautyLevelOf(params);
  return level === null ? 'off' : nextItem(BEAUTY_LEVEL_ORDER, level);
}
