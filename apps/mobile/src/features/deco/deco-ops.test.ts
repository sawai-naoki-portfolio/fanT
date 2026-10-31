import { describe, expect, it } from 'vitest';

import { MAX_DECO_LAYERS, type DecoLayer, type DecoStamp } from '../photo/recipe';
import {
  addLayer,
  extendStroke,
  hitTest,
  replaceLayer,
  startStroke,
  transformLayer,
} from './deco-ops';

const SIZE = { width: 1000, height: 1000 };
const STAMP: DecoStamp = {
  type: 'stamp',
  stampId: 'heart_pink',
  x: 0.5,
  y: 0.5,
  size: 0.2,
  rotation: 0,
};

describe('strokes', () => {
  it('skips points that barely moved', () => {
    const stroke = startStroke('pen', '#ffffff', 0.01, 0.1, 0.1);
    expect(extendStroke(stroke, 0.1001, 0.1).points).toHaveLength(4);
    expect(extendStroke(stroke, 0.2, 0.1).points).toEqual([0.1, 0.1, 0.1, 0.1, 0.2, 0.1]);
  });
});

describe('hitTest', () => {
  const layers: DecoLayer[] = [
    STAMP,
    { ...STAMP, x: 0.52 },
    startStroke('pen', '#000000', 0.01, 0.5, 0.5),
  ];

  it('finds the topmost stamp under the finger, ignoring strokes', () => {
    expect(hitTest(layers, { x: 520, y: 500 }, SIZE)).toBe(1);
  });

  it('returns null away from every stamp', () => {
    expect(hitTest(layers, { x: 50, y: 50 }, SIZE)).toBeNull();
  });
});

describe('transformLayer', () => {
  it('moves, scales and rotates', () => {
    expect(transformLayer(STAMP, { dx: 0.1, dy: -0.1, scale: 2, rotation: 30 })).toMatchObject({
      x: 0.6,
      y: 0.4,
      size: 0.4,
      rotation: 30,
    });
  });

  it('keeps values within limits and wraps rotation', () => {
    const moved = transformLayer(STAMP, { dx: 5, dy: 0, scale: 100, rotation: 200 });
    expect(moved.x).toBe(1.4);
    expect(moved.size).toBe(1.5);
    expect(moved.rotation).toBe(-160);
  });
});

describe('replaceLayer', () => {
  it('replaces or removes one layer', () => {
    const layers: DecoLayer[] = [STAMP, { ...STAMP, x: 0.1 }];
    expect(replaceLayer(layers, 1, null)).toEqual([STAMP]);
    expect(replaceLayer(layers, 0, { ...STAMP, y: 0.9 })[0]).toMatchObject({ y: 0.9 });
  });

  it('stops adding layers at the recipe limit', () => {
    const stroke = startStroke('pen', '#ffffff', 0.01, 0.5, 0.5);
    expect(addLayer([], stroke)).toEqual([stroke]);
    expect(
      addLayer(
        Array.from({ length: MAX_DECO_LAYERS }, () => stroke),
        stroke,
      ),
    ).toBeNull();
  });
});
