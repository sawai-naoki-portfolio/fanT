import { z } from 'zod';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistValidated } from '../../lib/kv-storage';

/** What a wink does (GST-01/03). */
export const WINK_ACTIONS = ['nextFilm', 'nextBeauty', 'shutter', 'none'] as const;
export type WinkAction = (typeof WINK_ACTIONS)[number];

/** Days to keep originals (ALB-03); `null` keeps them. */
export const RETENTION_CHOICES = [30, 90, null] as const;

/** Export sizes (SHR-04): full resolution, or 2048 px on the long edge for social media. */
export const EXPORT_SIZES = ['full', 'sns'] as const;
export type ExportSize = (typeof EXPORT_SIZES)[number];

const settingsSchema = z.object({
  onboardingCompleted: z.boolean(),
  saveSize: z.enum(EXPORT_SIZES),
  /** Film-advance haptics on the shutter (CAM-11). */
  shutterFeedback: z.boolean(),
  /** Tapping the preview takes a photo instead of focusing (CAM-03). */
  tapToShoot: z.boolean(),
  originalRetentionDays: z.literal(RETENTION_CHOICES),
  winkGestures: z.object({
    enabled: z.boolean(),
    rightEye: z.enum(WINK_ACTIONS),
    leftEye: z.enum(WINK_ACTIONS),
  }),
  /** Consent version the user accepted for AI generation (AI-03); `null` = not yet. */
  aiConsentVersion: z.number().int().nullable(),
  /** Photos saved to the library, for asking for a review at a happy moment (ANL-04). */
  savedCount: z.number().int().min(0),
  reviewRequested: z.boolean(),
  /** Developer switch in internal builds: treat the user as premium without a store. */
  developerPremium: z.boolean(),
  /** Performance overlay in internal builds (P-1). */
  performanceOverlay: z.boolean(),
});

export type Settings = z.infer<typeof settingsSchema>;

const DEFAULT_SETTINGS: Settings = {
  onboardingCompleted: false,
  saveSize: 'full',
  shutterFeedback: true,
  tapToShoot: false,
  originalRetentionDays: 30,
  winkGestures: { enabled: true, rightEye: 'nextFilm', leftEye: 'nextBeauty' },
  aiConsentVersion: null,
  savedCount: 0,
  reviewRequested: false,
  developerPremium: false,
  performanceOverlay: true,
};

interface SettingsActions {
  readonly update: (patch: Partial<Settings>) => void;
}

export const useSettings = create<Settings & SettingsActions>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => {
        set(patch);
      },
    }),
    persistValidated<Settings & SettingsActions, typeof settingsSchema>('settings', settingsSchema),
  ),
);
