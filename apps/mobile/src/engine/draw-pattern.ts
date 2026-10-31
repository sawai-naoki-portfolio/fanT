import type { SheetPattern } from '@fant/content-schema';
import { Skia, type SkCanvas } from '@shopify/react-native-skia';

import { drawShape } from './draw-shape';
import { STAMP_SHAPE_ART } from './shapes';

/** A repeating pattern in `color` over `width`×`height`: puri sheets and backdrops. */
export function drawPattern(
  canvas: SkCanvas,
  pattern: SheetPattern,
  color: string,
  width: number,
  height: number,
): void {
  if (pattern === 'plain') return;
  const paint = Skia.Paint();
  try {
    paint.setAntiAlias(true);
    paint.setColor(Skia.Color(color));
    const step = Math.min(width, height) / 12;
    for (let y = 0, row = 0; y < height + step; y += step, row++) {
      for (let x = 0, column = 0; x < width + step; x += step, column++) {
        if (pattern === 'dots') {
          canvas.drawCircle(x + (row % 2) * (step / 2), y, step * 0.14, paint);
        } else if (pattern === 'checker' && (row + column) % 2 === 0) {
          canvas.drawRect(Skia.XYWHRect(x, y, step, step), paint);
        } else if (pattern === 'hearts' && (row + column) % 2 === 0) {
          drawShape(canvas, STAMP_SHAPE_ART.heart, color, {
            center: { x, y },
            size: step * 0.5,
            rotation: -15,
            mirrored: false,
          });
        }
      }
      if (pattern === 'stripes' && row % 2 === 0)
        canvas.drawRect(Skia.XYWHRect(0, y, width, step), paint);
    }
  } finally {
    paint.dispose();
  }
}
