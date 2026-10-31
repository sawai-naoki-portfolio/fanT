import type { Layout } from '@fant/content-schema';
import {
  ClipOp,
  FilterMode,
  MipmapMode,
  Skia,
  type SkCanvas,
  type SkImage,
} from '@shopify/react-native-skia';

import type { DecoLayer } from '../features/photo/recipe';
import { drawDeco, type DecoAssets } from './draw-deco';
import { drawPattern } from './draw-pattern';
import { drawStyledText } from './draw-text';
import { makeSurface } from './surface';

export interface SheetCell {
  readonly image: SkImage;
  /** Scribbles on this cell, in the cell's own fractions (PRI-05). */
  readonly deco: readonly DecoLayer[];
}

/** Draws `image` cropped to fill the rectangle ("cover"). */
function drawCover(
  canvas: SkCanvas,
  image: SkImage,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const scale = Math.max(width / image.width(), height / image.height());
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  canvas.drawImageRectOptions(
    image,
    Skia.XYWHRect(
      (image.width() - sourceWidth) / 2,
      (image.height() - sourceHeight) / 2,
      sourceWidth,
      sourceHeight,
    ),
    Skia.XYWHRect(x, y, width, height),
    FilterMode.Linear,
    MipmapMode.None,
  );
}

/**
 * Lays the shots out on the purikura sheet (PRI-06): background and pattern, each
 * photo with its scribbles in a rounded frame, and the date in the margin. The
 * caller disposes the result.
 */
export function composeSheet(
  layout: Layout,
  cells: readonly SheetCell[],
  assets: DecoAssets,
  caption: string,
): SkImage {
  const { width, height } = layout;
  const surface = makeSurface(width, height);
  const background = Skia.Paint();
  try {
    const canvas = surface.getCanvas();
    background.setColor(Skia.Color(layout.background.color));
    canvas.drawRect(Skia.XYWHRect(0, 0, width, height), background);
    drawPattern(canvas, layout.background.pattern, layout.background.patternColor, width, height);

    const radius = Math.min(width, height) * 0.02;
    layout.cells.forEach((cell, index) => {
      const shot = cells[index];
      if (shot === undefined) return;
      const x = cell.x * width;
      const y = cell.y * height;
      const cellWidth = cell.width * width;
      const cellHeight = cell.height * height;
      canvas.save();
      canvas.clipRRect(
        Skia.RRectXY(Skia.XYWHRect(x, y, cellWidth, cellHeight), radius, radius),
        ClipOp.Intersect,
        true,
      );
      drawCover(canvas, shot.image, x, y, cellWidth, cellHeight);
      canvas.translate(x, y);
      drawDeco(canvas, shot.deco, cellWidth, cellHeight, assets);
      canvas.restore();
    });

    drawStyledText(canvas, caption, 'outline', '#ff5fa2', {
      center: { x: width / 2, y: height * 0.94 },
      fontSize: Math.min(width, height) * 0.05,
      rotation: 0,
    });
    surface.flush();
    return surface.makeImageSnapshot();
  } finally {
    background.dispose();
    surface.dispose();
  }
}

/** One shot with its scribbles, for saving a single cell (PRI-06). */
export function renderCell(cell: SheetCell, assets: DecoAssets): SkImage {
  const width = cell.image.width();
  const height = cell.image.height();
  const surface = makeSurface(width, height);
  try {
    const canvas = surface.getCanvas();
    canvas.drawImage(cell.image, 0, 0);
    drawDeco(canvas, cell.deco, width, height, assets);
    surface.flush();
    return surface.makeImageSnapshot();
  } finally {
    surface.dispose();
  }
}
