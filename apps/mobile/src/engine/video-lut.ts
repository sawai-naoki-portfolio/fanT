import { resolveFilmParams, type Film } from '@fant/content-schema';
import { colorOnlyFilmParams, makeLut, packUniforms, toFilmUniforms } from '@fant/filters';
import {
  AlphaType,
  ColorType,
  FilterMode,
  MipmapMode,
  Skia,
  TileMode,
} from '@shopify/react-native-skia';

import { toBase64 } from '../lib/base64';
import { filterEffects } from './filter-effects';
import { loadFilmLut } from './lut';
import { makeSurface } from './surface';

/** Entries per channel of a baked video LUT; 33 is the usual size for smooth gradients. */
const VIDEO_LUT_SIZE = 33;

export interface BakedLut {
  readonly size: number;
  /** RGBA8 in the film shader's LUT layout, base64 for the native module. */
  readonly rgbaBase64: string;
}

/**
 * The film's colour at `intensity` as a 3D LUT for video (CAM-13): an identity LUT
 * drawn through the same film shader as photos, with the effects that depend on
 * position (grain, vignette, leaks…) off. Each pixel of the identity LUT is its own
 * colour, so the result maps every colour the way the film does.
 */
export async function bakeFilmLut(film: Film, intensity: number): Promise<BakedLut> {
  const lut = await loadFilmLut(film);
  const identity = makeLut(VIDEO_LUT_SIZE, (r, g, b) => [r, g, b]);
  const data = Skia.Data.fromBytes(identity.pixels);
  const source = Skia.Image.MakeImage(
    {
      width: identity.width,
      height: identity.height,
      colorType: ColorType.RGBA_8888,
      alphaType: AlphaType.Unpremul,
    },
    data,
    identity.width * 4,
  );
  data.dispose();
  if (source === null) throw new Error('Failed to create the identity LUT');
  const surface = makeSurface(identity.width, identity.height);
  // Nearest sampling: every output pixel reads exactly its own entry.
  const sourceShader = source.makeShaderOptions(
    TileMode.Clamp,
    TileMode.Clamp,
    FilterMode.Nearest,
    MipmapMode.None,
  );
  const lutShader = lut.image.makeShaderOptions(
    TileMode.Clamp,
    TileMode.Clamp,
    FilterMode.Linear,
    MipmapMode.None,
  );
  const filmEffect = filterEffects().film;
  const params = colorOnlyFilmParams(resolveFilmParams(film, { intensity, seed: 0 }));
  const shader = filmEffect.makeShaderWithChildren(
    packUniforms(
      filmEffect,
      toFilmUniforms(params, {
        width: identity.width,
        height: identity.height,
        seed: 0,
        lutSize: lut.size,
      }),
    ),
    [sourceShader, lutShader],
  );
  const paint = Skia.Paint();
  try {
    paint.setShader(shader);
    surface.getCanvas().drawRect(Skia.XYWHRect(0, 0, identity.width, identity.height), paint);
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    try {
      const pixels = snapshot.readPixels(0, 0, {
        width: identity.width,
        height: identity.height,
        colorType: ColorType.RGBA_8888,
        alphaType: AlphaType.Unpremul,
      });
      if (!(pixels instanceof Uint8Array)) throw new Error('Failed to read the baked LUT');
      return { size: VIDEO_LUT_SIZE, rgbaBase64: toBase64(pixels) };
    } finally {
      snapshot.dispose();
    }
  } finally {
    paint.dispose();
    shader.dispose();
    lutShader.dispose();
    sourceShader.dispose();
    source.dispose();
    surface.dispose();
  }
}
