import { ADJUST_SHADER_NAME, ADJUST_SHADER_SOURCE, type AdjustParams } from './adjust/adjust';
import type { BeautyParams } from './beauty/beauty-params';
import { BEAUTY_SHADER_NAME, BEAUTY_SHADER_SOURCE } from './beauty/beauty-shader';
import { toBeautyUniforms } from './beauty/beauty-uniforms';
import { toDateStampUniforms, type DateStampGlyphs } from './date-stamp/date-stamp';
import { DATE_STAMP_SHADER_NAME, DATE_STAMP_SHADER_SOURCE } from './date-stamp/date-stamp-shader';
import {
  BODY_SHADER_NAME,
  BODY_SHADER_SOURCE,
  reshapesBody,
  toBodyUniforms,
  type BodyParams,
} from './body/body';
import type { DetailParams, LocalAdjustment } from './detail/detail-params';
import { DETAIL_SHADER_NAME, DETAIL_SHADER_SOURCE } from './detail/detail-shader';
import { toDetailUniforms } from './detail/detail-uniforms';
import type { FaceShapeParams } from './face-shape/face-shape-params';
import { FACE_SHAPE_SHADER_NAME, FACE_SHAPE_SHADER_SOURCE } from './face-shape/face-shape-shader';
import { toFaceShapeUniforms, type ShapedFace } from './face-shape/face-shape-uniforms';
import type { FilmParams } from './film/film-params';
import { FILM_SHADER_NAME, FILM_SHADER_SOURCE } from './film/film-shader';
import { toFilmUniforms } from './film/film-uniforms';
import { LENS_SHADER_NAME, LENS_SHADER_SOURCE, toLensUniforms, type LensParams } from './lens/lens';
import {
  addsLight,
  LIGHT_SHADER_NAME,
  LIGHT_SHADER_SOURCE,
  toLightUniforms,
  type LightParams,
} from './light/light';
import { compileRuntimeEffect, type RuntimeEffectFactory } from './runtime-effect';
import { packUniforms, type UniformLayout } from './uniforms';

/**
 * A compiled runtime effect: react-native-skia's `SkRuntimeEffect` and CanvasKit's
 * `RuntimeEffect` both fit, so the app and the film studio build the same chain.
 */
export interface ShaderEffect<TShader> extends UniformLayout {
  makeShaderWithChildren(uniforms: number[], children: TShader[]): TShader;
}

export interface FilterEffects<TShader> {
  readonly lens: ShaderEffect<TShader>;
  readonly faceShape: ShaderEffect<TShader>;
  readonly body: ShaderEffect<TShader>;
  readonly adjust: ShaderEffect<TShader>;
  readonly beauty: ShaderEffect<TShader>;
  readonly detail: ShaderEffect<TShader>;
  readonly light: ShaderEffect<TShader>;
  readonly film: ShaderEffect<TShader>;
  readonly dateStamp: ShaderEffect<TShader>;
}

/** Everything that decides how a photo looks; recorded with each shot. */
export interface FilterSettings {
  /** Lens and noise corrections (EDT-20), first of all. */
  readonly lens: LensParams;
  readonly faceShape: FaceShapeParams;
  /** Body reshaping (EDT-13). */
  readonly body: BodyParams;
  readonly adjust: AdjustParams;
  readonly beauty: BeautyParams;
  /** The editor's detailed adjustments (EDT-07–09). */
  readonly detail: DetailParams;
  /** The editor's local areas (EDT-10). */
  readonly local: readonly LocalAdjustment[];
  /** Light and weather (EDT-24), last before the film so it grades them too. */
  readonly light: LightParams;
  readonly film: FilmParams;
  readonly dateStamp: DateStampGlyphs;
}

export interface FilterFrame {
  readonly width: number;
  readonly height: number;
  /** Fixed at shutter time so the saved photo matches the preview (FLM-06). */
  readonly seed: number;
  /** Preview quality (see `REDUCED_QUALITY`); full when omitted. */
  readonly quality?: number;
  /** Faces for face fine-tuning, in frame pixels; without them it is skipped. */
  readonly faces?: readonly ShapedFace[];
}

export interface FilterChain<TShader> {
  /** The final shader to draw with. */
  readonly shader: TShader;
  /** Every shader the chain created (the final one included), for the caller to free. */
  readonly created: readonly TShader[];
}

/** The film's LUT, bound as the film shader's `lut` child. */
export interface LutShader<TShader> {
  readonly shader: TShader;
  readonly size: number;
}

/** Stages whose parameters are all zero are skipped: they would not change the image. */
function isNeutral(params: Readonly<Record<string, number>>): boolean {
  'worklet';
  for (const key in params) {
    if (params[key] !== 0) return false;
  }
  return true;
}

/**
 * Lens corrections, face fine-tuning, body reshaping, corrections, skin retouching,
 * detailed adjustments and light (lens → face shape → body → adjust → beauty →
 * detail → light).
 * Runs before anything drawn over the face (characters), so stickers are not
 * smoothed or reshaped.
 * Marked as a worklet so it can run on the camera frame thread.
 */
