/**
 * Builds what the content server delivers (CNT-01/02) into dist/: manifest.json
 * (built-in plus remote content, validated) and every asset under
 * `assets/<sha256>.<ext>`. Content-addressed names never change, so the CDN can
 * cache assets forever and an updated asset can never be served stale. The app
 * treats the download as untrusted and checks it against the schema and hashes.
 */
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

import { mergeManifests, parseManifest, type Manifest } from '@fant/content-schema';

import { mapAssetRefs, readRawManifest, ROOTS, type Root } from './collections';

const dist = join(import.meta.dirname, '..', 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'assets'), { recursive: true });

/** Copies each referenced asset to its content-addressed name and points the ref there. */
function publish(root: Root): Manifest {
  const raw = mapAssetRefs(readRawManifest(root), (ref) => {
    const path = `assets/${ref.sha256}${extname(ref.path)}`;
    copyFileSync(join(ROOTS[root], ref.path), join(dist, path));
    return { path, sha256: ref.sha256 };
  });
  return parseManifest(raw);
}

const manifest = mergeManifests(publish('builtin'), publish('remote'));
writeFileSync(join(dist, 'manifest.json'), JSON.stringify(manifest));
console.log(
  `dist/manifest.json: ${String(manifest.films.length)} films, ${String(manifest.characters.length)} characters, ${String(manifest.layouts.length)} layouts, ${String(manifest.stamps.length)} stamps`,
);
