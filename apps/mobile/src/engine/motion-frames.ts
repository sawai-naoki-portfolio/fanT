import {
  compileRuntimeEffect,
  MOTION_SHADER_NAME,
  MOTION_SHADER_SOURCE,
  packUniforms,
  type MotionUniforms,
} from '@fant/filters';
import {
  FilterMode,
  MipmapMode,
  Skia,
  TileMode,
  type SkImage,
  type SkRuntimeEffect,
} from '@shopify/react-native-skia';
import { File, type Directory } from 'expo-file-system';

import { loopPhases } from '../features/motion/motion-settings';
import type { DecoStroke } from '../features/photo/recipe';
import { encodeJpeg, imageSize } from './photo';
import { softStrokeMask } from './stroke-mask';
import { makeSurface } from './surface';

/** Soft edge of the moving area, as a fraction of the short edge. */
const FEATHER = 0.015;

let motion: SkRuntimeEffect | undefined;

/** A moving photo's still photo, its moving area and how it flows (EDT-37). */
export interface MotionInput {
  readonly photo: SkImage;
  readonly strokes: readonly DecoStroke[];
  readonly flow: readonly [number, number];
}

/**
 * Draws each frame of one loop and hands it to `onFrame`, which returns `true` to keep
 * the frame (it then frees it); other frames are freed at once.
 */
function eachFrame(
  input: MotionInput,
  count: number,
  onFrame: (frame: SkImage, index: number) => boolean,
) {
  const size = imageSize(input.photo);
  const mask = softStrokeMask(input.strokes, size, FEATHER);
  const imageShader = input.photo.makeShaderOptions(
    TileMode.Mirror,
    TileMode.Mirror,
    FilterMode.Linear,
    MipmapMode.None,
  );
  const maskShader = mask.makeShaderOptions(
    TileMode.Decal,
    TileMode.Decal,
    FilterMode.Linear,
    MipmapMode.None,
  );
  const surface = makeSurface(size.width, size.height);
  const paint = Skia.Paint();
  motion ??= compileRuntimeEffect(Skia.RuntimeEffect, MOTION_SHADER_NAME, MOTION_SHADER_SOURCE);
  try {
    for (const [index, phase] of loopPhases(count).entries()) {
      const uniforms = {
        resolution: [size.width, size.height],
        flow: [...input.flow],
        phase,
      } satisfies MotionUniforms;
      const shader = motion.makeShaderWithChildren(packUniforms(motion, uniforms), [
        imageShader,
        maskShader,
      ]);
      try {
        paint.setShader(shader);
        surface.getCanvas().drawRect(Skia.XYWHRect(0, 0, size.width, size.height), paint);
        surface.flush();
        const frame = surface.makeImageSnapshot();
        let kept = false;
        try {
          kept = onFrame(frame, index);
        } finally {
          if (!kept) frame.dispose();
        }
      } finally {
        shader.dispose();
      }
    }
  } finally {
    paint.dispose();
    surface.dispose();
    maskShader.dispose();
    imageShader.dispose();
    mask.dispose();
  }
}

/** Frames of one loop as images, for a preview; the caller disposes them. */
export function motionPreviewFrames(input: MotionInput, count: number): SkImage[] {
  const frames: SkImage[] = [];
  eachFrame(input, count, (frame) => {
    frames.push(frame);
    return true;
  });
  return frames;
}

/** Writes the frames of one loop as JPEG files in `folder`; returns their URIs in order. */
export function writeMotionFrames(input: MotionInput, count: number, folder: Directory): string[] {
  const uris: string[] = [];
  eachFrame(input, count, (frame, index) => {
    const file = new File(folder, `${String(index).padStart(3, '0')}.jpg`);
    file.writeSync(encodeJpeg(frame));
    uris.push(file.uri);
    return false;
  });
  return uris;
}
