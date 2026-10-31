/**
 * Writes the SHA-256 of every referenced asset into the content JSON, so the app
 * can verify downloads (CNT-02). Run after adding or changing an asset.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  COLLECTION_FILES,
  filmFiles,
  findAssetRefs,
  readJson,
  ROOTS,
  type Root,
} from './collections';

for (const root of Object.keys(ROOTS) as Root[]) {
  const files = [
    ...filmFiles(root),
    ...Object.values(COLLECTION_FILES).map((file) => join(ROOTS[root], file)),
  ];
  for (const file of files) {
    let json: unknown;
    try {
      json = readJson(file);
    } catch {
      continue;
    }
    let changed = false;
    for (const ref of findAssetRefs(json)) {
      const sha256 = createHash('sha256')
        .update(readFileSync(join(ROOTS[root], ref.path)))
        .digest('hex');
      if (ref.sha256 !== sha256) {
        ref.sha256 = sha256;
        changed = true;
      }
    }
    if (changed) {
      writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
      console.log(`updated ${file}`);
    }
  }
}
