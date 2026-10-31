/**
 * A stable bucket in `[0, count)` for a key (FNV-1a), so one install always sees
 * the same A/B variant and installs spread evenly across variants (ANL-03).
 */
export function bucketOf(key: string, count: number): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % count;
}
