import type { Rect } from '../photo/frames';
import type { Size } from '../photo/geometry';

/** How the photos are arranged (DCO-07): a tidy grid, or scattered like prints on a desk. */
export const COLLAGE_LAYOUTS = ['grid', 'scatter'] as const;
export type CollageLayout = (typeof COLLAGE_LAYOUTS)[number];

export const MIN_COLLAGE_PHOTOS = 2;
export const MAX_COLLAGE_PHOTOS = 6;

/** Photos per row, top to bottom, for each count. */
const ROWS: Readonly<Record<number, readonly number[]>> = {
  2: [1, 1],
  3: [1, 2],
  4: [2, 2],
  5: [2, 3],
  6: [2, 2, 2],
};

export interface CollageCell extends Rect {
  /** Degrees, clockwise; scattered prints are tilted. */
  readonly rotation: number;
}

/** Tilts for scattered prints, alternating so neighbours lean apart. */
const TILTS = [-5, 4, -3, 6, -6, 3];
/** Scattered prints are a little smaller than their cells, so they can lean. */
const SCATTER_SCALE = 0.9;

/**
 * Where each photo goes on a `size` collage: rows of cells separated and surrounded
 * by `gap` (a fraction of the short edge). Scattered prints sit in the same cells,
 * smaller and tilted.
 */
export function collageCells(
  count: number,
  layout: CollageLayout,
  size: Size,
  gap: number,
): CollageCell[] {
  const rows = ROWS[count];
  if (rows === undefined) throw new Error(`A collage takes 2–6 photos, not ${String(count)}`);
  const space = gap * Math.min(size.width, size.height);
  const rowHeight = (size.height - space * (rows.length + 1)) / rows.length;
  const cells: CollageCell[] = [];
  rows.forEach((columns, row) => {
    const width = (size.width - space * (columns + 1)) / columns;
    for (let column = 0; column < columns; column++) {
      const cell = {
        x: space + column * (width + space),
        y: space + row * (rowHeight + space),
        width,
        height: rowHeight,
      };
      if (layout === 'grid') {
        cells.push({ ...cell, rotation: 0 });
        continue;
      }
      const index = cells.length;
      const shrunk = { width: cell.width * SCATTER_SCALE, height: cell.height * SCATTER_SCALE };
      cells.push({
        x: cell.x + (cell.width - shrunk.width) / 2,
        y: cell.y + (cell.height - shrunk.height) / 2,
        ...shrunk,
        rotation: TILTS[index % TILTS.length] ?? 0,
      });
    }
  });
  return cells;
}
