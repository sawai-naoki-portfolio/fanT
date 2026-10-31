import { builtInManifest } from '@fant/content';
import { resolveFilmParams } from '@fant/content-schema';
import { describe, expect, it } from 'vitest';

import { draftFromFilm, filmFromDraft, NEW_DRAFT } from './film-draft';

describe('film drafts', () => {
  it('round-trips every built-in film to the same look', () => {
    for (const film of builtInManifest().films) {
      const exported = filmFromDraft(draftFromFilm(film), film.lut ?? null);
      expect({ ...exported, params: null }).toEqual({ ...film, params: null });
      for (const seed of [0.1, 0.5, 0.9]) {
        expect(resolveFilmParams(exported, { intensity: 1, seed })).toEqual(
          resolveFilmParams(film, { intensity: 1, seed }),
        );
      }
    }
  });

  it('exports a new film that passes the content schema', () => {
    const film = filmFromDraft({ ...NEW_DRAFT, leakProbability: 0.4 }, null);
    expect(film).toMatchObject({
      id: 'new_film',
      pipeline: 'film_v1',
      lightLeak: { probability: 0.4 },
    });
    expect(Object.keys(film.params)).toHaveLength(14);
  });

  it('rejects an invalid ID or inverted light leak range', () => {
    expect(() => filmFromDraft({ ...NEW_DRAFT, id: 'Bad ID' }, null)).toThrow();
    expect(() =>
      filmFromDraft({ ...NEW_DRAFT, leakProbability: 1, leakMin: 0.8, leakMax: 0.2 }, null),
    ).toThrow();
  });
});
