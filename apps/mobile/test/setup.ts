import { beforeEach, vi } from 'vitest';

import { resetControls } from './controls';
import { resetSecureStore } from './fakes/expo-secure-store';
import { resetKvStore } from './fakes/expo-sqlite-kv-store';
import { resetFileSystem } from './fakes/expo-file-system';

/*
 * Native modules cannot load on Node.js, so every test gets these fakes. They keep
 * the modules' behaviour (files on disk, real SQLite) rather than recording calls.
 */
vi.mock('react-native', () => import('./fakes/react-native'));
vi.mock('expo-constants', () => import('./fakes/expo-constants'));
vi.mock('expo-crypto', () => import('./fakes/expo-crypto'));
vi.mock('expo-file-system', () => import('./fakes/expo-file-system'));
vi.mock('expo-secure-store', () => import('./fakes/expo-secure-store'));
vi.mock('expo-sqlite', () => import('./fakes/expo-sqlite'));
vi.mock('expo-sqlite/kv-store', () => import('./fakes/expo-sqlite-kv-store'));

Object.assign(globalThis, { __DEV__: false });

beforeEach(() => {
  resetFileSystem();
  resetKvStore();
  resetSecureStore();
  resetControls();
});
