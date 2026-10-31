import { describe, expect, it } from 'vitest';

import {
  compileRuntimeEffect,
  DEFAULT_FACE_SHAPE_PARAMS,
  FACE_SHAPE_SHADER_NAME,
  FACE_SHAPE_SHADER_SOURCE,
  toFaceShapeUniforms,
  type FaceShapeParams,
  type ShapedFace,
} from '../src';
import {
  createBitmap,
  loadCanvasKit,
  maxChannelDifference,
  pixelAt,
  renderEffect,
  uniformNames,
} from './canvaskit';

const ck = await loadCanvasKit();
const effect = compileRuntimeEffect(
  ck.RuntimeEffect,
  FACE_SHAPE_SHADER_NAME,
  FACE_SHAPE_SHADER_SOURCE,
);

const SIZE = 256;
/** A face filling the frame, upright, with its eyes on row 96. */
const FACE: ShapedFace = { leftEye: [80, 96], rightEye: [176, 96], center: [128, 128], width: 192 };
/** A horizontal ramp: horizontal movement shows up as a changed red. */
const STRIPES = createBitmap(SIZE, SIZE, (x) => [x, 255 - x, 128, 255]);

function render(params: FaceShapeParams, faces: readonly ShapedFace[] = [FACE]) {
  return renderEffect(ck, effect, toFaceShapeUniforms(params, faces), STRIPES);
}

describe(`${FACE_SHAPE_SHADER_NAME} shader`, () => {
  it('declares exactly the uniforms produced by toFaceShapeUniforms', () => {
    const uniforms = toFaceShapeUniforms(DEFAULT_FACE_SHAPE_PARAMS, []);
    expect(uniformNames(effect).sort()).toEqual(Object.keys(uniforms).sort());
  });

  it('leaves the image untouched when off or without faces', () => {
    expect(maxChannelDifference(render(DEFAULT_FACE_SHAPE_PARAMS), STRIPES)).toBe(0);
    expect(
      maxChannelDifference(render({ ...DEFAULT_FACE_SHAPE_PARAMS, eyes: 1, slim: 1 }, []), STRIPES),
    ).toBe(0);
  });

  it('enlarges around the eyes and leaves the eye centres and far pixels alone', () => {
    const output = render({ ...DEFAULT_FACE_SHAPE_PARAMS, eyes: 1 });
    // Beside an eye the image is sampled closer to the eye: magnified.
    expect(pixelAt(output, 96, 96)[0]).toBeLessThan(pixelAt(STRIPES, 96, 96)[0]);
    expect(pixelAt(output, 80, 96)).toEqual(pixelAt(STRIPES, 80, 96));
    expect(pixelAt(output, 4, 250)).toEqual(pixelAt(STRIPES, 4, 250));
  });

  it('narrows the lower face towards its middle, subtly', () => {
    const output = render({ ...DEFAULT_FACE_SHAPE_PARAMS, slim: 1 });
    const [before] = pixelAt(STRIPES, 72, 176);
    const [after] = pixelAt(output, 72, 176);
    // Sampled from farther out (left of the axis: a smaller x, a darker red).
    expect(after).toBeLessThan(before);
    // Subtle: well under a tenth of the face width.
    expect(before - after).toBeLessThan(192 * 0.1);
  });

  it('narrows the nose and raises the chin, subtly', () => {
    // Eyes 96 px apart: the nose is about 69 px and the chin about 168 px below them.
    const narrowed = render({ ...DEFAULT_FACE_SHAPE_PARAMS, nose: 1 });
    expect(pixelAt(narrowed, 116, 165)[0]).toBeLessThan(pixelAt(STRIPES, 116, 165)[0]);
    const rows = createBitmap(SIZE, SIZE, (_, y) => [y, 255 - y, 128, 255]);
    const raised = renderEffect(
      ck,
      effect,
      toFaceShapeUniforms({ ...DEFAULT_FACE_SHAPE_PARAMS, chin: 1 }, [FACE]),
      rows,
    );
    // Sampled from lower down: a larger row number.
    expect(pixelAt(raised, 128, 250)[0]).toBeGreaterThanOrEqual(pixelAt(rows, 128, 250)[0]);
    expect(pixelAt(raised, 128, 240)[0]).toBeGreaterThan(pixelAt(rows, 128, 240)[0]);
  });
});
