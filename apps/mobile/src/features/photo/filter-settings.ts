import { resolveFilmParams, type Film } from '@fant/content-schema';
import {
  BEAUTY_LEVELS,
  colorOnlyFilmParams,
  DEFAULT_ADJUST_PARAMS,
  DEFAULT_BODY_PARAMS,
  DEFAULT_DETAIL_PARAMS,
  DEFAULT_FACE_SHAPE_PARAMS,
  DEFAULT_LENS_PARAMS,
  DEFAULT_LIGHT_PARAMS,
  toDateStampGlyphs,
  type AdjustParams,
  type BodyParams,
  type BeautyParams,
  type DateStamp,
  type DetailParams,
  type FaceShapeParams,
  type FilterSettings,
  type LensParams,
  type LightParams,
  type LocalAdjustment,
} from '@fant/filters';

/** Shader settings for one shot; the preview and the saved photo use the same ones. */
export function filterSettingsFor(input: {
  readonly film: Film;
  readonly intensity: number;
  readonly seed: number;
  readonly beauty: BeautyParams;
  readonly adjust?: AdjustParams;
  /** Face fine-tuning (BTY-04); off when omitted. */
  readonly faceShape?: FaceShapeParams;
  /** Body reshaping (EDT-13); none when omitted. */
  readonly body?: BodyParams;
  /** The editor's detailed adjustments and local areas (EDT-07–10); none when omitted. */
  readonly detail?: DetailParams;
  readonly local?: readonly LocalAdjustment[];
  /** Lens and noise corrections (EDT-20); none when omitted. */
  readonly lens?: LensParams;
  /** Light and weather (EDT-24); none when omitted. */
  readonly light?: LightParams;
  readonly dateStamp: DateStamp | null;
}): FilterSettings {
  return {
    lens: input.lens ?? DEFAULT_LENS_PARAMS,
    faceShape: input.faceShape ?? DEFAULT_FACE_SHAPE_PARAMS,
    body: input.body ?? DEFAULT_BODY_PARAMS,
    adjust: input.adjust ?? DEFAULT_ADJUST_PARAMS,
    beauty: input.beauty,
    detail: input.detail ?? DEFAULT_DETAIL_PARAMS,
    local: input.local ?? [],
    light: input.light ?? DEFAULT_LIGHT_PARAMS,
    film: resolveFilmParams(input.film, { intensity: input.intensity, seed: input.seed }),
    dateStamp: toDateStampGlyphs(input.dateStamp),
  };
}

/**
 * What a video gets (CAM-13): only the film's colour. The video preview uses this,
 * so it shows what will be recorded.
 */
export function videoSettingsOf(settings: FilterSettings): FilterSettings {
  return {
    ...settings,
    // Lens corrections move and compare pixels, which a colour LUT cannot.
    lens: DEFAULT_LENS_PARAMS,
    light: DEFAULT_LIGHT_PARAMS,
    film: colorOnlyFilmParams(settings.film),
    beauty: BEAUTY_LEVELS.off,
    faceShape: DEFAULT_FACE_SHAPE_PARAMS,
    dateStamp: toDateStampGlyphs(null),
  };
}
