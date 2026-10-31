import { requireOptionalNativeModule } from 'expo';

interface InstagramStoriesModule {
  share(fileUri: string, appId: string, topColor: string, bottomColor: string): Promise<boolean>;
}

/** `null` where the native module is not built in (e.g. tests, web). */
const native = requireOptionalNativeModule<InstagramStoriesModule>('InstagramStories');

/** Whether this build can hand photos to Instagram Stories at all. */
export const instagramStoriesSupported = native !== null;

/**
 * Opens Instagram's story composer with a JPEG file as a sticker over a vertical
 * gradient (SHR-03), the way Instagram documents for apps. `appId` is the app's
 * Facebook App ID. Resolves `false` when Instagram is not installed.
 */
export async function shareToInstagramStories(
  fileUri: string,
  options: { readonly appId: string; readonly topColor: string; readonly bottomColor: string },
): Promise<boolean> {
  if (native === null) return false;
  return native.share(fileUri, options.appId, options.topColor, options.bottomColor);
}
