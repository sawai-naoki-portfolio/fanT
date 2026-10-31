import Storage from 'expo-sqlite/kv-store';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistValidated } from './kv-storage';

const schema = z.object({
  size: z.enum(['full', 'sns']),
  count: z.number().int().min(0),
});

type State = z.infer<typeof schema> & { readonly bump: () => void };

/** A store like the app's settings, restored from whatever is saved under `test`. */
function makeStore() {
  return create<State>()(
    persist(
      (set) => ({
        size: 'full',
        count: 0,
        bump: () => {
          set((state) => ({ count: state.count + 1 }));
        },
      }),
      persistValidated<State, typeof schema>('test', schema),
    ),
  );
}

function save(state: unknown) {
  Storage.setItemSync('test', JSON.stringify({ state, version: 1 }));
}

describe('persistValidated', () => {
  it('starts from the defaults when nothing is saved', () => {
    expect(makeStore().getState()).toMatchObject({ size: 'full', count: 0 });
  });

  it('saves the schema’s fields and restores them on the next launch', () => {
    makeStore().getState().bump();

    expect(JSON.parse(Storage.getItemSync('test') ?? '')).toEqual({
      state: { size: 'full', count: 1 },
      version: 1,
    });
    expect(makeStore().getState().count).toBe(1);
  });

  it('falls back to the default for each invalid field, keeping the valid ones', () => {
    save({ size: 'huge', count: 5, removedSetting: true });

    const state = makeStore().getState();

    expect(state).toMatchObject({ size: 'full', count: 5 });
    expect(state).not.toHaveProperty('removedSetting');
  });

  it('starts from the defaults when the saved value is not an object', () => {
    save('corrupted');

    expect(makeStore().getState()).toMatchObject({ size: 'full', count: 0 });
  });
});
