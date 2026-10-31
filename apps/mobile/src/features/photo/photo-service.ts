import type { Character, Manifest, Stamp } from '@fant/content-schema';
import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';

import { loadDecoFonts } from '../../engine/deco-fonts';
import type { CharacterDrawing } from '../../engine/draw-character';
import { loadContentImages } from '../../engine/images';
import { decodeImage, encodeJpeg, imageSize, renderPhoto } from '../../engine/photo';
import type { SkImage } from '../../engine/skia';
import {
  addPhoto,
  adoptOutputAsOriginal,
  discardPhotoFiles,
  updatePhoto,
  writeOriginal,
} from '../album/album-db';
import type { AlbumPhoto, PhotoKind } from '../album/album-types';
import { useContent } from '../content/content-store';
import { findCharacter, findFilm, stampMap } from '../content/lookup';
import { useSettings } from '../settings/settings-store';
import type { Size } from './geometry';
import { neutralRecipe, type PhotoRecipe } from './recipe';

function imageRefsOf(character: Character | null, stamps: readonly Stamp[], recipe: PhotoRecipe) {
  const usedStamps = new Set(
    recipe.deco.flatMap((layer) => (layer.type === 'stamp' ? [layer.stampId] : [])),
  );
  return [
    ...(character?.parts.flatMap((part) => (part.art.type === 'image' ? [part.art.image] : [])) ??
      []),
    ...stamps.flatMap((stamp) =>
      usedStamps.has(stamp.id) && stamp.art.type === 'image' ? [stamp.art.image] : [],
    ),
  ];
}

/**
 * Renders a photo from its decoded original with the current content, resolving the
 * film, character and stamps the recipe names. The caller disposes the result.
 */
export async function renderRecipe(
  image: SkImage,
  originalUri: string | null,
  recipe: PhotoRecipe,
  options: { readonly maxLongEdge?: number; readonly manifest?: Manifest } = {},
): Promise<SkImage> {
  const manifest = options.manifest ?? useContent.getState().manifest;
  const resolved =
    recipe.character === null
      ? null
      : findCharacter(manifest, recipe.character.id, recipe.character.variantId);
  const images = await loadContentImages(
    imageRefsOf(resolved?.character ?? null, manifest.stamps, recipe),
  );
  const character: CharacterDrawing | null = resolved === null ? null : { ...resolved, images };
  return renderPhoto({
    image,
    originalUri,
    recipe,
    film: findFilm(manifest, recipe.film.id),
    character,
    deco: { stamps: stampMap(manifest), images, fonts: await loadDecoFonts() },
    maxLongEdge: options.maxLongEdge,
  });
}

/** A new album photo ID (lowercase, as the album's file names require). */
export function newPhotoId(): string {
  return randomUUID().toLowerCase();
}

/**
 * Stores a new photo: keeps the original (CAM-04), renders it with its recipe at
 * full resolution and adds both to the album. On failure nothing is left behind.
 */
export async function createPhoto(input: {
  readonly kind: PhotoKind;
  readonly original: Uint8Array;
  readonly recipeFor: (size: Size) => PhotoRecipe;
}): Promise<AlbumPhoto> {
  const id = newPhotoId();
  const image = decodeImage(input.original);
  try {
    const originalUri = writeOriginal(id, input.original);
    const recipe = input.recipeFor(imageSize(image));
    const rendered = await renderRecipe(image, originalUri, recipe);
    try {
      return addPhoto({
        id,
        kind: input.kind,
        output: encodeJpeg(rendered),
        width: rendered.width(),
        height: rendered.height(),
        hasOriginal: true,
        recipe,
        originalRetentionDays: useSettings.getState().originalRetentionDays,
      });
    } finally {
      rendered.dispose();
    }
  } catch (error) {
    discardPhotoFiles(id);
    throw error;
  } finally {
    image.dispose();
  }
}

/**
 * The original and recipe to edit a photo from (EDT-01/02). When the original
 * expired (ALB-03), the current output becomes the original with a neutral recipe.
 */
export function editableSource(photo: AlbumPhoto): {
  readonly originalUri: string;
  readonly recipe: PhotoRecipe;
} {
  if (photo.hasOriginal && photo.originalUri !== null && photo.recipe !== null) {
    return { originalUri: photo.originalUri, recipe: photo.recipe };
  }
  const originalUri = adoptOutputAsOriginal(photo.id, useSettings.getState().originalRetentionDays);
  return {
    originalUri,
    recipe: neutralRecipe(0.5),
  };
}

/** Renders an edited recipe from the original and replaces the photo's output. */
export async function saveEdit(
  photoId: string,
  originalUri: string,
  recipe: PhotoRecipe,
): Promise<void> {
  const image = decodeImage(new File(originalUri).bytesSync());
  try {
    const rendered = await renderRecipe(image, originalUri, recipe);
    try {
      updatePhoto(photoId, {
        output: encodeJpeg(rendered),
        width: rendered.width(),
        height: rendered.height(),
        recipe,
      });
    } finally {
      rendered.dispose();
    }
  } finally {
    image.dispose();
  }
}
