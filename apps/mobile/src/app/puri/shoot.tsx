import { useLocalSearchParams } from 'expo-router';

import { ShootScreen } from '../../features/puri/shoot-screen';

export default function ShootRoute() {
  const { retake } = useLocalSearchParams<{ retake?: string }>();
  const index = retake === undefined ? null : Number(retake);
  return (
    <ShootScreen retake={index !== null && Number.isInteger(index) && index >= 0 ? index : null} />
  );
}
