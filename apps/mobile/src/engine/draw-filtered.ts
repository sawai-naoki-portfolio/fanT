import {
  chainLook,
  chainRetouch,
  type FilterEffects,
  type FilterSettings,
  type ShapedFace,
} from '@fant/filters';
import {
  FilterMode,
  MipmapMode,
  Skia,
  TileMode,
  type SkCanvas,
  type SkShader,
} from '@shopify/react-native-skia';

import type { LoadedLut } from './lut';

export interface FilterInputs {
  readonly effects: FilterEffects<SkShader>;
  readonly settings: FilterSettings;
  readonly seed: number;
  readonly lut: LoadedLut;
  /** Lower for a struggling live preview (03 §2); omitted (full) for photos. */
  readonly quality?: number;
  /** Faces for face fine-tuning (BTY-04), in the drawn rectangle's pixels. */
  readonly faces?: readonly ShapedFace[];
  /**
   * Drawn over the retouched image and under the film look, e.g. character
   * stickers (CHR-04): they get the film's texture but are not smoothed.
   */
  readonly overlay: ((canvas: SkCanvas) => void) | null;
}

/**
 * Draws `source` through face shape → adjust → beauty → (overlay) → film → date stamp into the
 * rectangle (0, 0, width, height). The live preview and the saved photo both use
 * this, so they always look the same (03 §3).
 *
 * Marked as a worklet so it can run on the camera thread. Every Skia object it makes
 * is disposed before returning; native memory is invisible to the JS garbage collector.
 */
export function drawFiltered(
  canvas: SkCanvas,
  source: SkShader,
  size: { readonly width: number; readonly height: number },
  inputs: FilterInputs,
): void {
  'worklet';
  const { effects, settings, seed, lut, overlay, quality, faces } = inputs;
  const frame = { width: size.width, height: size.height, seed, quality, faces };
  const bounds = Skia.XYWHRect(0, 0, size.width, size.height);
  const paint = Skia.Paint();
  const disposables: { dispose(): void }[] = [paint];
  try {
    const retouch = chainRetouch(effects, settings, frame, source);
    disposables.push(...retouch.created);
    let lookSource = retouch.shader;
    if (overlay !== null) {
      const recorder = Skia.PictureRecorder();
      disposables.push(recorder);
      const pictureCanvas = recorder.beginRecording(bounds);
      const basePaint = Skia.Paint();
      disposables.push(basePaint);
      basePaint.setShader(retouch.shader);
      pictureCanvas.drawRect(bounds, basePaint);
      overlay(pictureCanvas);
      const picture = recorder.finishRecordingAsPicture();
      disposables.push(picture);
      lookSource = picture.makeShader(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear);
      disposables.push(lookSource);
    }
    const lutShader = lut.image.makeShaderOptions(
      TileMode.Clamp,
      TileMode.Clamp,
      FilterMode.Linear,
      MipmapMode.None,
    );
    disposables.push(lutShader);
    const look = chainLook(effects, settings, frame, lookSource, {
      shader: lutShader,
      size: lut.size,
    });
    disposables.push(...look.created);
    paint.setShader(look.shader);
    canvas.drawRect(bounds, paint);
  } finally {
    for (let i = disposables.length - 1; i >= 0; i--) disposables[i]?.dispose();
  }
}
