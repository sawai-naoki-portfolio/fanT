import { File } from 'expo-file-system';
import { Album, Asset, requestPermissionsAsync } from 'expo-media-library';
import { shareAsync } from 'expo-sharing';

import { shareToInstagramStories } from '../../../modules/instagram-stories/src';
import { GRADIENT } from '../../ui/theme';
import { reportError } from '../analytics/analytics';
import { resizeJpeg } from '../../engine/photo';
import { tempDirectory } from '../../lib/temp-files';
import type { ExportSize } from '../settings/settings-store';

/** The device album photos are saved into (SHR-01). */
const DEVICE_ALBUM = 'fanT';
/** Long edge of "for social media" exports (SHR-04). */
const SNS_LONG_EDGE = 2048;

export class PhotoLibraryPermissionError extends Error {
  override readonly name = 'PhotoLibraryPermissionError';
}

function isVideo(file: File): boolean {
  return file.uri.endsWith('.mp4');
}

/**
 * Writes the photo to a temporary file of the chosen size, or copies a video (CAM-13)
 * as it is; the caller deletes it.
 */
function exportFile(source: File, size: ExportSize): File {
  if (isVideo(source)) {
    const copy = new File(tempDirectory('export'), `fant-${String(Date.now())}.mp4`);
    source.copySync(copy);
    return copy;
  }
  const file = new File(tempDirectory('export'), `fant-${String(Date.now())}.jpg`);
  const bytes = source.bytesSync();
  file.writeSync(size === 'sns' ? resizeJpeg(bytes, SNS_LONG_EDGE) : bytes);
  return file;
}

/**
 * Saves a photo to the device library, in the app's own album when the system
 * allows it (SHR-01). Asks only for add-only access: the app never reads the
 * user's photos. Never adds a watermark, and the file carries no location (SHR-05).
 */
export async function saveToLibrary(source: File, size: ExportSize): Promise<void> {
  const { granted } = await requestPermissionsAsync(true);
  if (!granted) throw new PhotoLibraryPermissionError('Photo library access was not granted');
  const file = exportFile(source, size);
  try {
    try {
      const album = await Album.get(DEVICE_ALBUM);
      if (album === null) {
        const asset = await Asset.create(file.uri);
        await Album.create(DEVICE_ALBUM, [asset]);
      } else {
        await Asset.create(file.uri, album);
      }
    } catch (error) {
      // Add-only access may not allow albums: save to the library itself instead.
      reportError(error, 'library.album');
      await Asset.create(file.uri);
    }
  } finally {
    file.delete();
  }
}

/**
 * Hands the photo to Instagram Stories as a sticker over the app's pink-lavender
 * gradient (SHR-03), sized for social media; `false` when Instagram is missing.
 * The file stays in the scratch folder, since Instagram reads it after this
 * returns; the folder is cleared at the next launch.
 */
export function shareToStories(source: File, appId: string): Promise<boolean> {
  const [topColor, bottomColor] = GRADIENT;
  return shareToInstagramStories(exportFile(source, 'sns').uri, { appId, topColor, bottomColor });
}

/** Opens the system share sheet with the photo or video (SHR-02). */
export async function sharePhoto(source: File, size: ExportSize): Promise<void> {
  const file = exportFile(source, size);
  try {
    await shareAsync(
      file.uri,
      isVideo(file)
        ? { mimeType: 'video/mp4', UTI: 'public.mpeg-4' }
        : { mimeType: 'image/jpeg', UTI: 'public.jpeg' },
    );
  } finally {
    file.delete();
  }
}
