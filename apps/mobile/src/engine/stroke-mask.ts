import { Skia, TileMode, type SkCanvas, type SkImage } from '@shopify/react-native-skia';

import type { Size } from '../features/photo/geometry';
import type { DecoStroke } from '../features/photo/recipe';
import { drawDeco, NO_DECO_ASSETS } from './draw-deco';
import { makeSurface } from './surface';

/**
 * Painted strokes in white over a `size` canvas: the area to erase (AI-10), to
 * adjust with the brush (EDT-35) or to set moving (EDT-37). Pen strokes whatever
 * tool drew them.
 */
export function drawStrokeMask(canvas: SkCanvas, strokes: readonly DecoStroke[], size: Size): void {
  drawDeco(
    canvas,
    strokes.map((stroke) => ({ ...stroke, tool: 'pen' as const, color: '#ffffff' })),
    size.width,
    size.height,
    NO_DECO_ASSETS,
  );
}

/**
 * The strokes as a mask image on transparent, blurred by `feather` (a fraction of
 * the short edge) so what it masks fades out at the edge. The caller disposes it.
 */
export function softStrokeMask(
  strokes: readonly DecoStroke[],
  size: Size,
  feather: number,
): SkImage {
  const surface = makeSurface(size.width, size.height);
  const soften = Skia.Paint();
  const sigma = Math.min(size.width, size.height) * feather;
  const blur = Skia.ImageFilter.MakeBlur(sigma, sigma, TileMode.Decal, null);
  try {
    soften.setImageFilter(blur);
    const canvas = surface.getCanvas();
    canvas.saveLayer(soften);
    drawStrokeMask(canvas, strokes, size);
    canvas.restore();
    surface.flush();
    return surface.makeImageSnapshot();
  } finally {
    blur.dispose();
    soften.dispose();
    surface.dispose();
  }
}
