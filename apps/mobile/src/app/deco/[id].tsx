import { useLocalSearchParams } from 'expo-router';

import { DecoScreen } from '../../features/deco/deco-screen';

export default function DecoRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DecoScreen id={id} />;
}
