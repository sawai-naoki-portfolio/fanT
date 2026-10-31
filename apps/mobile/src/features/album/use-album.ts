import { useMemo, useSyncExternalStore } from 'react';

import { getPhoto, listPhotos, subscribeAlbum } from './album-db';
import type { AlbumPhoto } from './album-types';

let version = 0;
subscribeAlbum(() => {
  version++;
});
const getVersion = () => version;

/** The album, re-read whenever it changes. */
export function useAlbum(): AlbumPhoto[] {
  const current = useSyncExternalStore(subscribeAlbum, getVersion);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `current` changes when the album does
  return useMemo(() => listPhotos(), [current]);
}

/** One album photo, or `null` once it is deleted. */
export function useAlbumPhoto(id: string): AlbumPhoto | null {
  const current = useSyncExternalStore(subscribeAlbum, getVersion);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `current` changes when the album does
  return useMemo(() => getPhoto(id), [id, current]);
}