export function chainRetouch<TShader>(
  effects: FilterEffects<TShader>,
  settings: FilterSettings,
  frame: FilterFrame,
  source: TShader,
): FilterChain<TShader> {
  'worklet';
  const created: TShader[] = [];
  let shader = source;
  if (!isNeutral(settings.lens)) {
    shader = effects.lens.makeShaderWithChildren(
      packUniforms(effects.lens, toLensUniforms(settings.lens, frame)),
      [shader],
    );
    created.push(shader);
  }
  const faces = frame.faces ?? [];
  if (faces.length > 0 && !isNeutral(settings.faceShape)) {
    shader = effects.faceShape.makeShaderWithChildren(
      packUniforms(effects.faceShape, toFaceShapeUniforms(settings.faceShape, faces)),
      [shader],
    );
    created.push(shader);
  }
  // After the face shape, which is placed on the unwarped faces.
  if (reshapesBody(settings.body)) {
    shader = effects.body.makeShaderWithChildren(
      packUniforms(effects.body, toBodyUniforms(settings.body, frame)),
      [shader],
    );
    created.push(shader);
  }
  if (!isNeutral(settings.adjust)) {
    shader = effects.adjust.makeShaderWithChildren(packUniforms(effects.adjust, settings.adjust), [
      shader,
    ]);
    created.push(shader);
  }
  if (!isNeutral(settings.beauty)) {
    shader = effects.beauty.makeShaderWithChildren(
      packUniforms(effects.beauty, toBeautyUniforms(settings.beauty, frame)),
      [shader],
    );
    created.push(shader);
  }
  if (!isNeutral(settings.detail) || settings.local.length > 0) {
    shader = effects.detail.makeShaderWithChildren(
      packUniforms(effects.detail, toDetailUniforms(settings.detail, settings.local, frame)),
      [shader],
    );
    created.push(shader);
  }
  if (addsLight(settings.light)) {
    shader = effects.light.makeShaderWithChildren(
      packUniforms(effects.light, toLightUniforms(settings.light, frame)),
      [shader],
    );
    created.push(shader);
  }
  return { shader, created };
}

/**
 * The film look and the date imprint (film → date stamp), drawn over everything.
 * Marked as a worklet so it can run on the camera frame thread.
 */
export function chainLook<TShader>(
  effects: FilterEffects<TShader>,
  settings: FilterSettings,
  frame: FilterFrame,
  source: TShader,
  lut: LutShader<TShader>,
): FilterChain<TShader> {
  'worklet';
  const film = effects.film.makeShaderWithChildren(
    packUniforms(effects.film, toFilmUniforms(settings.film, { ...frame, lutSize: lut.size })),
    [source, lut.shader],
  );
  const created: TShader[] = [film];
  let shader = film;
  if (settings.dateStamp.glyphCount > 0) {
    shader = effects.dateStamp.makeShaderWithChildren(
      packUniforms(effects.dateStamp, toDateStampUniforms(settings.dateStamp, frame)),
      [film],
    );
    created.push(shader);
  }
  return { shader, created };
}

/**
 * The whole chain for a photo without characters: adjust → beauty → film → date.
 * Marked as a worklet so it can run on the camera frame thread.
 */
export function chainFilters<TShader>(
  effects: FilterEffects<TShader>,
  settings: FilterSettings,
  frame: FilterFrame,
  source: TShader,
  lut: LutShader<TShader>,
): FilterChain<TShader> {
  'worklet';
  const retouch = chainRetouch(effects, settings, frame, source);
  const look = chainLook(effects, settings, frame, retouch.shader, lut);
  return { shader: look.shader, created: [...retouch.created, ...look.created] };
}

/** Compiles every shader of the chain; throws `ShaderCompileError` on the first failure. */
export function compileFilterEffects<TEffect>(
  factory: RuntimeEffectFactory<TEffect>,
): Readonly<Record<keyof FilterEffects<unknown>, TEffect>> {
  return {
    lens: compileRuntimeEffect(factory, LENS_SHADER_NAME, LENS_SHADER_SOURCE),
    faceShape: compileRuntimeEffect(factory, FACE_SHAPE_SHADER_NAME, FACE_SHAPE_SHADER_SOURCE),
    body: compileRuntimeEffect(factory, BODY_SHADER_NAME, BODY_SHADER_SOURCE),
    adjust: compileRuntimeEffect(factory, ADJUST_SHADER_NAME, ADJUST_SHADER_SOURCE),
    beauty: compileRuntimeEffect(factory, BEAUTY_SHADER_NAME, BEAUTY_SHADER_SOURCE),
    detail: compileRuntimeEffect(factory, DETAIL_SHADER_NAME, DETAIL_SHADER_SOURCE),
    light: compileRuntimeEffect(factory, LIGHT_SHADER_NAME, LIGHT_SHADER_SOURCE),
    film: compileRuntimeEffect(factory, FILM_SHADER_NAME, FILM_SHADER_SOURCE),
    dateStamp: compileRuntimeEffect(factory, DATE_STAMP_SHADER_NAME, DATE_STAMP_SHADER_SOURCE),
  };
}
