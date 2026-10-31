import { ImageFormat, Skia } from '@shopify/react-native-skia';

import type { Size } from '../features/photo/geometry';
import type { DecoStroke } from '../features/photo/recipe';
import { drawStrokeMask } from './stroke-mask';
import { makeSurface } from './surface';

/**
 * The erase tool's mask (AI-10): the painted strokes in white on black, at the size
 * of the uploaded photo, as a PNG.
 */
export function encodeEraseMask(strokes: readonly DecoStroke[], size: Size): Uint8Array {
  const surface = makeSurface(size.width, size.height);
  try {
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('#000000'));
    drawStrokeMask(canvas, strokes, size);
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    try {
      return snapshot.encodeToBytes(ImageFormat.PNG, 100);
    } finally {
      snapshot.dispose();
    }
  } finally {
    surface.dispose();
  }
}
