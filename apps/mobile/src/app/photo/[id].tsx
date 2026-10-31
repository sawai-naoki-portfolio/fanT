import { useLocalSearchParams } from 'expo-router';

import { PhotoScreen } from '../../features/photo/photo-screen';

export default function PhotoRoute() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  return <PhotoScreen id={id} fromCamera={from === 'camera'} />;
}
