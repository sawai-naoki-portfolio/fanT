import type { Film } from '@fant/content-schema';
import { BEAUTY_LEVELS, DATE_STAMP_ORANGE, DEFAULT_FACE_SHAPE_PARAMS } from '@fant/filters';
import { describe, expect, it } from 'vitest';

import { filterSettingsFor, videoSettingsOf } from './filter-settings';

const FILM: Film = {
  id: 'test',
  version: 1,
  name: { ja: 'テスト' },
  tier: 'free',
  pipeline: 'film_v1',
  params: { warmth: 0.3, grain: 0.4, vignette: 0.5 },
  dateStampByDefault: true,
};

describe('videoSettingsOf (CAM-13)', () => {
  it('keeps only the film colour, as videos get it', () => {
    const photo = filterSettingsFor({
      film: FILM,
      intensity: 0.8,
      seed: 0.5,
      beauty: BEAUTY_LEVELS.high,
      faceShape: { ...DEFAULT_FACE_SHAPE_PARAMS, eyes: 0.5 },
      dateStamp: {
        date: { year: 2007, month: 7, day: 7 },
        format: 'yy mm dd',
        color: DATE_STAMP_ORANGE,
      },
    });
    const video = videoSettingsOf(photo);
    expect(video.film).toMatchObject({ warmth: 0.3, intensity: 0.8, grain: 0, vignette: 0 });
    expect(video.beauty).toEqual(BEAUTY_LEVELS.off);
    expect(video.faceShape).toEqual(DEFAULT_FACE_SHAPE_PARAMS);
    expect(video.dateStamp.glyphCount).toBe(0);
  });
});
