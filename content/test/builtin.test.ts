import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { parseManifest } from '@fant/content-schema';
import { describe, expect, it } from 'vitest';

import {
  filmFiles,
  findAssetRefs,
  readRawManifest,
  ROOTS,
  type Root,
} from '../scripts/collections';
import { decodePng } from '../scripts/png';
import { builtInManifest } from '../src';

const ROOT_NAMES = Object.keys(ROOTS) as Root[];

describe.each(ROOT_NAMES)('%s content', (root) => {
  const raw = readRawManifest(root);

  it('matches the content schema', () => {
    expect(() => parseManifest(raw)).not.toThrow();
  });

  it('references only existing assets whose hash matches', () => {
    for (const { path, sha256 } of findAssetRefs(raw)) {
      const file = readFileSync(join(ROOTS[root], path));
      expect(createHash('sha256').update(file).digest('hex'), path).toBe(sha256);
    }
  });

  it('names each film file after its ID', () => {
    for (const file of filmFiles(root)) {
      expect((JSON.parse(readFileSync(file, 'utf8')) as { id: string }).id).toBe(
        basename(file, '.json'),
      );
    }
  });

  it('ships LUTs laid out as size² × size slices', () => {
    for (const { path } of findAssetRefs(raw).filter(({ path }) => path.startsWith('luts/'))) {
      const { width, height } = decodePng(readFileSync(join(ROOTS[root], path)));
      expect(width, path).toBe(height * height);
    }
  });
});

describe('builtInManifest', () => {
  const manifest = builtInManifest();
  const raw = readRawManifest('builtin');

  it('includes every film file in builtin/', () => {
    const ids = (raw.films as { id: string }[]).map(({ id }) => id).sort();
    expect(manifest.films.map(({ id }) => id).sort()).toEqual(ids);
  });

  it('offers at least four free and four premium films (FLM-02)', () => {
    expect(manifest.films.filter(({ tier }) => tier === 'free').length).toBeGreaterThanOrEqual(4);
    expect(manifest.films.filter(({ tier }) => tier === 'premium').length).toBeGreaterThanOrEqual(
      4,
    );
  });

  it('offers 8+ characters, some moving and some 3D (CNT-06, CHR-08/09)', () => {
    expect(manifest.characters.length).toBeGreaterThanOrEqual(8);
    const parts = manifest.characters.flatMap(({ parts }) => parts);
    expect(parts.some(({ motion }) => motion !== undefined)).toBe(true);
    expect(parts.some(({ depth }) => depth !== undefined)).toBe(true);
  });

  it('names everything in English too, except stamps that are words (SET-05)', () => {
    const named = [
      ...manifest.films,
      ...manifest.characters,
      ...manifest.characters.flatMap(({ variants }) => variants),
      ...manifest.layouts,
      ...manifest.aiStyles,
      ...manifest.stamps.filter(({ art }) => art.type !== 'text'),
    ];
    for (const { name } of named) expect(name.en, name.ja).toBeDefined();
  });

  it('offers 15+ films, 60+ stamps and 8+ AI styles (CNT-06)', () => {
    expect(manifest.films.length).toBeGreaterThanOrEqual(15);
    expect(manifest.stamps.length).toBeGreaterThanOrEqual(60);
    expect(manifest.aiStyles.length).toBeGreaterThanOrEqual(8);
  });

  it('offers 2+ free layouts and 30 stamps (R-08)', () => {
    expect(manifest.layouts.filter(({ tier }) => tier === 'free').length).toBeGreaterThanOrEqual(2);
    expect(manifest.stamps.length).toBeGreaterThanOrEqual(30);
  });

  it('bundles every built-in asset', () => {
    const source = readFileSync(
      join(import.meta.dirname, '..', 'src', 'bundled-assets.ts'),
      'utf8',
    );
    for (const { path } of findAssetRefs(raw)) {
      expect(source, path).toContain(`'${path}': require('../builtin/${path}')`);
    }
  });
});
