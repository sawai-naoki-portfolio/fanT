import { describe, expect, it } from 'vitest';

import { flowOf, loopPhases, MOTION_DIRECTIONS, MOTION_FRAME_COUNT } from './motion-settings';

describe('motion settings', () => {
  it('flows along the chosen direction, further when faster', () => {
    const [x, y] = flowOf('right', 1);
    expect(x).toBeGreaterThan(0);
    expect(y).toBe(0);
    expect(flowOf('right', 0.5)[0]).toBeCloseTo(x / 2);
    expect(flowOf('up', 1)[1]).toBeLessThan(0);
    expect(flowOf('right', 5)).toEqual(flowOf('right', 1));
  });

  it('uses unit directions', () => {
    for (const [x, y] of Object.values(MOTION_DIRECTIONS)) expect(Math.hypot(x, y)).toBeCloseTo(1);
  });

  it('spreads frames over one loop without repeating the first at the end', () => {
    const phases = loopPhases(4);
    expect(phases).toEqual([0, 0.25, 0.5, 0.75]);
    expect(loopPhases(MOTION_FRAME_COUNT)).toHaveLength(48);
  });
});
