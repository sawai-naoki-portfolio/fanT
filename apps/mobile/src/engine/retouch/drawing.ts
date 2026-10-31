import {
  BlendMode,
  FilterMode,
  MipmapMode,
  Skia,
  TileMode,
  type SkCanvas,
  type SkImage,
  type SkShader,
} from '@shopify/react-native-skia';

import type { PlacedMask } from './types';

/** Draws an image at the origin, blurred by `blurSigma` pixels when above zero. */
export function drawImage(canvas: SkCanvas, image: SkImage, blurSigma = 0): void {
  const paint = Skia.Paint();
  const blur =
    blurSigma > 0 ? Skia.ImageFilter.MakeBlur(blurSigma, blurSigma, TileMode.Clamp, null) : null;
  try {
    if (blur !== null) paint.setImageFilter(blur);
    canvas.drawImage(image, 0, 0, paint);
  } finally {
    blur?.dispose();
    paint.dispose();
  }
}

/** Keeps only what lies under the opaque parts of `shader` (destination-in). */
export function keepWhere(canvas: SkCanvas, shader: SkShader): void {
  const paint = Skia.Paint();
  try {
    paint.setShader(shader);
    paint.setBlendMode(BlendMode.DstIn);
    canvas.drawPaint(paint);
  } finally {
    paint.dispose();
  }
}

/** The mask placed on the output, as a shader whose alpha is the mask. */
function maskShader(mask: PlacedMask): SkShader {
  return mask.image.makeShaderOptions(
    TileMode.Clamp,
    TileMode.Clamp,
    FilterMode.Linear,
    MipmapMode.None,
    mask.matrix,
  );
}

/** Keeps only what is under a mask, e.g. the people or the sky. */
export function keepMasked(canvas: SkCanvas, mask: PlacedMask): void {
  const shader = maskShader(mask);
  try {
    keepWhere(canvas, shader);
  } finally {
    shader.dispose();
  }
}

/** Keeps only what is outside a mask (destination-out), e.g. the background. */
export function keepOutside(canvas: SkCanvas, mask: PlacedMask): void {
  const shader = maskShader(mask);
  const paint = Skia.Paint();
  try {
    paint.setShader(shader);
    paint.setBlendMode(BlendMode.DstOut);
    canvas.drawPaint(paint);
  } finally {
    paint.dispose();
    shader.dispose();
  }
}

/**
 * Redraws the canvas as `base`, then `over` cut to `keep` on top: the common shape
 * of a new background, a blurred background, or a blur beyond the focus.
 */
export function layered(
  canvas: SkCanvas,
  base: () => void,
  over: () => void,
  keep: () => void,
): void {
  canvas.clear(Skia.Color('transparent'));
  base();
  canvas.saveLayer();
  over();
  keep();
  canvas.restore();
}
