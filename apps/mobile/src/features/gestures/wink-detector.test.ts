import { describe, expect, it } from 'vitest';

import { createWinkDetector, type EyeOpenness } from './wink-detector';

const OPEN: EyeOpenness = { left: 0.95, right: 0.95 };
const RIGHT_WINK: EyeOpenness = { left: 0.95, right: 0.05 };
const LEFT_WINK: EyeOpenness = { left: 0.05, right: 0.95 };
const BLINK: EyeOpenness = { left: 0.05, right: 0.05 };
const STEP_MS = 100;

/** Feeds observations 100ms apart and returns what fired at each step. */
function feed(observations: readonly (EyeOpenness | null)[], start = 0) {
  const detector = createWinkDetector();
  return observations.map((eyes, index) => detector.update(eyes, start + index * STEP_MS));
}

const repeat = <T>(value: T, times: number): T[] => Array.from({ length: times }, () => value);

describe('createWinkDetector', () => {
  it('fires once a one-eye wink has been held for 700ms', () => {
    const fired = feed([OPEN, ...repeat(RIGHT_WINK, 8)]);
    expect(fired.indexOf('right')).toBe(8);
    expect(fired.filter((eye) => eye !== null)).toEqual(['right']);
  });

  it('tells the left eye from the right', () => {
    expect(feed(repeat(LEFT_WINK, 8))).toContain('left');
  });

  it('ignores a wink shorter than the hold time', () => {
    expect(feed([...repeat(RIGHT_WINK, 6), OPEN, OPEN])).not.toContain('right');
  });

  it('ignores blinks', () => {
    expect(feed(repeat(BLINK, 20))).toEqual(repeat(null, 20));
  });

  it('restarts the hold when a blink or a lost face interrupts it', () => {
    expect(feed([...repeat(RIGHT_WINK, 5), BLINK, ...repeat(RIGHT_WINK, 5)])).not.toContain(
      'right',
    );
    expect(feed([...repeat(RIGHT_WINK, 5), null, ...repeat(RIGHT_WINK, 5)])).not.toContain('right');
  });

  it('does not repeat while the eye stays closed', () => {
    const fired = feed(repeat(RIGHT_WINK, 40));
    expect(fired.filter((eye) => eye !== null)).toEqual(['right']);
  });

  it('allows the next wink only after the eyes reopen and the cooldown passes', () => {
    // The right wink fires at 700ms, the eyes reopen at 800ms, a left wink starts at 900ms.
    const fired = feed([...repeat(RIGHT_WINK, 8), OPEN, ...repeat(LEFT_WINK, 16)]);
    expect(fired.filter((eye) => eye !== null)).toEqual(['right', 'left']);
    // The cooldown ends at 1700ms, so the hold only starts then and completes at 2400ms.
    expect(fired.indexOf('left')).toBe(2400 / STEP_MS);
  });

  it('needs the other eye to be clearly open, not half-closed', () => {
    const squint: EyeOpenness = { left: 0.45, right: 0.05 };
    expect(feed(repeat(squint, 20))).toEqual(repeat(null, 20));
  });
});
