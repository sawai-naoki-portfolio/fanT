import { BEAUTY_LEVELS } from '@fant/filters';
import { describe, expect, it } from 'vitest';

import { beautyLevelOf, nextBeautyLevel, nextItem } from './presets';

describe('nextItem', () => {
  it('steps forward and wraps around', () => {
    expect(nextItem(['a', 'b', 'c'], 'b')).toBe('c');
    expect(nextItem(['a', 'b', 'c'], 'c')).toBe('a');
  });

  it('starts at the first item when the current one is not listed', () => {
    expect(nextItem(['a', 'b'], 'z')).toBe('a');
  });

  it('rejects an empty list', () => {
    expect(() => nextItem([], 'a')).toThrow();
  });
});

describe('beauty levels', () => {
  it('recognizes each preset and fine-tuned values', () => {
    expect(beautyLevelOf(BEAUTY_LEVELS.high)).toBe('high');
    expect(beautyLevelOf({ ...BEAUTY_LEVELS.low, rosiness: 0.9 })).toBeNull();
  });

  it('cycles off → low → medium → high → off, and fine-tuned → off', () => {
    expect(nextBeautyLevel(BEAUTY_LEVELS.off)).toBe('low');
    expect(nextBeautyLevel(BEAUTY_LEVELS.high)).toBe('off');
    expect(nextBeautyLevel({ smoothing: 0.42, brightness: 0, rosiness: 0 })).toBe('off');
  });
});
