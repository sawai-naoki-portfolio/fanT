import type { AlbumPhoto } from '../album/album-types';
import { editableSource, saveEdit } from '../photo/photo-service';
import type { Look } from '../photo/recipe';
import { withLook } from './look';

/** Videos have no recipe to change. */
function canTakeLook(photo: AlbumPhoto): boolean {
  return photo.kind !== 'video';
}

/**
 * Applies `look` to several album photos (EDT-06, EDT-33), re-rendering each from
 * its original. Returns how many were changed; one failing does not stop the rest.
 */
export async function pasteLook(
  photos: readonly AlbumPhoto[],
  look: Look,
  onError: (error: unknown) => void,
): Promise<number> {
  let changed = 0;
  for (const photo of photos.filter(canTakeLook)) {
    try {
      const { originalUri, recipe } = editableSource(photo);
      await saveEdit(photo.id, originalUri, withLook(recipe, look));
      changed++;
    } catch (error) {
      onError(error);
    }
  }
  return changed;
}
