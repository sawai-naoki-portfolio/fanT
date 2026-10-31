import { Skia, type SkCanvas, type SkImage } from '@shopify/react-native-skia';

import { changesTone, toneMatrix, type AreaTone } from '../../../features/selection/area-tone';
import { drawImage, keepMasked, keepOutside } from '../drawing';
import type { RetouchStep } from '../types';

/** Draws `photo` re-toned in a layer, then `keep` cuts the layer to its area. */
export function toneLayer(
  canvas: SkCanvas,
  photo: SkImage,
  tone: AreaTone,
  keep: () => void,
): void {
  const layer = Skia.Paint();
  const colors = Skia.ColorFilter.MakeMatrix(toneMatrix(tone));
  try {
    layer.setColorFilter(colors);
    canvas.saveLayer(layer);
    drawImage(canvas, photo);
    keep();
    canvas.restore();
  } finally {
    colors.dispose();
    layer.dispose();
  }
}

/** The people and the background toned on their own (EDT-34). */
export const selectiveStep: RetouchStep = {
  applies: ({ mask, selective }) =>
    mask !== null && (changesTone(selective.people) || changesTone(selective.background)),
  run: ({ canvas, current }, { mask, selective }) => {
    if (mask === null) return;
    const photo = current();
    if (changesTone(selective.people)) {
      toneLayer(canvas, photo, selective.people, () => {
        keepMasked(canvas, mask);
      });
    }
    if (changesTone(selective.background)) {
      toneLayer(canvas, photo, selective.background, () => {
        keepOutside(canvas, mask);
      });
    }
  },
};
