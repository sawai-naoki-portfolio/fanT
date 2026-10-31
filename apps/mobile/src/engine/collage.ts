import {
  BlurStyle,
  Skia,
  type SkCanvas,
  type SkImage,
  type SkPicture,
} from '@shopify/react-native-skia';

import { collageCells, type CollageLayout } from '../features/collage/collage-layout';
import type { Size } from '../features/photo/geometry';
import { decodeScaled, drawCovering } from './scaled-image';
import { makeSurface } from './surface';

export interface CollageOptions {
  readonly layout: CollageLayout;
  /** Space around and between photos, as a fraction of the short edge. */
  readonly gap: number;
  readonly background: string;
}

/** The white border of a scattered print, as a fraction of its short edge. */
const PRINT_BORDER = 0.04;

/** Draws a print with a white border and a soft shadow, centred at the origin. */
function drawPrint(canvas: SkCanvas, image: SkImage, width: number, height: number) {
  const border = PRINT_BORDER * Math.min(width, height);
  const shadow = Skia.Paint();
  const white = Skia.Paint();
  const blur = Skia.MaskFilter.MakeBlur(BlurStyle.Normal, border * 0.8, true);
  try {
    shadow.setColor(Skia.Color('rgba(80, 40, 70, 0.28)'));
    shadow.setMaskFilter(blur);
    canvas.drawRect(Skia.XYWHRect(-width / 2, -height / 2 + border * 0.6, width, height), shadow);
    white.setColor(Skia.Color('#ffffff'));
    canvas.drawRect(Skia.XYWHRect(-width / 2, -height / 2, width, height), white);
    canvas.translate(-width / 2 + border, -height / 2 + border);
    drawCovering(canvas, image, width - border * 2, height - border * 2);
  } finally {
    shadow.dispose();
    white.dispose();
    blur.dispose();
  }
}

/** Draws photos as a collage (DCO-07) on a `size` canvas. */
function drawCollage(
  canvas: SkCanvas,
  photos: readonly SkImage[],
  size: Size,
  options: CollageOptions,
): void {
  canvas.drawColor(Skia.Color(options.background));
  const cells = collageCells(photos.length, options.layout, size, options.gap);
  cells.forEach((cell, index) => {
    const image = photos[index];
    if (image === undefined) return;
    canvas.save();
    if (options.layout === 'grid') {
      canvas.translate(cell.x, cell.y);
      drawCovering(canvas, image, cell.width, cell.height);
    } else {
      canvas.translate(cell.x + cell.width / 2, cell.y + cell.height / 2);
      canvas.rotate(cell.rotation, 0, 0);
      drawPrint(canvas, image, cell.width, cell.height);
    }
    canvas.restore();
  });
}

/** The collage as a picture, for a live preview. */
export function recordCollage(
  photos: readonly SkImage[],
  size: Size,
  options: CollageOptions,
): SkPicture {
  const recorder = Skia.PictureRecorder();
  try {
    drawCollage(
      recorder.beginRecording(Skia.XYWHRect(0, 0, size.width, size.height)),
      photos,
      size,
      options,
    );
    return recorder.finishRecordingAsPicture();
  } finally {
    recorder.dispose();
  }
}

/** Renders the collage at `size`, decoding each photo at the size it is drawn. */
export async function renderCollage(
  uris: readonly string[],
  size: Size,
  options: CollageOptions,
): Promise<SkImage> {
  const cells = collageCells(uris.length, options.layout, size, options.gap);
  const photos: SkImage[] = [];
  try {
    for (const [index, uri] of uris.entries()) {
      const cell = cells[index];
      photos.push(await decodeScaled(uri, Math.max(cell?.width ?? 1, cell?.height ?? 1) * 1.5));
    }
    const surface = makeSurface(size.width, size.height);
    try {
      drawCollage(surface.getCanvas(), photos, size, options);
      surface.flush();
      return surface.makeImageSnapshot();
    } finally {
      surface.dispose();
    }
  } finally {
    for (const photo of photos) photo.dispose();
  }
}
