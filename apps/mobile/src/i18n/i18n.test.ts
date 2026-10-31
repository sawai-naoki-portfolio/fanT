import { describe, expect, it } from 'vitest';

import { en } from './en';
import { languageFor } from './index';
import { ja } from './ja';

describe('languageFor (SET-05)', () => {
  it('speaks Japanese on Japanese devices and English elsewhere', () => {
    expect(languageFor('ja-JP')).toBe('ja');
    expect(languageFor('ja')).toBe('ja');
    expect(languageFor('en-US')).toBe('en');
    expect(languageFor('ko-KR')).toBe('en');
  });
});

describe('dictionaries', () => {
  /** Every key path, so a key missing from one language fails here as well as in tsc. */
  const paths = (value: unknown, prefix = ''): string[] =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? Object.entries(value).flatMap(([key, child]) => paths(child, `${prefix}${key}.`))
      : [prefix];

  it('have the same keys in English and Japanese', () => {
    expect(paths(en)).toEqual(paths(ja));
  });

  it('format counts and lists for each language', () => {
    expect(en.album.deleteConfirm(1)).toBe('Delete 1 photo?');
    expect(en.common.list(['A', 'B'])).toBe('A, B');
    expect(ja.common.list(['A', 'B'])).toBe('A、B');
  });
});
