import { sharedState } from '../shared-state';

/** `expo-sqlite/kv-store` in memory. */
const items = sharedState('kv-store', () => new Map<string, string>());

const Storage = {
  getItemSync: (key: string): string | null => items.get(key) ?? null,
  setItemSync: (key: string, value: string): void => {
    items.set(key, value);
  },
  removeItemSync: (key: string): void => {
    items.delete(key);
  },
};

export default Storage;

export function resetKvStore(): void {
  items.clear();
}
