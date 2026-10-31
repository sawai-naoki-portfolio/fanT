import type { AssetRef } from '@fant/content-schema';
import { Skia, type SkImage } from '@shopify/react-native-skia';

import { resolveAsset } from '../features/content/assets';

/** Decoded content images (character parts, image stamps) for the session, by hash. */
const cache = new Map<string, Promise<SkImage>>();

/** Decodes an image file (content images, LUTs). */
export async function decodeImageFile(uri: string): Promise<SkImage> {
  const data = await Skia.Data.fromURI(uri);
  try {
    const image = Skia.Image.MakeImageFromEncoded(data);
    if (image === null) throw new Error(`Failed to decode ${uri}`);
    return image;
  } finally {
    data.dispose();
  }
}

/**
 * Loads content images, keyed by hash. An image that fails to load is left out
 * (its part is skipped) rather than failing the whole photo.
 */
export async function loadContentImages(
  refs: readonly AssetRef[],
): Promise<Record<string, SkImage>> {
  const entries = await Promise.all(
    refs.map(async (ref) => {
      let image = cache.get(ref.sha256);
      if (image === undefined) {
        image = resolveAsset(ref).then(decodeImageFile);
        image.catch(() => cache.delete(ref.sha256));
        cache.set(ref.sha256, image);
      }
      try {
        return [ref.sha256, await image] as const;
      } catch {
        return null;
      }
    }),
  );
  return Object.fromEntries(entries.filter((entry) => entry !== null));
}
