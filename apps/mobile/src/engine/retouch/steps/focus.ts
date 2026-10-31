import { Skia, TileMode, vec, type SkShader } from '@shopify/react-native-skia';

import type { Size } from '../../../features/photo/geometry';
import {
  focusBlurSigma,
  focusGradient,
  type FocusBlur,
} from '../../../features/retouch/focus-blur';
import { drawImage, keepWhere, layered } from '../drawing';
import type { RetouchStep } from '../types';

/** A gradient that is opaque where the photo stays in focus. */
function focusShader(focus: FocusBlur, size: Size): SkShader {
  const gradient = focusGradient(focus, size);
  const opaque = Skia.Color('black');
  const clear = Skia.Color('transparent');
  if (gradient.kind === 'radial') {
    return Skia.Shader.MakeRadialGradient(
      vec(gradient.center.x, gradient.center.y),
      gradient.radius,
      [opaque, opaque, clear],
      [0, gradient.sharpTo, 1],
      TileMode.Clamp,
    );
  }
  return Skia.Shader.MakeLinearGradient(
    vec(gradient.from.x, gradient.from.y),
    vec(gradient.to.x, gradient.to.y),
    [clear, opaque, opaque, clear],
    [0, 0.25, 0.75, 1],
    TileMode.Clamp,
  );
}

/** Tilt-shift (EDT-23): blurred beyond the focus, needing no people. */
export const focusStep: RetouchStep = {
  applies: ({ focusBlur }) => focusBlur.amount > 0,
  run: ({ canvas, size, current }, { focusBlur }) => {
    const sharp = current();
    const gradient = focusShader(focusBlur, size);
    try {
      layered(
        canvas,
        () => {
          drawImage(canvas, sharp, focusBlurSigma(focusBlur, size));
        },
        () => {
          drawImage(canvas, sharp);
        },
        () => {
          keepWhere(canvas, gradient);
        },
      );
    } finally {
      gradient.dispose();
    }
  },
};
