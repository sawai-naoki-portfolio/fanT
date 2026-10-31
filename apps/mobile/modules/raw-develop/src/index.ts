import { requireOptionalNativeModule } from 'expo';

interface RawDevelopModule {
  develop(fileUri: string, maxEdge: number): Promise<string | null>;
}

/** `null` where the native module is not built in (e.g. tests, web). */
const native = requireOptionalNativeModule<RawDevelopModule>('RawDevelop');

/** Whether this build can develop RAW photos (EDT-36). */
export const rawDevelopSupported = native !== null;

/**
 * Develops a RAW file (DNG) on the device into a JPEG beside it, at most `maxEdge`
 * on its long edge. Resolves its URI, or `null` when the file cannot be read as RAW.
 */
export async function developRaw(fileUri: string, maxEdge: number): Promise<string | null> {
  if (native === null) return null;
  return native.develop(fileUri, maxEdge);
}
