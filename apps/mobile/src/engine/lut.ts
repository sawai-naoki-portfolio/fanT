import type { Film } from '@fant/content-schema';
import { IDENTITY_LUT, LUT_SIZE_RANGE } from '@fant/filters';
import { AlphaType, ColorType, Skia, type SkImage } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';

import { reportError } from '../features/analytics/analytics';
import { resolveAsset } from '../features/content/assets';
import { decodeImageFile } from './images';

/** A decoded LUT ready to bind as the film shader's `lut` child. */
export interface LoadedLut {
  readonly image: SkImage;
  readonly size: number;
}

let identity: LoadedLut | undefined;

/** The LUT used when a film has none, or while its LUT loads (`lutIntensity` is then 0). */
export function identityLut(): LoadedLut {
  if (identity === undefined) {
    const data = Skia.Data.fromBytes(IDENTITY_LUT.pixels);
    const image = Skia.Image.MakeImage(
      {
        width: IDENTITY_LUT.width,
        height: IDENTITY_LUT.height,
        colorType: ColorType.RGBA_8888,
        alphaType: AlphaType.Unpremul,
      },
      data,
      IDENTITY_LUT.width * 4,
    );
    data.dispose();
    if (image === null) throw new Error('Failed to create the identity LUT');
    identity = { image, size: IDENTITY_LUT.size };
  }
  return identity;
}

/** LUTs stay decoded for the session (each is well under 1 MB). */
const cache = new Map<string, Promise<LoadedLut>>();

async function decodeLut(uri: string): Promise<LoadedLut> {
  const image = await decodeImageFile(uri);
  const size = image.height();
  // A malformed LUT is rejected rather than sampled out of bounds.
  if (image.width() !== size * size || size < LUT_SIZE_RANGE.min || size > LUT_SIZE_RANGE.max) {
    image.dispose();
    throw new Error(`Invalid LUT dimensions ${String(image.width())}x${String(size)}`);
  }
  return { image, size };
}

/** The film's LUT, loading (and downloading) it if needed. */
export function loadFilmLut(film: Film): Promise<LoadedLut> {
  const ref = film.lut;
  if (ref === undefined) return Promise.resolve(identityLut());
  let lut = cache.get(ref.sha256);
  if (lut === undefined) {
    lut = resolveAsset(ref).then(decodeLut);
    lut.catch(() => cache.delete(ref.sha256));
    cache.set(ref.sha256, lut);
  }
  return lut;
}

/**
 * The film's LUT for the live preview. Until it is ready this is the identity LUT,
 * so the film shows without its colour look instead of waiting.
 */
export function useFilmLut(film: Film): LoadedLut {
  const [loaded, setLoaded] = useState<{ film: Film; lut: LoadedLut } | null>(null);
  useEffect(() => {
    let current = true;
    loadFilmLut(film)
      .then((lut) => {
        if (current) setLoaded({ film, lut });
      })
      .catch((error: unknown) => {
        reportError(error, 'lut.load');
      });
    return () => {
      current = false;
    };
  }, [film]);
  return loaded?.film === film ? loaded.lut : identityLut();
}
