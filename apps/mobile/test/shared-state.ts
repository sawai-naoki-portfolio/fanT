/**
 * State of a fake that outlives `vi.resetModules()`: a test reloads a module to clear
 * its caches, and the reloaded copy must see the same files and stored values.
 */
export function sharedState<T>(name: string, create: () => T): T {
  const key = Symbol.for(`fant.fake.${name}`);
  const store = globalThis as unknown as Record<symbol, T | undefined>;
  store[key] ??= create();
  return store[key];
}
