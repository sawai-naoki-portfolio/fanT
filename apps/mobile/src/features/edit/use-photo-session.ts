import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';

import { decodeImage, imageSize } from '../../engine/photo';
import type { SkImage } from '../../engine/skia';
import { showError } from '../../ui/dialogs';
import { reportError } from '../analytics/analytics';
import { useAlbumPhoto } from '../album/use-album';
import { croppedSize, type Size } from '../photo/geometry';
import { editableSource, renderRecipe } from '../photo/photo-service';
import type { PhotoRecipe } from '../photo/recipe';
import { commit, redo, replace, startHistory, undo, type History } from './history';
import { EDITED_VIEW, previewRecipeOf, type PreviewView } from './preview-view';

/** Long edge of the live preview while editing; the saved photo is full resolution. */
const PREVIEW_LONG_EDGE = 1080;
const RENDER_DEBOUNCE_MS = 80;
/** Changes to one control closer together than this are one undo step. */
const COALESCE_MS = 800;

interface Source {
  readonly originalUri: string;
  readonly image: SkImage;
  readonly originalSize: Size;
}

/**
 * Loads a photo for editing (EDT and DCO): its decoded original, the recipe with
 * undo/redo (EDT-05) and a live preview rendered from the original.
 */
export function usePhotoSession(
  photoId: string,
  options: { readonly previewWithoutDeco?: boolean } = {},
) {
  const photo = useAlbumPhoto(photoId);
  const [source, setSource] = useState<Source | null>(null);
  const [history, setHistory] = useState<History<PhotoRecipe> | null>(null);
  const [preview, setPreview] = useState<SkImage | null>(null);
  const displayed = useRef<SkImage | null>(null);
  const loadedFor = useRef<string | null>(null);
  const lastChange = useRef<{ key: string; at: number } | null>(null);

  // Decode the original once per photo, off the render.
  useEffect(() => {
    if (photo === null || loadedFor.current === photo.id) return;
    loadedFor.current = photo.id;
    void Promise.resolve().then(() => {
      try {
        const { originalUri, recipe } = editableSource(photo);
        const image = decodeImage(new File(originalUri).bytesSync());
        setSource({ originalUri, image, originalSize: imageSize(image) });
        setHistory(startHistory(recipe));
      } catch (error) {
        // Without the original there is nothing to edit: say so and go back.
        reportError(error, 'edit.load');
        showError();
        router.back();
      }
    });
  }, [photo]);

  // Free the decoded original when leaving.
  useEffect(() => () => source?.image.dispose(), [source]);

  const recipe = history?.present ?? null;
  const [view, setView] = useState<Omit<PreviewView, 'withoutDeco'>>(EDITED_VIEW);
  const withoutDeco = options.previewWithoutDeco === true;
  const previewRecipe = useMemo(
    () => (recipe === null ? null : previewRecipeOf(recipe, { ...view, withoutDeco })),
    [recipe, view, withoutDeco],
  );

  // Re-render the preview when the recipe changes; the latest render wins.
  useEffect(() => {
    if (source === null || previewRecipe === null) return;
    let current = true;
    const timer = setTimeout(() => {
      renderRecipe(source.image, source.originalUri, previewRecipe, {
        maxLongEdge: PREVIEW_LONG_EDGE,
      })
        .then((image) => {
          if (!current) {
            image.dispose();
            return;
          }
          const previous = displayed.current;
          displayed.current = image;
          setPreview(image);
          // Freed once the new preview has been drawn.
          if (previous !== null)
            requestAnimationFrame(() => {
              previous.dispose();
            });
        })
        .catch((error: unknown) => {
          reportError(error, 'edit.preview');
        });
    }, RENDER_DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [source, previewRecipe]);

  useEffect(
    () => () => {
      displayed.current?.dispose();
      displayed.current = null;
    },
    [],
  );

  const sizeOf = (shown: PhotoRecipe | null) =>
    source !== null && shown !== null
      ? croppedSize(source.originalSize, shown.transform.rotation, shown.transform.crop)
      : null;

  return {
    photo: photo,
    source,
    recipe,
    preview,
    /** The size of the edited photo. */
    outputSize: sizeOf(recipe),
    /** The size of what the preview shows (the whole photo while cropping). */
    previewSize: sizeOf(previewRecipe),
    /** Shows the photo before its look (EDT-28) or uncropped (EDT-29). */
    setView,
    canUndo: (history?.past.length ?? 0) > 0,
    canRedo: (history?.future.length ?? 0) > 0,
    /**
     * Applies a change that can be undone. Rapid changes with the same `key` (a
     * slider being dragged) become one undo step.
     */
    change: (next: PhotoRecipe, key?: string) => {
      const now = Date.now();
      const coalesce =
        key !== undefined &&
        lastChange.current?.key === key &&
        now - lastChange.current.at < COALESCE_MS;
      lastChange.current = key === undefined ? null : { key, at: now };
      setHistory((current) => {
        if (current === null) return current;
        return coalesce ? replace(current, next) : commit(current, next);
      });
    },
    undo: () => {
      setHistory((current) => (current === null ? current : undo(current)));
    },
    redo: () => {
      setHistory((current) => (current === null ? current : redo(current)));
    },
  };
}
