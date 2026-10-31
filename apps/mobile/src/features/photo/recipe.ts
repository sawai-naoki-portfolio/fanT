import { contentIdSchema, hexColorSchema, TEXT_STAMP_STYLES } from '@fant/content-schema';
import {
  ADJUST_PARAM_RANGES,
  BEAUTY_LEVELS,
  BEAUTY_PARAM_RANGES,
  DATE_STAMP_FORMATS,
  BODY_PARAM_RANGES,
  DEFAULT_ADJUST_PARAMS,
  DEFAULT_BODY_PARAMS,
  DEFAULT_DETAIL_PARAMS,
  DEFAULT_FACE_SHAPE_PARAMS,
  DEFAULT_LENS_PARAMS,
  DEFAULT_LIGHT_PARAMS,
  DETAIL_PARAM_RANGES,
  LOCAL_SHAPES,
  MAX_LOCAL_ADJUSTMENTS,
  FACE_SHAPE_PARAM_RANGES,
  LENS_PARAM_RANGES,
  LIGHT_PARAM_RANGES,
  type AdjustParams,
  type FaceShapeParams,
  type BeautyParams,
  type ParamRange,
} from '@fant/filters';
import { z } from 'zod';

import { makeupSchema, NO_MAKEUP, type Makeup } from '../makeup/makeup';
import { focusBlurSchema, NO_FOCUS_BLUR } from '../retouch/focus-blur';
import { areaToneSchema, NO_AREA_TONE } from '../selection/area-tone';
import { NO_SKY_EDIT, skyEditSchema } from '../sky/sky-edit';
import { hairSchema, healSpotSchema, MAX_HEAL_SPOTS, NO_HAIR_COLOR } from '../retouch/retouch';
import { FRAME_TYPES } from './frames';
import { DECO_FONTS } from '../deco/deco-fonts';

/** Limits that keep a recipe small; the editor stops adding past them (DCO-*). */
export const MAX_STROKE_POINTS = 2000;
export const MAX_DECO_LAYERS = 500;
/** Strokes of the adjustment brush (EDT-35), enough to cover a few things. */
export const MAX_BRUSH_STROKES = 40;
/** Furthest a photo can be straightened, in degrees either way. */
const MAX_STRAIGHTEN = 45;

/**
 * Numbers within each parameter's range, e.g. the beauty or adjust parameters. A
 * parameter added in a later version reads as its default, so stored recipes and
 * settings stay valid.
 */
export function paramsSchema<Name extends string>(ranges: Readonly<Record<Name, ParamRange>>) {
  return z.strictObject(
    Object.fromEntries(
      Object.entries<ParamRange>(ranges).map(([name, { min, max, defaultValue }]) => [
        name,
        z.number().min(min).max(max).default(defaultValue),
      ]),
    ) as Record<Name, z.ZodDefault<z.ZodNumber>>,
  );
}

const unit = z.number().min(0).max(1);
/** Positions on the photo, as fractions of its width and height. */
const position = z.number().min(-0.5).max(1.5);

const decoStrokeSchema = z.strictObject({
  type: z.literal('stroke'),
  /** `neon` glows (DCO-01); `eraser` clears other decorations, never the photo (DCO-05). */
  tool: z.enum(['pen', 'neon', 'eraser']),
  color: hexColorSchema,
  /** Line width as a fraction of the photo's short edge. */
  width: z.number().min(0.002).max(0.2),
  /** Flattened x, y pairs in photo fractions. */
  points: z
    .array(position)
    .min(2)
    .max(MAX_STROKE_POINTS * 2)
    .refine((points) => points.length % 2 === 0),
});

const decoStampSchema = z.strictObject({
  type: z.literal('stamp'),
  stampId: contentIdSchema,
  x: position,
  y: position,
  /** Size as a fraction of the photo's short edge. */
  size: z.number().min(0.02).max(2),
  rotation: z.number().min(-360).max(360),
  /** A colour chosen for a shape or text stamp, e.g. the oshi colour (PRI-08). */
  color: hexColorSchema.optional(),
});

const decoTextSchema = z.strictObject({
  type: z.literal('text'),
  text: z.string().min(1).max(40),
  style: z.enum(TEXT_STAMP_STYLES),
  font: z.enum(DECO_FONTS).default('system'),
  color: hexColorSchema,
  x: position,
  y: position,
  size: z.number().min(0.02).max(2),
  rotation: z.number().min(-360).max(360),
});

