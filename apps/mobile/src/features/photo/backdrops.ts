import type { SheetPattern } from '@fant/content-schema';

/**
 * A background that replaces what is behind the people: in a puri shot (PRI-04) or
 * in the editor (EDT-16).
 */
export interface Backdrop {
  readonly id: string;
  /** Shown on the chip. */
  readonly emoji: string;
  readonly color: string;
  /** Top to bottom, evenly spaced unless `stops` says where; over `color`. */
  readonly gradient?: readonly string[];
  readonly stops?: readonly number[];
  readonly pattern: SheetPattern;
  readonly patternColor: string;
  /** Scattered small stars in `patternColor`, for a night sky. */
  readonly stars?: boolean;
}

/** Plain pastels and Heisei-style patterns in the app's palette, then scenery. */
export const BACKDROPS: readonly Backdrop[] = [
  { id: 'pink', emoji: '🩷', color: '#ffd1e6', pattern: 'plain', patternColor: '#ffffff' },
  { id: 'dots', emoji: '🫧', color: '#eee6ff', pattern: 'dots', patternColor: '#ffffff' },
  { id: 'hearts', emoji: '💕', color: '#ffe4f1', pattern: 'hearts', patternColor: '#ff7bb8' },
  { id: 'checker', emoji: '🏁', color: '#ddf6ef', pattern: 'checker', patternColor: '#ffffff' },
  { id: 'heisei', emoji: '🌈', color: '#ffe27a', pattern: 'stripes', patternColor: '#ff9ccf' },
  {
    id: 'sky',
    emoji: '🌤️',
    color: '#8fd0ff',
    gradient: ['#4ea8f0', '#9fd4ff', '#eef8ff'],
    pattern: 'plain',
    patternColor: '#ffffff',
  },
  {
    id: 'sunset',
    emoji: '🌇',
    color: '#f08a7a',
    gradient: ['#4b3488', '#d85c8e', '#ff9f6b', '#ffe0a3'],
    pattern: 'plain',
    patternColor: '#ffffff',
  },
  {
    id: 'sea',
    emoji: '🏖️',
    color: '#6cc0f0',
    gradient: ['#7cc8f8', '#e3f5ff', '#4aa8dc', '#1c6ea8'],
    stops: [0, 0.55, 0.56, 1],
    pattern: 'plain',
    patternColor: '#ffffff',
  },
  {
    id: 'starry',
    emoji: '🌌',
    color: '#1b1850',
    gradient: ['#0b1236', '#2a1c5e', '#5a2f7a'],
    pattern: 'plain',
    patternColor: '#fff4c4',
    stars: true,
  },
];

/** Backdrops that make a believable sky (EDT-25). */
export const SKY_BACKDROP_IDS = ['sky', 'sunset', 'starry'] as const;

/** A backdrop by its ID, or `null` for none or one this version does not have. */
export function findBackdrop(id: string | null): Backdrop | null {
  return BACKDROPS.find((backdrop) => backdrop.id === id) ?? null;
}
