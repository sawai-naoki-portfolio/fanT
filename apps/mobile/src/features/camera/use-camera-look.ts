import type { Film } from '@fant/content-schema';
import {
  calendarDateOf,
  DATE_STAMP_ORANGE,
  type BeautyParams,
  type DateStamp,
  type FaceShapeParams,
  type FilterSettings,
} from '@fant/filters';
import { useEffect, useMemo, useState } from 'react';

import type { CharacterDrawing } from '../../engine/draw-character';
import { loadContentImages } from '../../engine/images';
import { useFilmLut, type LoadedLut } from '../../engine/lut';
import type { SkImage } from '../../engine/skia';
import { reportError } from '../analytics/analytics';
import { useContent } from '../content/content-store';
import { findCharacter, findFilm, type ResolvedCharacter } from '../content/lookup';
import type { Makeup } from '../makeup/makeup';
import { filterSettingsFor } from '../photo/filter-settings';
import { filmIntensityOf, useCameraSettings } from './camera-store';

/** What a shot should look like, by content ID. */
export interface LookSpec {
  readonly filmId: string;
  readonly intensity: number;
  readonly beauty: BeautyParams;
  /** Face fine-tuning (BTY-04); off when omitted. */
  readonly faceShape?: FaceShapeParams;
  /** Makeup (BTY-07/09/10); none when omitted. */
  readonly makeup?: Makeup;
  readonly dateStamp: DateStamp | null;
  readonly character: { readonly id: string; readonly variantId: string | undefined } | null;
}

export interface CameraLook {
  readonly film: Film;
  readonly intensity: number;
  readonly beauty: BeautyParams;
  readonly dateStamp: DateStamp | null;
  readonly character: ResolvedCharacter | null;
  readonly settings: FilterSettings;
  readonly makeup: Makeup | null;
  readonly lut: LoadedLut;
  /** The character as drawn on the preview. */
  readonly characterDrawing: CharacterDrawing | null;
}

/** Image parts of a character, loaded for drawing. */
function useCharacterImages(
  character: ResolvedCharacter | null,
): Readonly<Record<string, SkImage>> {
  const [images, setImages] = useState<Readonly<Record<string, SkImage>>>({});
  useEffect(() => {
    const refs =
      character?.character.parts.flatMap((part) =>
        part.art.type === 'image' ? [part.art.image] : [],
      ) ?? [];
    if (refs.length === 0) return;
    let current = true;
    loadContentImages(refs)
      .then((loaded) => {
        if (current) setImages(loaded);
      })
      .catch((error: unknown) => {
        reportError(error, 'character.images');
      });
    return () => {
      current = false;
    };
  }, [character]);
  return images;
}

/**
 * Resolves a look against the current content: the film, its LUT, the character
 * and the shader settings shared by the preview and the photo. `seed` is fixed
 * per shot (FLM-06).
 */
export function useLook(spec: LookSpec, seed: number): CameraLook {
  const manifest = useContent((state) => state.manifest);
  const film = findFilm(manifest, spec.filmId);
  const lut = useFilmLut(film);
  const { intensity, beauty, faceShape, dateStamp } = spec;
  const characterId = spec.character?.id;
  const variantId = spec.character?.variantId;

  const character = useMemo(
    () => (characterId === undefined ? null : findCharacter(manifest, characterId, variantId)),
    [manifest, characterId, variantId],
  );
  const images = useCharacterImages(character);
  const settings = useMemo(
    () => filterSettingsFor({ film, intensity, seed, beauty, faceShape, dateStamp }),
    [film, intensity, seed, beauty, faceShape, dateStamp],
  );
  const characterDrawing = useMemo<CharacterDrawing | null>(
    () => (character === null ? null : { ...character, images }),
    [character, images],
  );

  return {
    film,
    intensity,
    beauty,
    dateStamp,
    character,
    settings,
    makeup: spec.makeup ?? null,
    lut,
    characterDrawing,
  };
}

/** The look chosen on the camera screen (S-10). */
export function useCameraLook(seed: number): CameraLook {
  const filmId = useCameraSettings((state) => state.filmId);
  const intensity = useCameraSettings((state) => filmIntensityOf(state, state.filmId));
  const beauty = useCameraSettings((state) => state.beauty);
  const faceShape = useCameraSettings((state) => state.faceShape);
  const makeup = useCameraSettings((state) => state.makeup);
  const dateSettings = useCameraSettings((state) => state.dateStamp);
  const mode = useCameraSettings((state) => state.mode);
  const characterId = useCameraSettings((state) => state.characterId);
  const variantId = useCameraSettings((state) => state.characterVariants[state.characterId]);

  const dateStamp = useMemo<DateStamp | null>(
    () =>
      dateSettings.enabled
        ? {
            date: dateSettings.customDate ?? calendarDateOf(new Date()),
            format: dateSettings.format,
            color: DATE_STAMP_ORANGE,
          }
        : null,
    [dateSettings],
  );
  const character = useMemo(
    () => (mode === 'character' ? { id: characterId, variantId } : null),
    [mode, characterId, variantId],
  );
  const spec = useMemo<LookSpec>(
    () => ({ filmId, intensity, beauty, faceShape, makeup, dateStamp, character }),
    [filmId, intensity, beauty, faceShape, makeup, dateStamp, character],
  );
  return useLook(spec, seed);
}
