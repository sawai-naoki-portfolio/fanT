import type { BeautyParams } from '@fant/filters';
import { File } from 'expo-file-system';

import { segmentPerson } from '../../../modules/person-segmentation/src';
import { replaceBackground } from '../../engine/backdrop';
import { decodeImage, encodeJpeg, imageSize, resizeJpeg } from '../../engine/photo';
import { tempDirectory } from '../../lib/temp-files';
import { centerCrop } from '../photo/geometry';
import { renderRecipe } from '../photo/photo-service';
import { newRecipe } from '../photo/recipe';
import type { Backdrop } from '../photo/backdrops';

/** Purikura-style correction (PRI-03): bright, white, smooth skin… */
export const PURI_BEAUTY: BeautyParams = { smoothing: 0.7, brightness: 0.55, rosiness: 0.15 };
/** …through the purikura film with its sparkle. */
export const PURI_FILM_ID = 'puri';
/** Shots are kept at this size; a sheet cell is smaller still. */
const SHOT_LONG_EDGE = 1600;
/** Shots with a backdrop are cut out at this size, comfortably above a shot's. */
const BACKDROP_LONG_EDGE = 2400;

/**
 * The shot with its people on `backdrop` (PRI-04), cut out on the device. Without
 * segmentation (unsupported, or it failed) the shot keeps its real background.
 */
async function withBackdrop(bytes: Uint8Array, backdrop: Backdrop): Promise<Uint8Array> {
  const file = new File(tempDirectory('segment'), `${String(Date.now())}.jpg`);
  file.writeSync(bytes);
  let maskUri: string | null = null;
  try {
    maskUri = await segmentPerson(file.uri);
    return maskUri === null ? bytes : await replaceBackground(bytes, maskUri, backdrop);
  } finally {
    file.delete();
    if (maskUri !== null) new File(maskUri).delete();
  }
}

/**
 * Renders a captured shot with the puri look, cropped to its cell's shape so it
 * fills the cell exactly and scribbles land where they were drawn.
 */
export async function renderPuriShot(input: {
  readonly bytes: Uint8Array;
  readonly cellAspect: number;
  readonly mirror: boolean;
  readonly seed: number;
  readonly backdrop: Backdrop | null;
}): Promise<Uint8Array> {
  const image = decodeImage(
    input.backdrop === null
      ? input.bytes
      : // Cutting out a full-size photo is slow and its detail is lost in a cell anyway.
        await withBackdrop(resizeJpeg(input.bytes, BACKDROP_LONG_EDGE), input.backdrop),
  );
  try {
    const recipe = newRecipe({
      filmId: PURI_FILM_ID,
      intensity: 1,
      beauty: PURI_BEAUTY,
      dateStamp: null,
      character: null,
      seed: input.seed,
      mirror: input.mirror,
      crop: centerCrop(imageSize(image), input.cellAspect),
    });
    const rendered = await renderRecipe(image, null, recipe, { maxLongEdge: SHOT_LONG_EDGE });
    try {
      return encodeJpeg(rendered);
    } finally {
      rendered.dispose();
    }
  } finally {
    image.dispose();
  }
}
