import { Redirect, useLocalSearchParams } from 'expo-router';

import { CollageScreen } from '../features/collage/collage-screen';
import { MAX_COLLAGE_PHOTOS, MIN_COLLAGE_PHOTOS } from '../features/collage/collage-layout';

export default function CollageRoute() {
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const list = ids?.split(',').filter((id) => /^[0-9a-f-]{36}$/.test(id)) ?? [];
  if (list.length < MIN_COLLAGE_PHOTOS || list.length > MAX_COLLAGE_PHOTOS)
    return <Redirect href="/album" />;
  return <CollageScreen ids={list} />;
}
