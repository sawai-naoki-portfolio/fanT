import { assertFrameSize, FULL_QUALITY } from '../frame';
import type { BeautyParams } from './beauty-params';

/** Uniform values keyed exactly as declared in the beauty shader. */
export type BeautyUniforms = BeautyParams & {
  readonly resolution: readonly [number, number];
  readonly quality: number;
};

/** Marked as a worklet so it can run on the camera frame thread. */
export function toBeautyUniforms(
  params: BeautyParams,
  frame: { readonly width: number; readonly height: number; readonly quality?: number },
): BeautyUniforms {
  'worklet';
  assertFrameSize(frame.width, frame.height);
  return {
    ...params,
    resolution: [frame.width, frame.height],
    quality: frame.quality ?? FULL_QUALITY,
  };
}
