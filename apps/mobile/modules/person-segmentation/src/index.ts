import { requireOptionalNativeModule } from 'expo';

interface PersonSegmentationModule {
  segment(fileUri: string): Promise<string | null>;
}

/** `null` where the native module is not built in (e.g. tests, web). */
const native = requireOptionalNativeModule<PersonSegmentationModule>('PersonSegmentation');

/** Whether this build can cut people out of photos (PRI-04). */
export const personSegmentationSupported = native !== null;

/**
 * Finds the people in an upright JPEG file, on the device (03 §6: nothing is sent).
 * Resolves the URI of a PNG beside it, white with each pixel's alpha the confidence
 * that it shows a person, or `null` when segmentation is unavailable or fails.
 */
export async function segmentPerson(fileUri: string): Promise<string | null> {
  if (native === null) return null;
  return native.segment(fileUri);
}
