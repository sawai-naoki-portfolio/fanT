import { Redirect, useLocalSearchParams } from 'expo-router';

import { AiEraseScreen } from '../../features/ai/ai-erase-screen';

export default function AiEraseRoute() {
  const { uri } = useLocalSearchParams<{ uri?: string }>();
  if (uri?.startsWith('file://') !== true) return <Redirect href="/ai" />;
  return <AiEraseScreen sourceUri={uri} />;
}
