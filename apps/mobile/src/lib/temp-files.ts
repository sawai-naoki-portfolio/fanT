import { Directory, Paths } from 'expo-file-system';

/** Scratch files for the current launch (AI sources and results, exports, puri shots). */
const TEMP_ROOT = new Directory(Paths.cache, 'tmp');

/** A folder under the scratch space, created if needed. */
export function tempDirectory(name: string): Directory {
  const directory = new Directory(TEMP_ROOT, name);
  directory.create({ intermediates: true, idempotent: true });
  return directory;
}

/** Clears the scratch space; run at launch, before anything uses it, so nothing piles up. */
export function clearTempFiles(): void {
  if (TEMP_ROOT.exists) TEMP_ROOT.delete();
}
