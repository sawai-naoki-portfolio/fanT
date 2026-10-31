import { randomUUID } from 'expo-crypto';
import { z } from 'zod';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistValidated } from '../../lib/kv-storage';
import { lookSchema, type Look } from '../photo/recipe';

/** Presets kept at most; a list longer than this stops being quick to choose from. */
export const MAX_PRESETS = 30;

const presetSchema = z.strictObject({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(40),
  look: lookSchema,
});
export type Preset = z.infer<typeof presetSchema>;

const presetsSchema = z.object({ presets: z.array(presetSchema).max(MAX_PRESETS) });

interface PresetsActions {
  /** Saves `look` as a preset; `false` when the list is full. */
  readonly add: (name: string, look: Look) => boolean;
  readonly remove: (id: string) => void;
}

/** The user's own looks, saved on the device (EDT-33). */
export const usePresets = create<z.infer<typeof presetsSchema> & PresetsActions>()(
  persist(
    (set, get) => ({
      presets: [],
      add: (name, look) => {
        if (get().presets.length >= MAX_PRESETS) return false;
        set({ presets: [...get().presets, { id: randomUUID(), name, look }] });
        return true;
      },
      remove: (id) => {
        set({ presets: get().presets.filter((preset) => preset.id !== id) });
      },
    }),
    persistValidated<z.infer<typeof presetsSchema> & PresetsActions, typeof presetsSchema>(
      'presets',
      presetsSchema,
    ),
  ),
);
