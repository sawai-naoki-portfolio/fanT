import { BlurStyle, PaintStyle, Skia, StrokeCap, type SkCanvas } from '@shopify/react-native-skia';

import type { Point } from './affine.worklet';
import type { ShapeArt } from './shapes';

export interface ShapePlacement {
  readonly center: Point;
  /** Edge length of the 100×100 art box in pixels. */
  readonly size: number;
  /** Degrees, clockwise. */
  readonly rotation: number;
  readonly mirrored: boolean;
  /** Narrowing across and down, in the art's own axes (a head turning away, CHR-09). */
  readonly squash?: readonly [number, number];
}

/**
 * Draws vector art centred at a point. Marked as a worklet so characters can be
 * drawn on the camera thread; every Skia object is disposed before returning.
 */
export function drawShape(
  canvas: SkCanvas,
  art: ShapeArt,
  color: string,
  placement: ShapePlacement,
): void {
  'worklet';
  const path = Skia.Path.MakeFromSVGString(art.path);
  if (path === null) return;
  const paint = Skia.Paint();
  const detailPaint = Skia.Paint();
  const detailPath = art.detail === undefined ? null : Skia.Path.MakeFromSVGString(art.detail);
  const blur =
    art.blur === undefined ? null : Skia.MaskFilter.MakeBlur(BlurStyle.Normal, art.blur, true);
  try {
    canvas.save();
    canvas.translate(placement.center.x, placement.center.y);
    canvas.rotate(placement.rotation, 0, 0);
    const scale = placement.size / 100;
    const [sx, sy] = placement.squash ?? [1, 1];
    canvas.scale((placement.mirrored ? -scale : scale) * sx, scale * sy);
    canvas.translate(-50, -50);

    paint.setAntiAlias(true);
    paint.setColor(Skia.Color(color));
    if (art.stroke !== undefined) {
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(art.stroke);
      paint.setStrokeCap(StrokeCap.Round);
    }
    if (blur !== null) paint.setMaskFilter(blur);
    canvas.drawPath(path, paint);

    if (detailPath !== null) {
      detailPaint.setAntiAlias(true);
      detailPaint.setColor(Skia.Color('rgba(255, 255, 255, 0.45)'));
      canvas.drawPath(detailPath, detailPaint);
    }
    canvas.restore();
  } finally {
    paint.dispose();
    detailPaint.dispose();
    path.dispose();
    detailPath?.dispose();
    blur?.dispose();
  }
}
