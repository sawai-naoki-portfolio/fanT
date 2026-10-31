import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';
import { launchImageLibraryAsync } from 'expo-image-picker';

import { developRaw } from '../../../modules/raw-develop/src';
import { resizeJpeg } from '../../engine/photo';
import type { AlbumPhoto } from '../album/album-types';
import { createPhoto } from './photo-service';
import { neutralRecipe } from './recipe';

/** About a 16 MP photo; larger imports are scaled down to this long edge. */
const MAX_IMPORT_LONG_EDGE = 4096;

/** RAW files the picker offers (EDT-36); the platform decoder reads DNG everywhere. */
const RAW_TYPES = ['image/x-adobe-dng', 'image/dng', 'image/x-raw'];

/** A RAW file that could not be developed on this device. */
export class RawNotSupportedError extends Error {
  override readonly name = 'RawNotSupportedError';
}

/** Asks the system photo picker for one image; `null` when the user cancels. */
export async function pickImageFile(): Promise<File | null> {
  // The system picker needs no library permission: only the chosen photo is shared.
  const result = await launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 1,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  return asset === undefined ? null : new File(asset.uri);
}

/** Adds image bytes to the album as an import, without a look to start from. */
function addImport(bytes: Uint8Array): Promise<AlbumPhoto> {
  return createPhoto({
    kind: 'import',
    // Very large images (panoramas, scans) would exceed what the device can render.
    original: resizeJpeg(bytes, MAX_IMPORT_LONG_EDGE),
    recipeFor: () => neutralRecipe(Math.random()),
  });
}

/**
 * Brings a photo from the device into the album to edit (EDT-04). It starts
 * without a look so the user chooses one in the editor.
 */
export async function importPhoto(): Promise<AlbumPhoto | null> {
  const file = await pickImageFile();
  return file === null ? null : addImport(await file.bytes());
}

/**
 * Brings a RAW photo (DNG) from the device's files into the album (EDT-36),
 * developed on the device; `null` when the user cancels.
 */
export async function importRaw(): Promise<AlbumPhoto | null> {
  const result = await getDocumentAsync({ type: RAW_TYPES, copyToCacheDirectory: true });
  const asset = result.canceled ? undefined : result.assets[0];
  if (asset === undefined) return null;
  const picked = new File(asset.uri);
  let developedUri: string | null = null;
  try {
    developedUri = await developRaw(picked.uri, MAX_IMPORT_LONG_EDGE);
    if (developedUri === null) throw new RawNotSupportedError('Could not develop the RAW file');
    return await addImport(new File(developedUri).bytesSync());
  } finally {
    // Both are copies in the cache; the album keeps its own original.
    if (picked.exists) picked.delete();
    if (developedUri !== null) {
      const developed = new File(developedUri);
      if (developed.exists) developed.delete();
    }
  }
}
