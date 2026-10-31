import { Redirect, useLocalSearchParams } from 'expo-router';

import { AiGenerateScreen } from '../../features/ai/ai-generate-screen';

export default function AiGenerateRoute() {
  const { uri, styleId, maskUri } = useLocalSearchParams<{
    uri?: string;
    styleId?: string;
    maskUri?: string;
  }>();
  if (uri?.startsWith('file://') !== true || styleId === undefined) return <Redirect href="/ai" />;
  if (maskUri !== undefined && !maskUri.startsWith('file://')) return <Redirect href="/ai" />;
  return <AiGenerateScreen sourceUri={uri} styleId={styleId} maskUri={maskUri ?? null} />;
}
