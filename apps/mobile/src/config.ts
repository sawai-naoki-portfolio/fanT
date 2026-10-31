import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { parseExtra } from './config-schema';

/**
 * Build-time configuration from app.config.ts. Invalid configuration fails at
 * startup, so a broken build is caught on the first launch instead of in a feature.
 */
const extra = parseExtra(Constants.expoConfig?.extra);

export const APP_CONFIG = {
  appVariant: extra.appVariant,
  /** Development and preview builds: measurement tools and developer switches. */
  isInternalBuild: extra.appVariant !== 'production',
  /** Where the content manifest and assets are served from (CNT-01); `null` = built-in only. */
  contentBaseUrl: extra.contentBaseUrl,
  /** AI generation and credits (AI-04); `null` disables the AI mode. */
  apiBaseUrl: extra.apiBaseUrl,
  /** RevenueCat public SDK key for this platform; `null` disables purchases. */
  revenueCatApiKey:
    Platform.OS === 'ios' ? extra.revenueCatApiKey.ios : extra.revenueCatApiKey.android,
  supportEmail: extra.supportEmail,
  /** Facebook App ID for Instagram Stories sharing (SHR-03); `null` hides it. */
  facebookAppId: extra.facebookAppId,
  appVersion: Constants.expoConfig?.version ?? '0.0.0',
} as const;
