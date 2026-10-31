import { defineParams, type ParamRange, type ParamValues } from '../params';

/**
 * Face fine-tuning (BTY-04, BTY-08). Each is off (0) by default, and the strongest
 * setting is kept subtle in the shader itself: eyes at most about 15% larger at
 * their centre, the jaw about 6% and the nose about 12% narrower, the mouth about
 * 12% smaller or larger, the chin raised by about a tenth of the eye span.
 */
export const FACE_SHAPE_PARAM_RANGES = {
  /** Larger eyes. */
  eyes: { min: 0, max: 1, defaultValue: 0 },
  /** A slimmer lower face (cheeks and jaw). */
  slim: { min: 0, max: 1, defaultValue: 0 },
  /** A narrower nose (BTY-08). */
  nose: { min: 0, max: 1, defaultValue: 0 },
  /** A smaller (negative) or fuller (positive) mouth (BTY-08). */
  mouth: { min: -1, max: 1, defaultValue: 0 },
  /** A shorter chin (BTY-08). */
  chin: { min: 0, max: 1, defaultValue: 0 },
} as const satisfies Record<string, ParamRange>;

export type FaceShapeParamName = keyof typeof FACE_SHAPE_PARAM_RANGES;

export type FaceShapeParams = ParamValues<FaceShapeParamName>;

const faceShapeParams = defineParams(FACE_SHAPE_PARAM_RANGES);

/** Off: the photo keeps everyone's own face. */
export const DEFAULT_FACE_SHAPE_PARAMS: FaceShapeParams = faceShapeParams.defaults;

export const normalizeFaceShapeParams = faceShapeParams.normalize;
