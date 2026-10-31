import { filmSchema, type AssetRef, type Film, type Tier } from '@fant/content-schema';
import { FILM_PARAM_RANGES, type FilmParamName } from '@fant/filters';

/** Parameters a film defines; strength and the light leak are chosen per shot. */
export type DefinedParam = Exclude<FilmParamName, 'intensity' | 'lightLeak'>;

export const DEFINED_PARAMS = (Object.keys(FILM_PARAM_RANGES) as FilmParamName[]).filter(
  (name): name is DefinedParam => name !== 'intensity' && name !== 'lightLeak',
);

/** The studio's editable form of a film (STU-02). */
export interface FilmDraft {
  readonly id: string;
  readonly version: number;
  readonly nameJa: string;
  readonly nameEn: string;
  readonly tier: Tier;
  readonly params: Readonly<Record<DefinedParam, number>>;
  readonly leakProbability: number;
  readonly leakMin: number;
  readonly leakMax: number;
  readonly dateStampByDefault: boolean;
}

export const NEW_DRAFT: FilmDraft = {
  id: 'new_film',
  version: 1,
  nameJa: '新しいフィルム',
  nameEn: '',
  tier: 'premium',
  params: Object.fromEntries(
    DEFINED_PARAMS.map((name) => [name, FILM_PARAM_RANGES[name].defaultValue]),
  ) as Record<DefinedParam, number>,
  leakProbability: 0,
  leakMin: 0.2,
  leakMax: 0.5,
  dateStampByDefault: false,
};

/** Loads an existing film to edit (e.g. one from content/). */
export function draftFromFilm(film: Film): FilmDraft {
  return {
    id: film.id,
    version: film.version,
    nameJa: film.name.ja,
    nameEn: film.name.en ?? '',
    tier: film.tier,
    params: { ...NEW_DRAFT.params, ...film.params },
    leakProbability: film.lightLeak?.probability ?? 0,
    leakMin: film.lightLeak?.opacity[0] ?? NEW_DRAFT.leakMin,
    leakMax: film.lightLeak?.opacity[1] ?? NEW_DRAFT.leakMax,
    dateStampByDefault: film.dateStampByDefault,
  };
}

/**
 * The film JSON for content/ (STU-04), checked with the same schema the app and
 * CI use. Every parameter is written out, so a film keeps its look even if the
 * app's defaults change later.
 */
export function filmFromDraft(draft: FilmDraft, lut: AssetRef | null): Film {
  const params = Object.fromEntries(
    DEFINED_PARAMS.map((name) => [name, Math.round(draft.params[name] * 1000) / 1000]),
  );
  return filmSchema.parse({
    id: draft.id,
    version: draft.version,
    name:
      draft.nameEn.trim() === '' ? { ja: draft.nameJa } : { ja: draft.nameJa, en: draft.nameEn },
    tier: draft.tier,
    pipeline: 'film_v1',
    ...(lut === null ? {} : { lut }),
    params,
    ...(draft.leakProbability > 0
      ? {
          lightLeak: {
            probability: draft.leakProbability,
            opacity: [draft.leakMin, draft.leakMax],
          },
        }
      : {}),
    dateStampByDefault: draft.dateStampByDefault,
  });
}
