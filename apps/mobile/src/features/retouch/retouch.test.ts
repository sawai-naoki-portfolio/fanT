import { describe, expect, it } from 'vitest';

import { NO_AREA_TONE } from '../selection/area-tone';
import { addHealSpot, MAX_HEAL_SPOTS, needsPersonMask, NO_HAIR_COLOR, rgbOf } from './retouch';

describe('retouch', () => {
  it('converts #rrggbb to 0–1 RGB', () => {
    expect(rgbOf('#ff8000')).toEqual([1, 128 / 255, 0]);
  });

  it('needs the person mask only for a backdrop, background blur, hair colour or toning', () => {
    const selective = { people: NO_AREA_TONE, background: NO_AREA_TONE };
    const none = { backdrop: null, backgroundBlur: 0, hair: NO_HAIR_COLOR, selective };
    expect(needsPersonMask(none)).toBe(false);
    expect(needsPersonMask({ ...none, backdrop: 'sky' })).toBe(true);
    expect(needsPersonMask({ ...none, backgroundBlur: 0.5 })).toBe(true);
    expect(needsPersonMask({ ...none, hair: { ...NO_HAIR_COLOR, amount: 1 } })).toBe(true);
    expect(
      needsPersonMask({
        ...none,
        selective: { ...selective, background: { ...NO_AREA_TONE, brightness: -0.5 } },
      }),
    ).toBe(true);
  });

  it('adds blemish spots up to the limit', () => {
    const spot = { x: 0.5, y: 0.5, radius: 0.02 };
    expect(addHealSpot([], { x: 0.1, y: 0.2 }, 0.03)).toEqual([{ x: 0.1, y: 0.2, radius: 0.03 }]);
    expect(
      addHealSpot(
        Array.from({ length: MAX_HEAL_SPOTS }, () => spot),
        spot,
        0.02,
      ),
    ).toBeNull();
  });
});
