import type { PartMotion } from '@fant/content-schema';
import { describe, expect, it } from 'vitest';

import type { PartPlacement } from './face-geometry.worklet';
import { moveParts } from './part-motion.worklet';

const BASE: PartPlacement = {
  center: { x: 100, y: 100 },
  size: 20,
  rotation: 0,
  mirrored: false,
  squash: [1, 1],
};

const motion = (type: PartMotion['type']): PartMotion => ({
  type,
  count: 8,
  speed: 0.5,
  spread: 1,
});

describe('moveParts (CHR-08)', () => {
  it('lets petals fall below their place and hearts rise above it', () => {
    const falling = moveParts(BASE, motion('fall'), 100, 0.3);
    expect(falling.length).toBeGreaterThan(0);
    expect(falling.every(({ center }) => center.y >= 100)).toBe(true);
    const rising = moveParts(BASE, motion('rise'), 100, 0.3);
    expect(rising.every(({ center }) => center.y <= 100)).toBe(true);
  });

  it('moves over time and repeats the same moment exactly', () => {
    const at = (time: number) => moveParts(BASE, motion('orbit'), 100, time);
    expect(at(1)).toEqual(at(1));
    expect(at(1)[0]?.center).not.toEqual(at(1.2)[0]?.center);
  });

  it('keeps orbiting copies around the place, within the spread', () => {
    for (const { center } of moveParts(BASE, motion('orbit'), 100, 2)) {
      expect(Math.abs(center.x - 100)).toBeLessThanOrEqual(100 + 1e-9);
      expect(Math.abs(center.y - 100)).toBeLessThanOrEqual(30 + 1e-9);
    }
  });

  it('never makes more copies than asked', () => {
    expect(moveParts(BASE, motion('twinkle'), 100, 0.7).length).toBeLessThanOrEqual(8);
  });
});
