import { BlendMode, Skia, TileMode, vec, type SkCanvas } from '@shopify/react-native-skia';

import type { Backdrop } from '../features/photo/backdrops';
import { drawPattern } from './draw-pattern';
import { decodeImageFile } from './images';
import { decodeImage, encodeJpeg } from './photo';
import { makeSurface } from './surface';

/** Stars on a night-sky backdrop: the same sky every time, at any size. */
const STAR_COUNT = 140;

/** A deterministic number in [0, 1) for star `index`, `salt` picking the property. */
function starRandom(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/** Paints `backdrop` over `width`×`height`: its colour or gradient, then its pattern. */
export function drawBackdrop(
  canvas: SkCanvas,
  backdrop: Backdrop,
  width: number,
  height: number,
): void {
  const paint = Skia.Paint();
  const gradient =
    backdrop.gradient === undefined
      ? null
      : Skia.Shader.MakeLinearGradient(
          vec(0, 0),
          vec(0, height),
          backdrop.gradient.map((color) => Skia.Color(color)),
          backdrop.stops === undefined ? null : [...backdrop.stops],
          TileMode.Clamp,
        );
  try {
    paint.setColor(Skia.Color(backdrop.color));
    if (gradient !== null) paint.setShader(gradient);
    canvas.drawRect(Skia.XYWHRect(0, 0, width, height), paint);
    drawPattern(canvas, backdrop.pattern, backdrop.patternColor, width, height);
    if (backdrop.stars === true) {
      const star = Skia.Paint();
      try {
        star.setAntiAlias(true);
        const short = Math.min(width, height);
        for (let index = 0; index < STAR_COUNT; index++) {
          star.setColor(Skia.Color(backdrop.patternColor));
          star.setAlphaf(0.35 + starRandom(index, 3) * 0.65);
          // Fewer stars towards the glowing horizon.
          const y = Math.pow(starRandom(index, 2), 1.6) * height;
          const radius = short * (0.0015 + Math.pow(starRandom(index, 4), 3) * 0.004);
          canvas.drawCircle(starRandom(index, 1) * width, y, radius, star);
        }
      } finally {
        star.dispose();
      }
    }
  } finally {
    gradient?.dispose();
    paint.dispose();
  }
}

/**
 * Puts the people of a photo on a new background (PRI-04): the backdrop, then the
 * photo masked by the person mask (alpha = person), stretched to the photo's size.
 * Returns an upright JPEG to render like any other shot.
 */
export async function replaceBackground(
  photo: Uint8Array,
  maskUri: string,
  backdrop: Backdrop,
): Promise<Uint8Array> {
  const image = decodeImage(photo);
  const mask = await decodeImageFile(maskUri);
  const width = image.width();
  const height = image.height();
  const surface = makeSurface(width, height);
  const maskPaint = Skia.Paint();
  try {
    const canvas = surface.getCanvas();
    const bounds = Skia.XYWHRect(0, 0, width, height);
    drawBackdrop(canvas, backdrop, width, height);

    // The person, cut out in a layer of their own so the mask only affects them.
    canvas.saveLayer(undefined, bounds);
    canvas.drawImage(image, 0, 0);
    maskPaint.setBlendMode(BlendMode.DstIn);
    canvas.drawImageRect(mask, Skia.XYWHRect(0, 0, mask.width(), mask.height()), bounds, maskPaint);
    canvas.restore();
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    try {
      return encodeJpeg(snapshot);
    } finally {
      snapshot.dispose();
    }
  } finally {
    maskPaint.dispose();
    surface.dispose();
    mask.dispose();
    image.dispose();
  }
}
