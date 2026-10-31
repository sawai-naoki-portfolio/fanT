import { Skia, type SkCanvas, type SkImage } from '@shopify/react-native-skia';

import type { ShapePlacement } from './draw-shape';

/**
 * Draws an image fitted into a square of `placement.size`, centred and rotated.
 * Marked as a worklet so it can run on the camera thread.
 */
export function drawImageCentered(
  canvas: SkCanvas,
  image: SkImage,
  placement: ShapePlacement,
): void {
  'worklet';
  const width = image.width();
  const height = image.height();
  const scale = placement.size / Math.max(width, height);
  const paint = Skia.Paint();
  try {
    paint.setAntiAlias(true);
    canvas.save();
    canvas.translate(placement.center.x, placement.center.y);
    canvas.rotate(placement.rotation, 0, 0);
    const [sx, sy] = placement.squash ?? [1, 1];
    canvas.scale((placement.mirrored ? -scale : scale) * sx, scale * sy);
    canvas.drawImage(image, -width / 2, -height / 2, paint);
    canvas.restore();
  } finally {
    paint.dispose();
  }
}
