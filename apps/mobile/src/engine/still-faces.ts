import {
  createImageFaceDetector,
  type ImageFaceDetector,
} from 'react-native-vision-camera-face-detector';

import type { DetectedFace } from '../features/character/face-geometry.worklet';

let detector: ImageFaceDetector | undefined;
/** The last photo's faces: the editor re-renders the same original many times. */
let cached: { readonly uri: string; readonly faces: DetectedFace[] } | null = null;

/**
 * Faces in a photo file (for re-rendering characters at full resolution, 07 §5.2),
 * copied into plain objects. The detector's own objects are freed at once; the
 * result stays in memory only, never on disk (03 §6).
 */
export function detectFacesInImage(uri: string): DetectedFace[] {
  if (cached?.uri === uri) return cached.faces;
  detector ??= createImageFaceDetector({
    performanceMode: 'accurate',
    runLandmarks: true,
    // Makeup follows the feature outlines (BTY-07).
    runContours: true,
    minFaceSize: 0.1,
  });
  const faces = detector.detectFaces(uri);
  try {
    const copied = faces.map((face) => ({
      bounds: { ...face.bounds },
      landmarks: face.landmarks === undefined ? undefined : { ...face.landmarks },
      contours: face.contours === undefined ? undefined : { ...face.contours },
      yawAngle: face.yawAngle,
      pitchAngle: face.pitchAngle,
    }));
    cached = { uri, faces: copied };
    return copied;
  } finally {
    for (const face of faces) face.dispose();
  }
}
