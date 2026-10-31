import { describe, expect, it } from 'vitest';

import { primaryFaceEyes, type DetectedFace } from './eye-openness.worklet';

const face = (size: number, left?: number, right?: number): DetectedFace => ({
  bounds: { width: size, height: size },
  ...(left === undefined ? {} : { leftEyeOpenProbability: left }),
  ...(right === undefined ? {} : { rightEyeOpenProbability: right }),
});

describe('primaryFaceEyes', () => {
  it('returns null when no face is visible', () => {
    expect(primaryFaceEyes([])).toBeNull();
  });

  it('reads the largest face, ignoring people further away', () => {
    expect(primaryFaceEyes([face(50, 0.1, 0.1), face(200, 0.9, 0.2), face(80, 0.5, 0.5)])).toEqual({
      left: 0.9,
      right: 0.2,
    });
  });

  it('returns null when the eyes could not be classified', () => {
    expect(primaryFaceEyes([face(200, 0.9)])).toBeNull();
  });
});
