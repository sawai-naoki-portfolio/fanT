import { File } from 'expo-file-system';
import { create } from 'zustand';

import type { DecoLayer } from '../photo/recipe';
import type { Backdrop } from '../photo/backdrops';
import { tempDirectory } from '../../lib/temp-files';

/** One purikura shot, already cropped to its cell and rendered with the puri look. */
export interface PuriShot {
  readonly uri: string;
  readonly deco: readonly DecoLayer[];
}

/** Shots live in the cache until the sheet is finished; they never reach the album alone. */
const SHOTS_FOLDER = 'puri';

/** Counts takes, so two in the same millisecond still get their own files. */
let takes = 0;

interface PuriSession {
  readonly layoutId: string | null;
  readonly shots: readonly (PuriShot | null)[];
  /** The background put behind the people (PRI-04); `null` keeps the real one. */
  readonly backdrop: Backdrop | null;
  readonly setBackdrop: (backdrop: Backdrop | null) => void;
  readonly start: (layoutId: string, cellCount: number) => void;
  readonly setShot: (index: number, jpeg: Uint8Array) => void;
  readonly setDeco: (index: number, deco: readonly DecoLayer[]) => void;
  readonly reset: () => void;
}

function clearShots(): void {
  tempDirectory(SHOTS_FOLDER).delete();
}

/** The purikura in progress (S-30–S-34). */
export const usePuriSession = create<PuriSession>()((set, get) => ({
  layoutId: null,
  shots: [],
  backdrop: null,
  setBackdrop: (backdrop) => {
    set({ backdrop });
  },
  start: (layoutId, cellCount) => {
    clearShots();
    set({ layoutId, shots: Array.from({ length: cellCount }, () => null), backdrop: null });
  },
  setShot: (index, jpeg) => {
    // A new file name per take, so a retake never shows a cached image.
    takes += 1;
    const file = new File(tempDirectory(SHOTS_FOLDER), `${String(index)}-${String(takes)}.jpg`);
    file.writeSync(jpeg);
    const previous = get().shots[index];
    if (previous !== null && previous !== undefined) {
      const old = new File(previous.uri);
      if (old.exists) old.delete();
    }
    set((state) => ({
      shots: state.shots.map((shot, i) => (i === index ? { uri: file.uri, deco: [] } : shot)),
    }));
  },
  setDeco: (index, deco) => {
    set((state) => ({
      shots: state.shots.map((shot, i) =>
        i === index && shot !== null ? { ...shot, deco } : shot,
      ),
    }));
  },
  reset: () => {
    clearShots();
    set({ layoutId: null, shots: [], backdrop: null });
  },
}));
