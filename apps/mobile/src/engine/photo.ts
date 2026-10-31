import type { Film } from '@fant/content-schema';
import {
  ClipOp,
  FilterMode,
  ImageFormat,
  MipmapMode,
  Skia,
  TileMode,
  type SkImage,
} from '@shopify/react-native-skia';

import {
  primaryFaces,
  shapesFaces,
  toFaceGeometry,
  toShapedFaces,
} from '../features/character/face-geometry.worklet';
import { hasMakeup } from '../features/makeup/makeup';
import { needsPersonMask } from '../features/retouch/retouch';
import { editsSky } from '../features/sky/sky-edit';
import { findBackdrop } from '../features/photo/backdrops';
import { filterSettingsFor } from '../features/photo/filter-settings';
import { coverPlacement, framedPhotoRect } from '../features/photo/frames';
import { croppedSize, fitLongEdge, type Size } from '../features/photo/geometry';
import type { PhotoRecipe } from '../features/photo/recipe';
import { affineAt, composeProjective, fromAffine } from '../features/photo/projective';
import { recipeTransform } from '../features/photo/transform';
import { scale } from './affine.worklet';
import type { CharacterDrawing } from './draw-character';
import { drawDeco, type DecoAssets } from './draw-deco';
import { drawFiltered } from './draw-filtered';
import { drawFrameBackground, drawFrameOverlay } from './draw-frame';
import { faceOverlay } from './face-overlay';
import { personMask } from './person-mask';
import { hasRetouch, retouchSource, type PlacedMask, type RetouchInput } from './retouch-source';
import { skyMaskImage } from './sky-mask-image';
import { drawStyledText } from './draw-text';
import { filterEffects } from './filter-effects';
import { loadFilmLut } from './lut';
import { detectFacesInImage } from './still-faces';
import { makeSurface } from './surface';

/** The span of moments a saved photo's moving parts are frozen at. */
const MOTION_SECONDS = 10;

/** JPEG quality for saved photos (03 §3: about 90). */
const JPEG_QUALITY = 92;

/**
 * Decodes a JPEG/PNG/HEIC. Skia applies the EXIF orientation, so the result is
 * upright; encoding later writes no metadata, so location data never leaves (SHR-05).
 */
export function decodeImage(bytes: Uint8Array): SkImage {
  const data = Skia.Data.fromBytes(bytes);
  try {
    const image = Skia.Image.MakeImageFromEncoded(data);
    if (image === null) throw new Error('Failed to decode the image');
    return image;
  } finally {
    data.dispose();
  }
}

export function imageSize(image: SkImage): Size {
  return { width: image.width(), height: image.height() };
}

export function encodeJpeg(image: SkImage): Uint8Array {
  return image.encodeToBytes(ImageFormat.JPEG, JPEG_QUALITY);
}

export interface PhotoRenderInput {
  /** The upright original. */
  readonly image: SkImage;
  /** The original's file, to find faces for characters. */
  readonly originalUri: string | null;
  readonly recipe: PhotoRecipe;
  readonly film: Film;
  readonly character: CharacterDrawing | null;
  readonly deco: DecoAssets;
  /** Renders smaller, e.g. for the editor's live preview. */
  readonly maxLongEdge?: number;
}

/**
 * Renders a photo from its original and recipe (07 §5.2): transform, retouch,
 * characters, film, date and decorations. The capture, the editor and re-edits all
 * use this, with the same shaders as the preview. The caller disposes the result.
 */
