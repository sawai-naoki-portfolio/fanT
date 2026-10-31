import { Redirect } from 'expo-router';

import { CameraScreen } from '../features/camera/camera-screen';
import { useSettings } from '../features/settings/settings-store';

/** The camera is home (S-10); the first launch shows the introduction (S-02) first. */
export default function HomeScreen() {
  const onboardingCompleted = useSettings((state) => state.onboardingCompleted);
  if (!onboardingCompleted) return <Redirect href="/onboarding" />;
  return <CameraScreen />;
}
