import { describe, expect, it } from 'vitest';

import { polygonAround } from '../character/face-geometry.worklet';
import { hasMakeup, makeupSchema, NO_MAKEUP } from './makeup';

describe('makeup', () => {
  it('is off by default, and fields added later read as off', () => {
    expect(hasMakeup(NO_MAKEUP)).toBe(false);
    expect(makeupSchema.parse({ lip: 0.5 })).toMatchObject({ lip: 0.5, teeth: 0, blush: 0 });
    expect(hasMakeup(makeupSchema.parse({ teeth: 0.2 }))).toBe(true);
  });

  it('rejects colours that are not #rrggbb', () => {
    expect(makeupSchema.safeParse({ lipColor: 'red' }).success).toBe(false);
  });
});

describe('polygonAround', () => {
  it('orders points around their centre whatever order they come in', () => {
    const square = [
      { x: 1, y: 1 },
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: -1, y: 1 },
    ];
    const ordered = polygonAround(square);
    // Each neighbour differs in exactly one coordinate: the outline does not cross itself.
    for (let i = 0; i < ordered.length; i++) {
      const a = ordered[i];
      const b = ordered[(i + 1) % ordered.length];
      expect(a !== undefined && b !== undefined && (a.x === b.x) !== (a.y === b.y)).toBe(true);
    }
  });
});
