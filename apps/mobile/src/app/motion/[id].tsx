import { useLocalSearchParams } from 'expo-router';

import { MotionScreen } from '../../features/motion/motion-screen';

export default function MotionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MotionScreen id={id} />;
}
