import { assertFrameSize } from '../frame';
import {
  HSL_BANDS,
  MAX_LOCAL_ADJUSTMENTS,
  type DetailParams,
  type LocalAdjustment,
} from './detail-params';

type Vec4 = readonly [number, number, number, number];
type LocalSlot = 0 | 1 | 2 | 3;

/** Uniform values keyed exactly as declared in the detail shader. */
export type DetailUniforms = {
  readonly resolution: readonly [number, number];
  readonly sharpen: number;
  readonly highlights: number;
  readonly shadows: number;
  readonly vibrance: number;
  readonly dehaze: number;
  readonly clarity: number;
  readonly sky: number;
  readonly sunset: number;
  /** Shadows, midtones and highlights: hues in degrees, then how strongly each tints. */
  readonly gradeHues: Vec4;
  readonly gradeAmounts: Vec4;
  readonly curve: Vec4;
  readonly curveRed: Vec4;
  readonly curveGreen: Vec4;
  readonly curveBlue: Vec4;
  /** Black point and white point shifts (EDT-31). */
  readonly levels: readonly [number, number];
  readonly hueA: Vec4;
  readonly hueB: Vec4;
  readonly saturationA: Vec4;
  readonly saturationB: Vec4;
  readonly luminanceA: Vec4;
  readonly luminanceB: Vec4;
  /** Each graduated filter's direction, in radians clockwise from up. */
  readonly localAngles: Vec4;
} & { readonly [Slot in LocalSlot as `local${Slot}Area` | `local${Slot}Adjust`]: Vec4 };

/** `adjust.w` of a local slot: which shape it has, or that it is empty. */
const SHAPE_CODE = { radial: 1, linear: 2 } as const;

const ABSENT = [0, 0, 0, 0] as const;

function bands(params: DetailParams, part: 'Hue' | 'Saturation' | 'Luminance', from: number): Vec4 {
  'worklet';
  const value = (index: number) => {
    const band = HSL_BANDS[from + index];
    return band === undefined ? 0 : params[`${band}${part}`];
  };
  return [value(0), value(1), value(2), value(3)];
}

/** Marked as a worklet so it can run on the camera frame thread. */
export function toDetailUniforms(
  params: DetailParams,
  local: readonly LocalAdjustment[],
  frame: { readonly width: number; readonly height: number },
): DetailUniforms {
  'worklet';
  assertFrameSize(frame.width, frame.height);
  const area = (index: number): Vec4 => {
    const item = local[index];
    return item === undefined || index >= MAX_LOCAL_ADJUSTMENTS
      ? ABSENT
      : [item.x, item.y, item.radius, item.feather];
  };
  const adjust = (index: number): Vec4 => {
    const item = local[index];
    return item === undefined || index >= MAX_LOCAL_ADJUSTMENTS
      ? ABSENT
      : [item.brightness, item.saturation, item.temperature, SHAPE_CODE[item.shape]];
  };
  const angle = (index: number) => ((local[index]?.angle ?? 0) * Math.PI) / 180;
  return {
    resolution: [frame.width, frame.height],
    sharpen: params.sharpen,
    highlights: params.highlights,
    shadows: params.shadows,
    vibrance: params.vibrance,
    dehaze: params.dehaze,
    clarity: params.clarity,
    sky: params.sky,
    sunset: params.sunset,
    gradeHues: [params.gradeShadowsHue, params.gradeMidtonesHue, params.gradeHighlightsHue, 0],
    gradeAmounts: [
      params.gradeShadowsAmount,
      params.gradeMidtonesAmount,
      params.gradeHighlightsAmount,
      0,
    ],
    curve: [params.curveShadows, params.curveDarks, params.curveLights, params.curveHighlights],
    curveRed: [
      params.curveRedShadows,
      params.curveRedDarks,
      params.curveRedLights,
      params.curveRedHighlights,
    ],
    curveGreen: [
      params.curveGreenShadows,
      params.curveGreenDarks,
      params.curveGreenLights,
      params.curveGreenHighlights,
    ],
    curveBlue: [
      params.curveBlueShadows,
      params.curveBlueDarks,
      params.curveBlueLights,
      params.curveBlueHighlights,
    ],
    levels: [params.blacks, params.whites],
    hueA: bands(params, 'Hue', 0),
    hueB: bands(params, 'Hue', 4),
    saturationA: bands(params, 'Saturation', 0),
    saturationB: bands(params, 'Saturation', 4),
    luminanceA: bands(params, 'Luminance', 0),
    luminanceB: bands(params, 'Luminance', 4),
    localAngles: [angle(0), angle(1), angle(2), angle(3)],
    local0Area: area(0),
    local0Adjust: adjust(0),
    local1Area: area(1),
    local1Adjust: adjust(1),
    local2Area: area(2),
    local2Adjust: adjust(2),
    local3Area: area(3),
    local3Adjust: adjust(3),
  };
}
