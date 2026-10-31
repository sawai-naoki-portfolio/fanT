import { assertFrameSize, FULL_QUALITY } from '../frame';
import type { FilmParams } from './film-params';

/** Per-frame values that are not part of a film definition. */
export interface FilmFrame {
  /** Output size in pixels. */
  readonly width: number;
  readonly height: number;
  /** Random seed fixed at shutter time so the saved photo matches the preview. */
  readonly seed: number;
  /** Slices (and slice width) of the LUT image bound as the `lut` child. */
  readonly lutSize: number;
  /** `REDUCED_QUALITY` lightens the preview on slow devices; photos use full quality. */
  readonly quality?: number;
}

/** Uniform values keyed exactly as declared in the film shader. */
export type FilmUniforms = FilmParams & {
  readonly resolution: readonly [number, number];
  readonly seed: number;
  readonly lutSize: number;
  readonly quality: number;
};

/** Marked as a worklet so it can run on the camera frame thread. */
export function toFilmUniforms(params: FilmParams, frame: FilmFrame): FilmUniforms {
  'worklet';
  const { width, height, seed, lutSize } = frame;
  assertFrameSize(width, height);
  if (!Number.isFinite(seed)) {
    throw new RangeError(`Invalid seed: ${String(seed)}`);
  }
  if (!Number.isInteger(lutSize) || lutSize < 2) {
    throw new RangeError(`Invalid LUT size: ${String(lutSize)}`);
  }
  return {
    ...params,
    resolution: [width, height],
    seed,
    lutSize,
    quality: frame.quality ?? FULL_QUALITY,
  };
}
