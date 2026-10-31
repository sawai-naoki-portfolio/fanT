import type { SkImage } from '@shopify/react-native-skia';
import { File } from 'expo-file-system';

import { segmentPerson } from '../../modules/person-segmentation/src';
import { decodeImageFile } from './images';

/** The last original's mask: the editor re-renders the same original many times. */
let cached: { readonly uri: string; readonly mask: Promise<SkImage | null> } | null = null;

async function load(originalUri: string): Promise<SkImage | null> {
  const maskUri = await segmentPerson(originalUri);
  if (maskUri === null) return null;
  try {
    return await decodeImageFile(maskUri);
  } finally {
    const file = new File(maskUri);
    if (file.exists) file.delete();
  }
}

/**
 * The people in an original as a mask (alpha = person), cut out on the device and
 * kept in memory only (03 §6), or `null` where segmentation is unavailable.
 */
export function personMask(originalUri: string): Promise<SkImage | null> {
  if (cached?.uri !== originalUri) {
    cached = { uri: originalUri, mask: load(originalUri).catch(() => null) };
  }
  return cached.mask;
}
