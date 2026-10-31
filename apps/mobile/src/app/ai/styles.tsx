import { Redirect, useLocalSearchParams } from 'expo-router';

import { AiStylesScreen } from '../../features/ai/ai-styles-screen';
import { getPhoto } from '../../features/album/album-db';

export default function AiStylesRoute() {
  const { uri, photoId } = useLocalSearchParams<{ uri?: string; photoId?: string }>();
  const source = uri ?? (photoId === undefined ? undefined : getPhoto(photoId)?.outputUri);
  // Only local files are uploaded.
  if (source?.startsWith('file://') !== true) return <Redirect href="/ai" />;
  return <AiStylesScreen sourceUri={source} />;
}