export async function renderPhoto(input: PhotoRenderInput): Promise<SkImage> {
  const { image, recipe, film } = input;
  const lut = await loadFilmLut(film);
  const full = croppedSize(imageSize(image), recipe.transform.rotation, recipe.transform.crop);
  const size = input.maxLongEdge === undefined ? full : fitLongEdge(full, input.maxLongEdge);
  const transform = composeProjective(
    fromAffine(scale(size.width / full.width, size.height / full.height)),
    recipeTransform(imageSize(image), recipe.transform),
  );

  const shaping = shapesFaces(recipe.faceShape);
  const needsFaces =
    input.character !== null || shaping || hasMakeup(recipe.makeup) || recipe.hair.amount > 0;
  const faces =
    needsFaces && input.originalUri !== null
      ? primaryFaces(
          detectFacesInImage(input.originalUri).map((face) => {
            const { x, y, width, height } = face.bounds;
            // A face is small: the transform around its centre is as good as affine.
            const around = affineAt(transform, { x: x + width / 2, y: y + height / 2 });
            return toFaceGeometry(face, around);
          }),
        )
      : [];
  const { character } = input;
  // A mask is at its own size over the original: scale it there, then like the photo.
  const placed: PlacedMask[] = [];
  const place = (mask: SkImage | null): PlacedMask | null => {
    if (mask === null) return null;
    const matrix = Skia.Matrix([
      ...composeProjective(
        transform,
        fromAffine(scale(image.width() / mask.width(), image.height() / mask.height())),
      ),
    ]);
    const result = { image: mask, matrix };
    placed.push(result);
    return result;
  };
  const people = place(
    needsPersonMask(recipe) && input.originalUri !== null
      ? await personMask(input.originalUri)
      : null,
  );
  const sky = place(editsSky(recipe.sky) ? skyMaskImage(image) : null);

  const surface = makeSurface(size.width, size.height);
  const matrix = Skia.Matrix([...transform]);
  const source = image.makeShaderOptions(
    TileMode.Clamp,
    TileMode.Clamp,
    FilterMode.Linear,
    MipmapMode.None,
    matrix,
  );
  const retouch: RetouchInput = {
    heal: recipe.heal,
    backdrop: findBackdrop(recipe.backdrop),
    focusBlur: recipe.focusBlur,
    selective: recipe.selective,
    brush: recipe.brush,
    backgroundBlur: recipe.backgroundBlur,
    hair: recipe.hair,
    mask: people,
    sky: { mask: sky, edit: recipe.sky, backdrop: findBackdrop(recipe.sky.backdrop) },
    heads: faces.map((face) => ({ center: [face.center.x, face.center.y], width: face.width })),
  };
  let prepared: ReturnType<typeof retouchSource> | null = null;
  try {
    prepared = hasRetouch(retouch) ? retouchSource(source, size, retouch) : null;
    const canvas = surface.getCanvas();
    // A frame shrinks the photo into its window; the photo is cropped, never stretched.
    const window = framedPhotoRect(recipe.frame, size);
    const placement = coverPlacement(size, window);
    drawFrameBackground(canvas, recipe.frame, size);
    canvas.save();
    canvas.clipRect(
      Skia.XYWHRect(window.x, window.y, window.width, window.height),
      ClipOp.Intersect,
      true,
    );
    canvas.translate(placement.x, placement.y);
    canvas.scale(placement.scale, placement.scale);
    drawFiltered(canvas, prepared?.shader ?? source, size, {
      effects: filterEffects(),
      settings: filterSettingsFor({
        film,
        intensity: recipe.film.intensity,
        seed: recipe.seed,
        beauty: recipe.beauty,
        adjust: recipe.adjust,
        dateStamp: recipe.dateStamp,
        faceShape: recipe.faceShape,
        detail: recipe.detail,
        lens: recipe.lens,
        light: recipe.light,
        local: recipe.local,
        body: recipe.body,
      }),
      faces: shaping ? toShapedFaces(faces) : undefined,
      seed: recipe.seed,
      lut,
      // Moving parts (CHR-08) stop at a moment fixed per photo, so re-renders match.
      overlay: faceOverlay(faces, recipe.makeup, character, recipe.seed * MOTION_SECONDS),
    });
    canvas.restore();
    drawFrameOverlay(canvas, recipe.frame, size, window, recipe.seed);
    // Decorations cover the whole output, so the frame can be written on too.
    drawDeco(canvas, recipe.deco, size.width, size.height, input.deco);
    surface.flush();
    return surface.makeImageSnapshot();
  } finally {
    prepared?.dispose();
    for (const mask of placed) mask.matrix.dispose();
    source.dispose();
    matrix.dispose();
    surface.dispose();
  }
}

/** Shrinks an encoded photo for sharing on social media (SHR-04). */
export function resizeJpeg(bytes: Uint8Array, maxLongEdge: number): Uint8Array {
  const image = decodeImage(bytes);
  try {
    const size = fitLongEdge(imageSize(image), maxLongEdge);
    if (size.width === image.width()) return bytes;
    const surface = makeSurface(size.width, size.height);
    const paint = Skia.Paint();
    try {
      paint.setAntiAlias(true);
      surface
        .getCanvas()
        .drawImageRectOptions(
          image,
          Skia.XYWHRect(0, 0, image.width(), image.height()),
          Skia.XYWHRect(0, 0, size.width, size.height),
          FilterMode.Linear,
          MipmapMode.Linear,
          paint,
        );
      surface.flush();
      const snapshot = surface.makeImageSnapshot();
      try {
        return encodeJpeg(snapshot);
      } finally {
        snapshot.dispose();
      }
    } finally {
      paint.dispose();
      surface.dispose();
    }
  } finally {
    image.dispose();
  }
}

/**
 * Marks an AI-generated image with a small visible "AI" badge (AI-06; the visible
 * mark is the part kept even if the metadata approach changes, Q-09).
 */
export function markAiGenerated(bytes: Uint8Array): {
  readonly jpeg: Uint8Array;
  readonly width: number;
  readonly height: number;
} {
  const image = decodeImage(bytes);
  const width = image.width();
  const height = image.height();
  const surface = makeSurface(width, height);
  try {
    const canvas = surface.getCanvas();
    canvas.drawImage(image, 0, 0);
    const size = Math.max(14, Math.min(width, height) * 0.035);
    drawStyledText(canvas, 'AI', 'bubble', '#555555', {
      center: { x: width - size * 1.6, y: height - size * 1.2 },
      fontSize: size,
      rotation: 0,
    });
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    try {
      return { jpeg: encodeJpeg(snapshot), width, height };
    } finally {
      snapshot.dispose();
    }
  } finally {
    surface.dispose();
    image.dispose();
  }
}
