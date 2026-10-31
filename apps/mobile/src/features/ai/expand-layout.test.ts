import { describe, expect, it } from 'vitest';

import { EXPAND_SHAPES, expandLayout } from './expand-layout';

const PORTRAIT = { width: 3000, height: 4000 };

describe('expandLayout', () => {
  it('widens a portrait photo into a story, centred', () => {
    const layout = expandLayout(PORTRAIT, '9:16', 1024);
    expect(layout.canvas).toEqual({ width: 576, height: 1024 });
    expect(layout.photo).toEqual({ x: 0, y: 128, width: 576, height: 768 });
  });

  it('widens sideways for a landscape shape', () => {
    const layout = expandLayout(PORTRAIT, '16:9', 1024);
    expect(layout.canvas.width / layout.canvas.height).toBeCloseTo(16 / 9, 2);
    expect(layout.photo.height).toBe(layout.canvas.height);
    expect(layout.photo.x).toBeGreaterThan(0);
  });

  it('adds a margin all round when the photo already has the shape', () => {
    for (const shape of ['wider', '1:1'] as const) {
      const square = expandLayout({ width: 1000, height: 1000 }, shape, 1024);
      expect(square.photo.x).toBeGreaterThan(0);
      expect(square.photo.y).toBeGreaterThan(0);
    }
  });

  it('always leaves the photo whole inside an upload-sized canvas', () => {
    for (const shape of EXPAND_SHAPES) {
      for (const photo of [PORTRAIT, { width: 4000, height: 3000 }, { width: 500, height: 500 }]) {
        const { canvas, photo: placed } = expandLayout(photo, shape, 1024);
        expect(Math.max(canvas.width, canvas.height)).toBeLessThanOrEqual(1024);
        expect(placed.x).toBeGreaterThanOrEqual(0);
        expect(placed.y).toBeGreaterThanOrEqual(0);
        expect(placed.x + placed.width).toBeLessThanOrEqual(canvas.width);
        expect(placed.y + placed.height).toBeLessThanOrEqual(canvas.height);
        expect(canvas.width * canvas.height).toBeGreaterThan(placed.width * placed.height);
      }
    }
  });
});
