import type { FaceShapeParams } from './face-shape-params';

type Vec2 = readonly [number, number];

/** A face to reshape, in frame pixels; the eyes as seen in the image (left first). */
export interface ShapedFace {
  readonly leftEye: Vec2;
  readonly rightEye: Vec2;
  readonly center: Vec2;
  readonly width: number;
}

/** Faces the shader reshapes; the app tracks at most this many (CHR-05, BTY-05). */
export const MAX_SHAPED_FACES = 4;

type FaceSlot = 0 | 1 | 2 | 3;
type FaceUniforms = {
  readonly [Slot in FaceSlot as `face${Slot}Eyes` | `face${Slot}Shape`]: readonly [
    number,
    number,
    number,
    number,
  ];
};

/** Uniform values keyed exactly as declared in the face shape shader. */
export type FaceShapeUniforms = FaceShapeParams & FaceUniforms;

const ABSENT = [0, 0, 0, 0] as const;

/** Marked as a worklet so it can run on the camera frame thread. */
export function toFaceShapeUniforms(
  params: FaceShapeParams,
  faces: readonly ShapedFace[],
): FaceShapeUniforms {
  'worklet';
  const slot = (index: number) => {
    const face = faces[index];
    return face === undefined
      ? { eyes: ABSENT, shape: ABSENT }
      : {
          eyes: [face.leftEye[0], face.leftEye[1], face.rightEye[0], face.rightEye[1]] as const,
          shape: [face.center[0], face.center[1], face.width, 1] as const,
        };
  };
  const [f0, f1, f2, f3] = [slot(0), slot(1), slot(2), slot(3)];
  return {
    ...params,
    face0Eyes: f0.eyes,
    face0Shape: f0.shape,
    face1Eyes: f1.eyes,
    face1Shape: f1.shape,
    face2Eyes: f2.eyes,
    face2Shape: f2.shape,
    face3Eyes: f3.eyes,
    face3Shape: f3.shape,
  };
}
