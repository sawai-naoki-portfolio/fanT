import { useLocalSearchParams } from 'expo-router';

import { EditScreen } from '../../features/edit/edit-screen';

export default function EditRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditScreen id={id} />;
}
