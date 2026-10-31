import { sharedState } from '../shared-state';

/** `expo-secure-store` in memory. */
const items = sharedState('secure-store', () => new Map<string, string>());

export function getItemAsync(key: string): Promise<string | null> {
  return Promise.resolve(items.get(key) ?? null);
}

export function setItemAsync(key: string, value: string): Promise<void> {
  items.set(key, value);
  return Promise.resolve();
}

export function deleteItemAsync(key: string): Promise<void> {
  items.delete(key);
  return Promise.resolve();
}

export function resetSecureStore(): void {
  items.clear();
}
