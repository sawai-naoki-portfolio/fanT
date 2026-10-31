/**
 * The app's look: Heisei-sweet pastels (pink, lavender, mint, lemon) on cream,
 * plum text, round shapes and soft pink shadows. Photos keep their own colours.
 */
export const colors = {
  /** Screen background. */
  background: '#FFF6FB',
  /** Cards, sheets and panels. */
  surface: '#FFFFFF',
  /** Unselected chips, tracks and placeholders. */
  surfaceRaised: '#FFE4F1',
  text: '#4A2A43',
  textMuted: '#A07E97',
  /** Text and icons drawn over photos or dark scrims. */
  onPhoto: '#FFFFFF',
  accent: '#FF5FA8',
  accentSoft: '#FFD1E6',
  accentText: '#FFFFFF',
  lavender: '#B79BFF',
  lavenderSoft: '#EEE6FF',
  mintSoft: '#DDF6EF',
  lemon: '#FFE27A',
  danger: '#FF5577',
  border: '#F8D3E6',
  /** Round buttons floating over the camera preview. */
  overlay: 'rgba(255, 255, 255, 0.82)',
  scrim: 'rgba(74, 42, 67, 0.55)',
  premium: '#FFB938',
} as const;

/** Pink → lavender, the app's signature gradient (primary buttons, shutter, selection). */
export const GRADIENT = ['#FF7BB8', '#C39BFF'] as const;
/** Lemon → pink, for premium and celebration. */
export const PREMIUM_GRADIENT = ['#FFD86B', '#FF8AC2'] as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 12, md: 18, lg: 28, pill: 999 } as const;

/** Minimum touch target (03 §9: 44pt / 48dp). */
export const TOUCH_TARGET = 48;

/** A soft pink glow under raised elements. */
export const softShadow = {
  shadowColor: '#FF5FA8',
  shadowOpacity: 0.22,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
} as const;