const decoLayerSchema = z.discriminatedUnion('type', [
  decoStrokeSchema,
  decoStampSchema,
  decoTextSchema,
]);
export type DecoLayer = z.infer<typeof decoLayerSchema>;
export type DecoStroke = z.infer<typeof decoStrokeSchema>;
export type DecoStamp = z.infer<typeof decoStampSchema>;
export type DecoText = z.infer<typeof decoTextSchema>;

export const ASPECT_RATIOS = ['3:4', '9:16', '1:1'] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

const cropSchema = z
  .strictObject({ x: unit, y: unit, width: unit, height: unit })
  .refine(({ x, width }) => width > 0 && x + width <= 1 + 1e-9)
  .refine(({ y, height }) => height > 0 && y + height <= 1 + 1e-9);
export type Crop = z.infer<typeof cropSchema>;

export const FULL_CROP: Crop = { x: 0, y: 0, width: 1, height: 1 };

const centeredUnit = z.number().min(-1).max(1);

const localAdjustmentSchema = z.strictObject({
  /** Missing in recipes saved before graduated filters (EDT-17): circles. */
  shape: z.enum(LOCAL_SHAPES).default('radial'),
  angle: z.number().min(-180).max(180).default(0),
  x: unit,
  y: unit,
  radius: z.number().min(0.02).max(1),
  feather: unit,
  brightness: centeredUnit,
  saturation: centeredUnit,
  temperature: centeredUnit,
});

export const calendarDateSchema = z.strictObject({
  year: z.number().int().min(1900).max(2099),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
});

const dateStampSchema = z.strictObject({
  date: calendarDateSchema,
  format: z.enum(DATE_STAMP_FORMATS),
  color: z.tuple([unit, unit, unit]).readonly(),
});

/**
 * Everything needed to render a photo again from its original (CAM-04, EDT-01/02):
 * the shot's look, the edits and the decorations. Stored as JSON with each album
 * photo and validated when read back. Face positions are never stored (03 §6); they
 * are detected again when rendering.
 */
const photoRecipeSchema = z.strictObject({
  version: z.literal(1),
  film: z.strictObject({ id: contentIdSchema, intensity: unit }),
  /** Fixes grain and light leaks so every render of this shot looks the same (FLM-06). */
  seed: z.number().min(0).max(1),
  beauty: paramsSchema(BEAUTY_PARAM_RANGES),
  adjust: paramsSchema(ADJUST_PARAM_RANGES),
  dateStamp: dateStampSchema.nullable(),
  character: z.strictObject({ id: contentIdSchema, variantId: contentIdSchema }).nullable(),
  /** Applied to the original first: mirroring, quarter turns, straightening, then the crop. */
  transform: z.strictObject({
    rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
    mirror: z.boolean(),
    /** Degrees clockwise to level a horizon; missing in older recipes. */
    straighten: z.number().min(-MAX_STRAIGHTEN).max(MAX_STRAIGHTEN).default(0),
    /** Keystone correction (EDT-18); missing in older recipes. */
    perspective: z
      .strictObject({ vertical: centeredUnit, horizontal: centeredUnit })
      .default({ vertical: 0, horizontal: 0 }),
    crop: cropSchema,
  }),
  deco: z.array(decoLayerSchema).max(MAX_DECO_LAYERS),
  /** Detailed adjustments (EDT-07–09); missing in older recipes. */
  detail: paramsSchema(DETAIL_PARAM_RANGES).default(DEFAULT_DETAIL_PARAMS),
  /** Lens and noise corrections (EDT-20); missing in older recipes. */
  lens: paramsSchema(LENS_PARAM_RANGES).default(DEFAULT_LENS_PARAMS),
  /** Light and weather (EDT-24); missing in older recipes. */
  light: paramsSchema(LIGHT_PARAM_RANGES).default(DEFAULT_LIGHT_PARAMS),
  /** Local areas (EDT-10); missing in older recipes. */
  local: z.array(localAdjustmentSchema).max(MAX_LOCAL_ADJUSTMENTS).default([]),
  /** Blemishes smoothed away (BTY-11); missing in older recipes. */
  heal: z.array(healSpotSchema).max(MAX_HEAL_SPOTS).default([]),
  /** Body reshaping (EDT-13); missing in older recipes. */
  body: paramsSchema(BODY_PARAM_RANGES).default(DEFAULT_BODY_PARAMS),
  /**
   * A backdrop put behind the people (EDT-16), by ID; an ID this version does not
   * know is drawn as none. Missing in older recipes.
   */
  backdrop: z.string().max(32).nullable().default(null),
  /** The people and the background on their own (EDT-34); missing in older recipes. */
  selective: z
    .strictObject({
      people: areaToneSchema.default(NO_AREA_TONE),
      background: areaToneSchema.default(NO_AREA_TONE),
    })
    .default({ people: NO_AREA_TONE, background: NO_AREA_TONE }),
  /** An area painted with the adjustment brush (EDT-35); missing in older recipes. */
  brush: z
    .strictObject({
      strokes: z.array(decoStrokeSchema).max(MAX_BRUSH_STROKES).default([]),
      tone: areaToneSchema.default(NO_AREA_TONE),
    })
    .default({ strokes: [], tone: NO_AREA_TONE }),
  /** The sky alone (EDT-25), found on the device; missing in older recipes. */
  sky: skyEditSchema.default(NO_SKY_EDIT),
  /** Tilt-shift (EDT-23); missing in older recipes. */
  focusBlur: focusBlurSchema.default(NO_FOCUS_BLUR),
  /** Background blur behind the people (EDT-11); missing in older recipes. */
  backgroundBlur: z.number().min(0).max(1).default(0),
  /** Hair colour (EDT-12); missing in older recipes. */
  hair: hairSchema.default(NO_HAIR_COLOR),
  /** Makeup and touch-ups (BTY-07/09/10); missing in older recipes. */
  makeup: makeupSchema.default(NO_MAKEUP),
  /** Face fine-tuning (BTY-04); recipes saved without it leave faces as they are. */
  faceShape: paramsSchema(FACE_SHAPE_PARAM_RANGES).default(DEFAULT_FACE_SHAPE_PARAMS),
  /** Added after the first release: recipes saved without it have no frame. */
  frame: z
    .strictObject({ type: z.enum(FRAME_TYPES), color: hexColorSchema })
    .nullable()
    .default(null),
});
export type PhotoRecipe = z.infer<typeof photoRecipeSchema>;

