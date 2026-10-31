import { Redirect, useLocalSearchParams } from 'expo-router';

import { canMerge, isMergeMode } from '../features/merge/merge-modes';
import { MergeScreen } from '../features/merge/merge-screen';

export default function MergeRoute() {
  const { mode, ids } = useLocalSearchParams<{ mode?: string; ids?: string }>();
  const list = ids?.split(',').filter((id) => /^[0-9a-f-]{36}$/.test(id)) ?? [];
  if (!isMergeMode(mode) || !canMerge(mode, list.length)) return <Redirect href="/album" />;
  return <MergeScreen mode={mode} ids={list} />;
}
