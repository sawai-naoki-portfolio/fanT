import { AlphaType, ColorType, Skia, type SkImage } from '@shopify/react-native-skia';

import { skyMask } from '../features/sky/sky-mask';
import { samplePixels } from './sample-pixels';

/** Long edge of the sample the sky is found in; the mask is scaled up smoothly. */
const SAMPLE_EDGE = 160;

/** Masks by original: the editor re-renders the same original many times. */
const cache = new WeakMap<SkImage, SkImage | null>();

/**
 * The sky of an original as a mask image (alpha = sky), over the whole original
 * once scaled to its size, or `null` when it shows no sky (EDT-25).
 */
export function skyMaskImage(original: SkImage): SkImage | null {
  if (cache.has(original)) return cache.get(original) ?? null;
  const sample = samplePixels(original, SAMPLE_EDGE);
  const found = skyMask(sample.pixels, sample.width, sample.height);
  let image: SkImage | null = null;
  if (found !== null) {
    const rgba = new Uint8Array(found.width * found.height * 4);
    for (let index = 0; index < found.alpha.length; index++) {
      rgba.set([255, 255, 255, found.alpha[index] ?? 0], index * 4);
    }
    const data = Skia.Data.fromBytes(rgba);
    image = Skia.Image.MakeImage(
      {
        width: found.width,
        height: found.height,
        colorType: ColorType.RGBA_8888,
        alphaType: AlphaType.Unpremul,
      },
      data,
      found.width * 4,
    );
    data.dispose();
  }
  cache.set(original, image);
  return image;
}
