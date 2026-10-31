/**
 * Throws unless the size is usable as a shader resolution.
 * Marked as a worklet so it can run on the camera frame thread.
 */
export function assertFrameSize(width: number, height: number): void {
  'worklet';
  const valid = Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;
  if (!valid) {
    throw new RangeError(`Invalid frame size: ${String(width)}x${String(height)}`);
  }
}

/**
 * Rendering quality: 1 is full; 0 trims the costliest sampling (beauty's outer
 * ring, half the bloom taps) when the live preview cannot keep its frame rate
 * (03 §2). Saved photos always render at full quality.
 */
export const FULL_QUALITY = 1;
export const REDUCED_QUALITY = 0;
