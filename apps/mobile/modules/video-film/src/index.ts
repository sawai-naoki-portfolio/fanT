import { requireOptionalNativeModule } from 'expo';

export interface VideoInfo {
  readonly width: number;
  readonly height: number;
  readonly durationMs: number;
}

interface VideoFilmModule {
  applyLut(inputUri: string, outputUri: string, size: number, rgbaBase64: string): Promise<void>;
  thumbnail(videoUri: string, jpegUri: string): Promise<VideoInfo>;
  encodeFrames(frameUris: string[], fps: number, outputUri: string): Promise<void>;
}

/** `null` where the native module is not built in (e.g. tests, web). */
const native = requireOptionalNativeModule<VideoFilmModule>('VideoFilm');

function required(): VideoFilmModule {
  if (native === null) throw new Error('Video is not supported in this build');
  return native;
}

/**
 * Re-encodes a video with a 3D LUT applied to every frame (CAM-13), on the device.
 * The LUT is RGBA8 laid out like the film shader's: `size` slices of `size`×`size`
 * side by side, blue selecting the slice. Sound is kept.
 */
export function applyLut(
  inputUri: string,
  outputUri: string,
  lut: { readonly size: number; readonly rgbaBase64: string },
): Promise<void> {
  return required().applyLut(inputUri, outputUri, lut.size, lut.rgbaBase64);
}

/**
 * Encodes JPEG frames, all one size, into an MP4 at `fps` frames a second
 * (EDT-37), on the device.
 */
export function encodeFrames(
  frameUris: readonly string[],
  fps: number,
  outputUri: string,
): Promise<void> {
  return required().encodeFrames([...frameUris], fps, outputUri);
}

/** Writes the first frame, upright, as a JPEG and returns the video's size and length. */
export function videoThumbnail(videoUri: string, jpegUri: string): Promise<VideoInfo> {
  return required().thumbnail(videoUri, jpegUri);
}
