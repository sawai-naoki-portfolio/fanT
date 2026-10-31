import { Redirect } from 'expo-router';

import { APP_CONFIG } from '../../config';
import { AiPhotoScreen } from '../../features/ai/ai-photo-screen';

export default function AiRoute() {
  // Without a server the AI mode is not offered (03 §4: other modes keep working).
  if (APP_CONFIG.apiBaseUrl === null) return <Redirect href="/" />;
  return <AiPhotoScreen />;
}
