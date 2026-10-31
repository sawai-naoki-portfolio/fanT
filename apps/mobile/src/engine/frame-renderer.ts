import { FilterMode, MipmapMode, TileMode } from '@shopify/react-native-skia';
import { useCallback } from 'react';
import type { SkiaCameraProps } from 'react-native-vision-camera-skia';
import type { Synchronizable } from 'react-native-worklets';

import {
  shapesFaces,
  toShapedFaces,
  type FaceGeometry,
} from '../features/character/face-geometry.worklet';
import { hasMakeup, type Makeup } from '../features/makeup/makeup';
import type { FrameSample } from '../features/performance/frame-stats.worklet';
import { fromMatrix3, invert, toMatrix3 } from './affine.worklet';
import type { CharacterDrawing } from './draw-character';
import { faceOverlay } from './face-overlay';
import { drawFiltered, type FilterInputs } from './draw-filtered';
import type { FrameAnalyzer } from './face-tracking';

export interface FrameRendererOptions {
  readonly inputs: Omit<FilterInputs, 'overlay'>;
  /** Drawn on the tracked faces (character mode); face fine-tuning also uses them. */
  readonly character: CharacterDrawing | null;
  /** Makeup on the tracked faces (BTY-07/09/10). */
  readonly makeup: Makeup | null;
  readonly faces: Synchronizable<FaceGeometry[]>;
  readonly analyze: FrameAnalyzer | null;
  /** Receives each frame's timings (performance overlay, P-1). */
  readonly recordStats: ((sample: FrameSample) => void) | null;
}

/**
 * The `SkiaCamera` frame callback: draws every camera frame through the same
 * filter chain as the saved photo, upright, then runs face analysis (after drawing,
 * so analysis never delays the preview). Runs as a worklet on the camera thread.
 *
 * `SkiaCamera` rotates and mirrors its canvas to make the raw frame upright. Effects
 * that depend on position (date stamp, stickers, vignette) must be laid out upright,
 * so the canvas transform is moved into the frame's shader and the chain is drawn in
 * upright coordinates.
 *
 * Every Skia object made for a frame is disposed before the frame is released.
 */
export function useFrameRenderer({
  inputs,
  character,
  makeup,
  faces,
  analyze,
  recordStats,
}: FrameRendererOptions): SkiaCameraProps['onFrame'] {
  return useCallback<SkiaCameraProps['onFrame']>(
    (frame, render) => {
      'worklet';
      try {
        const landscape = frame.orientation === 'left' || frame.orientation === 'right';
        const output = landscape
          ? { width: frame.height, height: frame.width }
          : { width: frame.width, height: frame.height };
        const startedAt = performance.now();
        render(({ canvas, frameTexture }) => {
          const toUpright = canvas.getTotalMatrix();
          const fromUpright = invert(fromMatrix3(toUpright.get()));
          canvas.save();
          canvas.concat(toMatrix3(fromUpright));
          const source = frameTexture.makeShaderOptions(
            TileMode.Clamp,
            TileMode.Clamp,
            FilterMode.Linear,
            MipmapMode.None,
            toUpright,
          );
          try {
            const shaping = shapesFaces(inputs.settings.faceShape);
            const withMakeup = makeup !== null && hasMakeup(makeup);
            const tracked =
              character === null && !shaping && !withMakeup ? [] : faces.getBlocking();
            drawFiltered(canvas, source, output, {
              ...inputs,
              faces: shaping ? toShapedFaces(tracked) : undefined,
              overlay: faceOverlay(tracked, makeup, character, startedAt / 1000),
            });
          } finally {
            source.dispose();
            toUpright.dispose();
            canvas.restore();
          }
        });
        const renderedAt = performance.now();
        const analyzed = analyze?.(frame, output) ?? false;
        recordStats?.({
          renderMs: renderedAt - startedAt,
          analysisMs: analyzed ? performance.now() - renderedAt : null,
        });
      } finally {
        frame.dispose();
      }
    },
    [inputs, character, makeup, faces, analyze, recordStats],
  );
}
