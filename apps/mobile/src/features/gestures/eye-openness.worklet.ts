import type { EyeOpenness } from './wink-detector';

/** The parts of a detected face this app reads; the face detector plugin's `Face` fits it. */
export interface DetectedFace {
  readonly bounds: { readonly width: number; readonly height: number };
  readonly leftEyeOpenProbability?: number;
  readonly rightEyeOpenProbability?: number;
}

/**
 * Eye openness of the largest (closest) face, or `null` when no face is visible or
 * its eyes could not be classified. ML Kit reports the face's own left and right
 * eyes, which is the user's point of view regardless of preview mirroring.
 * Marked as a worklet so it can run on the camera frame thread.
 */
export function primaryFaceEyes(faces: readonly DetectedFace[]): EyeOpenness | null {
  'worklet';
  let primary: DetectedFace | null = null;
  let largestArea = 0;
  for (const face of faces) {
    const area = face.bounds.width * face.bounds.height;
    if (area > largestArea) {
      largestArea = area;
      primary = face;
    }
  }
  const left = primary?.leftEyeOpenProbability;
  const right = primary?.rightEyeOpenProbability;
  if (left === undefined || right === undefined) return null;
  return { left, right };
}
