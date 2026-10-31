import { describe, expect, it } from 'vitest';

import {
  assetRefSchema,
  characterSchema,
  filmSchema,
  isAvailable,
  isNew,
  layoutSchema,
  mergeManifests,
  parseManifest,
  resolveFilmParams,
  type Film,
  type Manifest,
} from './index';

const SHA = 'a'.repeat(64);

const FILM: Film = {
  id: 'test_film',
  version: 1,
  name: { ja: 'テスト' },
  tier: 'free',
  pipeline: 'film_v1',
  params: { warmth: 0.2, grain: 0.1 },
  lightLeak: { probability: 0.5, opacity: [0.2, 0.6] },
  dateStampByDefault: true,
};

const EMPTY: Manifest = {
  schemaVersion: 1,
  films: [],
  characters: [],
  layouts: [],
  stamps: [],
  phrases: [],
  aiStyles: [],
};

describe('assetRefSchema', () => {
  it('accepts a relative lowercase path with a hash', () => {
    expect(assetRefSchema.safeParse({ path: 'luts/ccd_2005.png', sha256: SHA }).success).toBe(true);
  });

  it.each([
    '../secret.png',
    '/etc/passwd.png',
    'luts/../x.png',
    'LUTS/A.png',
    'a.exe',
    'a b.png',
    '',
  ])('rejects the path %p', (path) => {
    expect(assetRefSchema.safeParse({ path, sha256: SHA }).success).toBe(false);
  });

  it('requires a SHA-256', () => {
    expect(assetRefSchema.safeParse({ path: 'a.png', sha256: 'abc' }).success).toBe(false);
  });
});

describe('filmSchema', () => {
  it('accepts a valid film', () => {
    expect(filmSchema.parse(FILM)).toEqual(FILM);
  });

  it('rejects unknown keys, out-of-range and per-shot parameters', () => {
    expect(filmSchema.safeParse({ ...FILM, extra: 1 }).success).toBe(false);
    expect(filmSchema.safeParse({ ...FILM, params: { grain: 2 } }).success).toBe(false);
    expect(filmSchema.safeParse({ ...FILM, params: { intensity: 0.5 } }).success).toBe(false);
    expect(filmSchema.safeParse({ ...FILM, params: { lightLeak: 0.5 } }).success).toBe(false);
  });

  it('rejects an unknown pipeline and an inverted opacity range', () => {
    expect(filmSchema.safeParse({ ...FILM, pipeline: 'film_v9' }).success).toBe(false);
    expect(
      filmSchema.safeParse({ ...FILM, lightLeak: { probability: 1, opacity: [0.8, 0.2] } }).success,
    ).toBe(false);
  });
});

describe('resolveFilmParams', () => {
  it('applies the user strength and keeps the film values', () => {
    const params = resolveFilmParams(FILM, { intensity: 0.4, seed: 0.1 });
    expect(params).toMatchObject({ intensity: 0.4, warmth: 0.2, grain: 0.1 });
  });

  it('gives the same shot the same light leak', () => {
    const a = resolveFilmParams(FILM, { intensity: 1, seed: 0.37 });
    expect(resolveFilmParams(FILM, { intensity: 1, seed: 0.37 }).lightLeak).toBe(a.lightLeak);
  });

  it('adds a leak to about `probability` of shots, within the opacity range', () => {
    const leaks = Array.from(
      { length: 400 },
      (_, i) => resolveFilmParams(FILM, { intensity: 1, seed: i / 400 }).lightLeak,
    );
    const withLeak = leaks.filter((value) => value > 0);
    expect(withLeak.length / leaks.length).toBeGreaterThan(0.35);
    expect(withLeak.length / leaks.length).toBeLessThan(0.65);
    expect(Math.min(...withLeak)).toBeGreaterThanOrEqual(0.2);
    expect(Math.max(...withLeak)).toBeLessThanOrEqual(0.6);
  });

  it('never adds a leak to a film without one', () => {
    const noLeak: Film = { ...FILM, lightLeak: undefined };
    expect(resolveFilmParams(noLeak, { intensity: 1, seed: 0.5 }).lightLeak).toBe(0);
  });
});

