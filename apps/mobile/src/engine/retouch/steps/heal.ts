import {
  BlendMode,
  Skia,
  TileMode,
  vec,
  type SkCanvas,
  type SkImage,
} from '@shopify/react-native-skia';

import type { Size } from '../../../features/photo/geometry';
import type { HealSpot } from '../../../features/retouch/retouch';
import { drawImage } from '../drawing';
import type { RetouchStep } from '../types';

/** Smooths a blemish into the skin around it: a blurred copy, faded out at the edge. */
function healSpot(canvas: SkCanvas, image: SkImage, spot: HealSpot, size: Size): void {
  const short = Math.min(size.width, size.height);
  const radius = spot.radius * short;
  const center = { x: spot.x * size.width, y: spot.y * size.height };
  const bounds = Skia.XYWHRect(center.x - radius, center.y - radius, radius * 2, radius * 2);
  const fade = Skia.Paint();
  const gradient = Skia.Shader.MakeRadialGradient(
    vec(center.x, center.y),
    radius,
    [Skia.Color('black'), Skia.Color('black'), Skia.Color('transparent')],
    [0, 0.55, 1],
    TileMode.Clamp,
  );
  try {
    canvas.saveLayer(undefined, bounds);
    drawImage(canvas, image, radius * 0.45);
    fade.setShader(gradient);
    fade.setBlendMode(BlendMode.DstIn);
    canvas.drawRect(bounds, fade);
    canvas.restore();
  } finally {
    gradient.dispose();
    fade.dispose();
  }
}

/** Blemish removal (BTY-11). */
export const healStep: RetouchStep = {
  applies: ({ heal }) => heal.length > 0,
  run: ({ canvas, size, current }, { heal }) => {
    const photo = current();
    for (const spot of heal) healSpot(canvas, photo, spot, size);
  },
};
