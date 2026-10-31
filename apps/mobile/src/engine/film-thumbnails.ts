import type { Film } from '@fant/content-schema';
import { BEAUTY_LEVELS } from '@fant/filters';
import {
  BlurStyle,
  FilterMode,
  MipmapMode,
  Skia,
  TileMode,
  vec,
  type SkImage,
} from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';

import { reportError } from '../features/analytics/analytics';
import { filterSettingsFor } from '../features/photo/filter-settings';
import { drawFiltered } from './draw-filtered';
import { filterEffects } from './filter-effects';
import { loadFilmLut } from './lut';
import { makeSurface } from './surface';

const WIDTH = 96;
const HEIGHT = 128;

let sample: SkImage | undefined;

/**
 * A small synthetic portrait (sky, skin, hair, a bright light) that shows what a
 * film does to colour, highlights and texture, without shipping a sample photo.
 */
function sampleImage(): SkImage {
  if (sample !== undefined) return sample;
  const surface = makeSurface(WIDTH, HEIGHT);
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  const sky = Skia.Shader.MakeLinearGradient(
    vec(0, 0),
    vec(0, HEIGHT),
    [Skia.Color('#7fb6e8'), Skia.Color('#f2c9a0'), Skia.Color('#5b4a6b')],
    [0, 0.55, 1],
    TileMode.Clamp,
  );
  const glow = Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 4, true);
  try {
    paint.setAntiAlias(true);
    paint.setShader(sky);
    canvas.drawRect(Skia.XYWHRect(0, 0, WIDTH, HEIGHT), paint);
    paint.setShader(null);
    const light = Skia.Paint();
    light.setAntiAlias(true);
    light.setColor(Skia.Color('#fff6d8'));
    light.setMaskFilter(glow);
    canvas.drawCircle(WIDTH * 0.8, HEIGHT * 0.16, 9, light);
    light.dispose();
    paint.setColor(Skia.Color('#2b1d1a'));
    canvas.drawOval(Skia.XYWHRect(WIDTH * 0.22, HEIGHT * 0.3, WIDTH * 0.56, HEIGHT * 0.62), paint);
    paint.setColor(Skia.Color('#e9b796'));
    canvas.drawOval(Skia.XYWHRect(WIDTH * 0.3, HEIGHT * 0.38, WIDTH * 0.4, HEIGHT * 0.4), paint);
    paint.setColor(Skia.Color('#ef8fa0'));
    canvas.drawOval(Skia.XYWHRect(WIDTH * 0.43, HEIGHT * 0.66, WIDTH * 0.14, HEIGHT * 0.04), paint);
    surface.flush();
    sample = toCpuImage(surface.makeImageSnapshot());
    return sample;
  } finally {
    sky.dispose();
    glow.dispose();
    paint.dispose();
    surface.dispose();
  }
}

/** A CPU copy, so the image outlives the GPU surface and can be drawn by any canvas. */
function toCpuImage(snapshot: SkImage): SkImage {
  try {
    const copy = snapshot.makeNonTextureImage();
    if (copy === null) throw new Error('Failed to copy the thumbnail');
    return copy;
  } finally {
    snapshot.dispose();
  }
}

const thumbnails = new Map<string, Promise<SkImage>>();

async function renderThumbnail(film: Film): Promise<SkImage> {
  const lut = await loadFilmLut(film);
  const image = sampleImage();
  const surface = makeSurface(WIDTH, HEIGHT);
  const source = image.makeShaderOptions(
    TileMode.Clamp,
    TileMode.Clamp,
    FilterMode.Linear,
    MipmapMode.None,
  );
  try {
    const seed = 0.5;
    drawFiltered(
      surface.getCanvas(),
      source,
      { width: WIDTH, height: HEIGHT },
      {
        effects: filterEffects(),
        settings: filterSettingsFor({
          film,
          intensity: 1,
          seed,
          beauty: BEAUTY_LEVELS.off,
          dateStamp: null,
        }),
        seed,
        lut,
        overlay: null,
      },
    );
    surface.flush();
    return toCpuImage(surface.makeImageSnapshot());
  } finally {
    source.dispose();
    surface.dispose();
  }
}

/**
 * A sample rendered through each film, for the film list (FLM-01). A static sample
 * is the fallback the requirement allows; it costs nothing while the camera runs.
 */
export function useFilmThumbnail(film: Film): SkImage | null {
  const [image, setImage] = useState<{ key: string; image: SkImage } | null>(null);
  const key = `${film.id}@${String(film.version)}`;
  useEffect(() => {
    let thumbnail = thumbnails.get(key);
    if (thumbnail === undefined) {
      thumbnail = renderThumbnail(film);
      thumbnail.catch(() => thumbnails.delete(key));
      thumbnails.set(key, thumbnail);
    }
    let current = true;
    thumbnail
      .then((rendered) => {
        if (current) setImage({ key, image: rendered });
      })
      .catch((error: unknown) => {
        reportError(error, 'film.thumbnail');
      });
    return () => {
      current = false;
    };
  }, [film, key]);
  return image?.key === key ? image.image : null;
}
