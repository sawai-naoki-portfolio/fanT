import { describe, expect, it } from 'vitest';

import { collageCells } from './collage-layout';

const SIZE = { width: 1200, height: 1600 };

describe('collageCells (DCO-07)', () => {
  it('makes one cell per photo, for 2 to 6 photos', () => {
    for (let count = 2; count <= 6; count++) {
      expect(collageCells(count, 'grid', SIZE, 0.02)).toHaveLength(count);
    }
    expect(() => collageCells(7, 'grid', SIZE, 0)).toThrow();
  });

  it('fills the collage edge to edge without a gap', () => {
    const cells = collageCells(4, 'grid', SIZE, 0);
    expect(cells[0]).toEqual({ x: 0, y: 0, width: 600, height: 800, rotation: 0 });
    expect(cells[3]).toEqual({ x: 600, y: 800, width: 600, height: 800, rotation: 0 });
  });

  it('keeps the gap around and between cells', () => {
    const [first, second] = collageCells(2, 'grid', SIZE, 0.05);
    expect(first?.x).toBe(60);
    expect((second?.y ?? 0) - ((first?.y ?? 0) + (first?.height ?? 0))).toBeCloseTo(60);
    expect((second?.y ?? 0) + (second?.height ?? 0)).toBeCloseTo(1600 - 60);
  });

  it('tilts scattered prints and keeps them inside their cells', () => {
    const grid = collageCells(3, 'grid', SIZE, 0.02);
    const scattered = collageCells(3, 'scatter', SIZE, 0.02);
    scattered.forEach((cell, index) => {
      const around = grid[index];
      expect(cell.rotation).not.toBe(0);
      expect(cell.width).toBeLessThan(around?.width ?? 0);
      expect(cell.x).toBeGreaterThan(around?.x ?? 0);
    });
  });
});