describe('characterSchema', () => {
  const character = {
    id: 'bear',
    version: 1,
    name: { ja: 'くま' },
    tier: 'free',
    parts: [
      {
        anchor: 'nose',
        art: { type: 'shape', shape: 'bear_nose', fill: 'primary' },
        offset: [0, 0],
        size: 0.3,
        rotation: 0,
        mirrored: false,
      },
    ],
    variants: [
      {
        id: 'brown',
        name: { ja: 'ブラウン' },
        colors: { primary: '#8b5a3c', secondary: '#3b2418', accent: '#ff9db0' },
      },
    ],
  };

  it('accepts a valid character', () => {
    expect(characterSchema.safeParse(character).success).toBe(true);
  });

  it('takes moving and 3D parts, within limits (CHR-08/09)', () => {
    const [part] = character.parts;
    const moving = {
      ...part,
      depth: 0.3,
      motion: { type: 'fall', count: 8, speed: 0.5, spread: 1.2 },
    };
    expect(characterSchema.safeParse({ ...character, parts: [moving] }).success).toBe(true);
    expect(
      characterSchema.safeParse({
        ...character,
        parts: [{ ...moving, motion: { ...moving.motion, count: 50 } }],
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate variants and malformed colours', () => {
    const variant = character.variants[0];
    expect(characterSchema.safeParse({ ...character, variants: [variant, variant] }).success).toBe(
      false,
    );
    expect(
      characterSchema.safeParse({
        ...character,
        variants: [
          { ...variant, colors: { primary: 'red', secondary: '#000000', accent: '#000000' } },
        ],
      }).success,
    ).toBe(false);
  });
});

describe('layoutSchema', () => {
  const layout = {
    id: 'two',
    version: 1,
    name: { ja: '2コマ' },
    tier: 'free',
    width: 1000,
    height: 1500,
    cells: [
      { x: 0, y: 0, width: 1, height: 0.5 },
      { x: 0, y: 0.5, width: 1, height: 0.5 },
    ],
    background: { color: '#ffffff', pattern: 'dots', patternColor: '#000000' },
    poses: [{ ja: 'ピース！' }],
  };

  it('accepts a valid layout and rejects a cell that overflows the sheet', () => {
    expect(layoutSchema.safeParse(layout).success).toBe(true);
    const overflowing = {
      ...layout,
      cells: [layout.cells[0], { x: 0.5, y: 0.5, width: 0.6, height: 0.5 }],
    };
    expect(layoutSchema.safeParse(overflowing).success).toBe(false);
  });
});

describe('parseManifest', () => {
  it('rejects duplicate IDs and a different schema version', () => {
    expect(() => parseManifest({ ...EMPTY, films: [FILM, FILM] })).toThrow();
    expect(() => parseManifest({ ...EMPTY, schemaVersion: 2 })).toThrow();
  });
});

describe('mergeManifests', () => {
  it('keeps built-in items and adds or upgrades remote ones by version', () => {
    const builtIn = { ...EMPTY, films: [FILM] };
    const older = { ...FILM, name: { ja: '古い' } };
    const newer = { ...FILM, version: 2, name: { ja: '新しい' } };
    const extra = { ...FILM, id: 'extra' };
    expect(mergeManifests(builtIn, { ...EMPTY, films: [older, extra] }).films).toEqual([
      FILM,
      extra,
    ]);
    expect(mergeManifests(builtIn, { ...EMPTY, films: [newer] }).films).toEqual([newer]);
    expect(mergeManifests(builtIn, null)).toBe(builtIn);
  });

  it('takes the remote config (ANL-03)', () => {
    const config = { features: { ai: false }, paywallLead: [{ ja: 'A' }, { ja: 'B' }] };
    expect(mergeManifests(EMPTY, { ...EMPTY, config }).config).toEqual(config);
    expect(mergeManifests(EMPTY, EMPTY).config).toBeUndefined();
  });

  it('rejects malformed config', () => {
    expect(() => parseManifest({ ...EMPTY, config: { features: { ai: 'no' } } })).toThrow();
    expect(() => parseManifest({ ...EMPTY, config: { paywallLead: [] } })).toThrow();
  });
});

describe('availability', () => {
  const seasonal = {
    availability: {
      publishedAt: '2026-12-01T00:00:00+09:00',
      availableUntil: '2026-12-26T00:00:00+09:00',
    },
  };

  it('is always available and never new without a window', () => {
    expect(isAvailable({}, new Date())).toBe(true);
    expect(isNew({}, new Date())).toBe(false);
  });

  it('respects the delivery window', () => {
    expect(isAvailable(seasonal, new Date('2026-11-30T12:00:00Z'))).toBe(false);
    expect(isAvailable(seasonal, new Date('2026-12-10T00:00:00Z'))).toBe(true);
    expect(isAvailable(seasonal, new Date('2026-12-26T00:00:00+09:00'))).toBe(false);
  });

  it('is new for two weeks after publication', () => {
    expect(isNew(seasonal, new Date('2026-12-05T00:00:00Z'))).toBe(true);
    expect(isNew(seasonal, new Date('2026-12-20T00:00:00Z'))).toBe(false);
  });
});
