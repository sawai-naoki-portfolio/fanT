import { Redirect, useLocalSearchParams } from 'expo-router';

import { AiExpandScreen } from '../../features/ai/ai-expand-screen';

export default function AiExpandRoute() {
  const { uri } = useLocalSearchParams<{ uri?: string }>();
  if (uri?.startsWith('file://') !== true) return <Redirect href="/ai" />;
  return <AiExpandScreen sourceUri={uri} />;
}
