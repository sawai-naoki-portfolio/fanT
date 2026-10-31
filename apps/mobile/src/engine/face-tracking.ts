import { useCallback, useMemo } from 'react';
import type { Frame } from 'react-native-vision-camera';
import {
  useFaceDetector,
  type FaceDetectorOptions,
} from 'react-native-vision-camera-face-detector';
import { createSynchronizable, scheduleOnRN, type Synchronizable } from 'react-native-worklets';

import {
  primaryFaces,
  toFaceGeometry,
  type FaceGeometry,
} from '../features/character/face-geometry.worklet';
import { primaryFaceEyes } from '../features/gestures/eye-openness.worklet';
import type { EyeOpenness } from '../features/gestures/wink-detector';
import type { Affine } from './affine.worklet';

/** Every other frame (~12 times a second at 24fps) is plenty for winks and stickers. */
const DETECT_EVERY_N_FRAMES = 2;

export interface FaceTrackingOptions {
  /** Eye openness for winks (GST-01); `null` turns it off. */
  readonly onEyes: ((eyes: EyeOpenness | null) => void) | null;
  /** Face positions for characters (CHR-01), face fine-tuning and makeup. */
  readonly trackFaces: boolean;
  /** Feature outlines too (makeup, BTY-07); the detector does more work. */
  readonly trackOutlines?: boolean;
}

/** Runs on the camera thread after drawing; returns whether it analysed the frame. */
export type FrameAnalyzer = (
  frame: Frame,
  output: { readonly width: number; readonly height: number },
) => boolean;

export interface FaceTracking {
  readonly analyze: FrameAnalyzer | null;
  /** The latest faces in preview pixels, read by the renderer for the next frame. */
  readonly faces: Synchronizable<FaceGeometry[]>;
}

/**
 * Face detection on the preview frames (ML Kit, D-09), shared by winks and
 * characters so the camera runs one detector. Face data stays in memory on the
 * camera thread; only eye openness is sent to the JS thread (03 §6).
 * A detection failure is reported once and never breaks the preview.
 */
export function useFaceTracking({
  onEyes,
  trackFaces,
  trackOutlines = false,
}: FaceTrackingOptions): FaceTracking {
  const options = useMemo<FaceDetectorOptions>(
    () => ({
      performanceMode: 'fast',
      runClassifications: onEyes !== null,
      runLandmarks: trackFaces,
      runContours: trackFaces && trackOutlines,
      // Ignore faces smaller than 15% of the frame (people in the background).
      minFaceSize: 0.15,
    }),
    [onEyes, trackFaces, trackOutlines],
  );
  const detector = useFaceDetector(options);
  const frameCount = useMemo(() => createSynchronizable(0), []);
  const failureReported = useMemo(() => createSynchronizable(false), []);
  const faces = useMemo(() => createSynchronizable<FaceGeometry[]>([]), []);
  const enabled = onEyes !== null || trackFaces;

  const analyze = useCallback<FrameAnalyzer>(
    (frame, output) => {
      'worklet';
      const count = frameCount.getBlocking();
      frameCount.setBlocking(count + 1);
      if (count % DETECT_EVERY_N_FRAMES !== 0) return false;
      try {
        const detected = detector.detectFaces(frame);
        try {
          if (onEyes !== null) scheduleOnRN(onEyes, primaryFaceEyes(detected));
          if (trackFaces) {
            const first = detected[0];
            const sourceWidth = first?.frameWidth ?? output.width;
            const sourceHeight = first?.frameHeight ?? output.height;
            const sx = output.width / sourceWidth;
            const sy = output.height / sourceHeight;
            // Detector coordinates are upright but never mirrored; the preview is for the front camera.
            const map: Affine = frame.isMirrored
              ? [-sx, 0, output.width, 0, sy, 0]
              : [sx, 0, 0, 0, sy, 0];
            faces.setBlocking(primaryFaces(detected.map((face) => toFaceGeometry(face, map))));
          }
        } finally {
          for (const face of detected) face.dispose();
        }
      } catch (error) {
        if (!failureReported.getBlocking()) {
          failureReported.setBlocking(true);
          console.error('Face detection failed; winks and characters are unavailable', error);
        }
      }
      return true;
    },
    [detector, frameCount, failureReported, faces, onEyes, trackFaces],
  );

  return { analyze: enabled ? analyze : null, faces };
}
