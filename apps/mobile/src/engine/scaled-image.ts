import {
  ClipOp,
  FilterMode,
  MipmapMode,
  Skia,
  type SkCanvas,
  type SkImage,
} from '@shopify/react-native-skia';

import { coverPlacement } from '../features/photo/frames';
import type { Size } from '../features/photo/geometry';
import { decodeImageFile } from './images';
import { makeSurface } from './surface';

/** Draws `image` to fill a `width`×`height` area at the origin, cropping what spills over. */
export function drawCovering(canvas: SkCanvas, image: SkImage, width: number, height: number) {
  const size = { width: image.width(), height: image.height() };
  const placement = coverPlacement(size, { x: 0, y: 0, width, height });
  const paint = Skia.Paint();
  try {
    paint.setAntiAlias(true);
    canvas.save();
    canvas.clipRect(Skia.XYWHRect(0, 0, width, height), ClipOp.Intersect, true);
    canvas.drawImageRectOptions(
      image,
      Skia.XYWHRect(0, 0, size.width, size.height),
      Skia.XYWHRect(
        placement.x,
        placement.y,
        size.width * placement.scale,
        size.height * placement.scale,
      ),
      FilterMode.Linear,
      MipmapMode.Linear,
      paint,
    );
    canvas.restore();
  } finally {
    paint.dispose();
  }
}

/** A smaller copy of a photo file, for drawing it small; the full image is freed at once. */
export async function decodeScaled(uri: string, maxLongEdge: number): Promise<SkImage> {
  const image = await decodeImageFile(uri);
  const scale = maxLongEdge / Math.max(image.width(), image.height());
  if (scale >= 1) return image;
  try {
    const width = Math.max(1, Math.round(image.width() * scale));
    const height = Math.max(1, Math.round(image.height() * scale));
    const surface = makeSurface(width, height);
    try {
      drawCovering(surface.getCanvas(), image, width, height);
      surface.flush();
      return surface.makeImageSnapshot();
    } finally {
      surface.dispose();
    }
  } finally {
    image.dispose();
  }
}

/** A copy of `image` at exactly `size`, filled and cropped like `drawCovering`. */
export function coverTo(image: SkImage, size: Size): SkImage {
  const surface = makeSurface(size.width, size.height);
  try {
    drawCovering(surface.getCanvas(), image, size.width, size.height);
    surface.flush();
    return surface.makeImageSnapshot();
  } finally {
    surface.dispose();
  }
}
