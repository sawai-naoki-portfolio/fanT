import { create } from 'zustand';

import type { Look } from '../photo/recipe';

/** A copied look, to paste on other photos (EDT-33); kept for the session only. */
export const useLookClipboard = create<{
  readonly look: Look | null;
  readonly copy: (look: Look) => void;
}>()((set) => ({
  look: null,
  copy: (look) => {
    set({ look });
  },
}));