/**
 * The parts of a recipe that make its look, the same on any photo (EDT-33): what
 * is copied, pasted and kept in presets. Framing, decorations and retouching tied
 * to places in one photo are left out.
 */
export const lookSchema = photoRecipeSchema.pick({
  film: true,
  beauty: true,
  adjust: true,
  detail: true,
  lens: true,
  light: true,
  sky: true,
});
export type Look = z.infer<typeof lookSchema>;
export const LOOK_KEYS = Object.keys(lookSchema.shape) as (keyof Look)[];
export type QuarterTurn = PhotoRecipe['transform']['rotation'];

export function newRecipe(options: {
  readonly filmId: string;
  readonly intensity: number;
  readonly beauty: BeautyParams;
  readonly dateStamp: PhotoRecipe['dateStamp'];
  readonly character: PhotoRecipe['character'];
  readonly seed: number;
  readonly mirror: boolean;
  readonly crop: Crop;
  readonly adjust?: AdjustParams;
  readonly faceShape?: FaceShapeParams;
  readonly makeup?: Makeup;
}): PhotoRecipe {
  return {
    version: 1,
    film: { id: options.filmId, intensity: options.intensity },
    seed: options.seed,
    beauty: options.beauty,
    adjust: options.adjust ?? DEFAULT_ADJUST_PARAMS,
    dateStamp: options.dateStamp,
    character: options.character,
    transform: {
      rotation: 0,
      mirror: options.mirror,
      straighten: 0,
      perspective: { vertical: 0, horizontal: 0 },
      crop: options.crop,
    },
    deco: [],
    frame: null,
    faceShape: options.faceShape ?? DEFAULT_FACE_SHAPE_PARAMS,
    makeup: options.makeup ?? NO_MAKEUP,
    heal: [],
    body: DEFAULT_BODY_PARAMS,
    backdrop: null,
    focusBlur: NO_FOCUS_BLUR,
    sky: NO_SKY_EDIT,
    selective: { people: NO_AREA_TONE, background: NO_AREA_TONE },
    brush: { strokes: [], tone: NO_AREA_TONE },
    backgroundBlur: 0,
    hair: NO_HAIR_COLOR,
    detail: DEFAULT_DETAIL_PARAMS,
    lens: DEFAULT_LENS_PARAMS,
    light: DEFAULT_LIGHT_PARAMS,
    local: [],
  };
}

/** A recipe that leaves the photo as it is, for imported photos and expired originals. */
export function neutralRecipe(seed: number): PhotoRecipe {
  return newRecipe({
    filmId: 'natural',
    intensity: 0,
    beauty: BEAUTY_LEVELS.off,
    dateStamp: null,
    character: null,
    seed,
    mirror: false,
    crop: FULL_CROP,
  });
}

/** Parses a stored recipe; `null` when it is missing or no longer valid. */
export function parseRecipe(json: string | null): PhotoRecipe | null {
  if (json === null) return null;
  try {
    const result = photoRecipeSchema.safeParse(JSON.parse(json));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
