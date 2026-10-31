import Storage from 'expo-sqlite/kv-store';
import { createJSONStorage, type PersistOptions, type PersistStorage } from 'zustand/middleware';
import type { z } from 'zod';

/**
 * Persistence for small stores (settings, camera choices) in a SQLite key-value
 * table: synchronous, so the first render already has the saved values.
 */
const storage = createJSONStorage<unknown>(() => ({
  getItem: (key: string) => Storage.getItemSync(key),
  setItem: (key: string, value: string) => {
    Storage.setItemSync(key, value);
  },
  removeItem: (key: string) => {
    Storage.removeItemSync(key);
  },
}));

/**
 * Persist options that restore only valid values: each saved field is checked
 * against the schema and falls back to its default, so a stored value from an older
 * version (or a corrupted one) can never break the app.
 */
export function persistValidated<TState extends object, TSchema extends z.ZodObject>(
  name: string,
  schema: TSchema,
): PersistOptions<TState, z.infer<TSchema>> {
  return {
    name,
    storage: storage as PersistStorage<z.infer<TSchema>>,
    version: 1,
    partialize: (state) => {
      const persisted: Record<string, unknown> = {};
      for (const key of Object.keys(schema.shape)) {
        persisted[key] = (state as Record<string, unknown>)[key];
      }
      return persisted as z.infer<TSchema>;
    },
    merge: (persisted, current) => {
      if (persisted === null || typeof persisted !== 'object') return current;
      const restored: Record<string, unknown> = {};
      for (const [key, fieldSchema] of Object.entries(schema.shape)) {
        const result = (fieldSchema as z.ZodType).safeParse(
          (persisted as Record<string, unknown>)[key],
        );
        if (result.success) restored[key] = result.data;
      }
      return { ...current, ...restored };
    },
  };
}
