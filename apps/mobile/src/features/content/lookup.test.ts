import { builtInManifest } from '@fant/content';
import { describe, expect, it } from 'vitest';

import { available, findCharacter, findFilm, stampMap } from './lookup';

const manifest = builtInManifest();

describe('content lookup', () => {
  it('finds a film or falls back to the first one', () => {
    expect(findFilm(manifest, 'mono').id).toBe('mono');
    expect(findFilm(manifest, 'gone').id).toBe(manifest.films[0]?.id);
  });

  it('finds a character and falls back to its first variant', () => {
    expect(findCharacter(manifest, 'cat', 'white')?.variant.id).toBe('white');
    expect(findCharacter(manifest, 'cat', 'missing')?.variant.id).toBe('black');
    expect(findCharacter(manifest, 'missing', undefined)).toBeNull();
  });

  it('indexes stamps by ID', () => {
    expect(stampMap(manifest).get('heart_pink')?.art.type).toBe('shape');
  });

  it('hides items outside their delivery window', () => {
    const items = [{ id: 'a' }, { id: 'b', availability: { publishedAt: '2099-01-01T00:00:00Z' } }];
    expect(available(items).map(({ id }) => id)).toEqual(['a']);
  });
});
