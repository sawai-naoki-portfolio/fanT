import { FilterMode, ImageFormat, MipmapMode, Skia, TileMode } from '@shopify/react-native-skia';

import type { ExpandLayout } from '../features/ai/expand-layout';
import { decodeImage, encodeJpeg } from './photo';
import { makeSurface } from './surface';

/** The mask reaches this far into the photo, so the filled margin blends at the seam. */
const SEAM = 6;

/**
 * The upload for widening a photo (AI-13): the photo on its new canvas over a
 * blurred, stretched copy (a hint of colours for the model), and the mask, white
 * where the margin is to be filled. Both are the canvas's size.
 */
export function buildExpandInput(
  photoBytes: Uint8Array,
  layout: ExpandLayout,
): { readonly jpeg: Uint8Array; readonly mask: Uint8Array } {
  const image = decodeImage(photoBytes);
  const { canvas, photo } = layout;
  const surface = makeSurface(canvas.width, canvas.height);
  const paint = Skia.Paint();
  const blur = Skia.ImageFilter.MakeBlur(
    canvas.width * 0.04,
    canvas.width * 0.04,
    TileMode.Clamp,
    null,
  );
  try {
    const source = Skia.XYWHRect(0, 0, image.width(), image.height());
    const draw = surface.getCanvas();
    paint.setImageFilter(blur);
    draw.drawImageRectOptions(
      image,
      source,
      Skia.XYWHRect(0, 0, canvas.width, canvas.height),
      FilterMode.Linear,
      MipmapMode.Linear,
      paint,
    );
    paint.setImageFilter(null);
    draw.drawImageRectOptions(
      image,
      source,
      Skia.XYWHRect(photo.x, photo.y, photo.width, photo.height),
      FilterMode.Linear,
      MipmapMode.Linear,
      paint,
    );
    surface.flush();
    const widened = surface.makeImageSnapshot();
    let jpeg: Uint8Array;
    try {
      jpeg = encodeJpeg(widened);
    } finally {
      widened.dispose();
    }

    draw.clear(Skia.Color('#ffffff'));
    paint.setColor(Skia.Color('#000000'));
    draw.drawRect(
      Skia.XYWHRect(
        photo.x + SEAM,
        photo.y + SEAM,
        Math.max(0, photo.width - SEAM * 2),
        Math.max(0, photo.height - SEAM * 2),
      ),
      paint,
    );
    surface.flush();
    const maskImage = surface.makeImageSnapshot();
    try {
      return { jpeg, mask: maskImage.encodeToBytes(ImageFormat.PNG, 100) };
    } finally {
      maskImage.dispose();
    }
  } finally {
    blur.dispose();
    paint.dispose();
    surface.dispose();
    image.dispose();
  }
}
