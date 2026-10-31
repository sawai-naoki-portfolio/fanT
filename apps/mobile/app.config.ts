import type { ExpoConfig } from 'expo/config';

import packageJson from './package.json';

/**
 * Placeholder application ID until the store listing is registered
 * (docs/requirements/06-open-issues.md, Q-01). Changing it after release is not possible.
 */
const BASE_APP_ID = 'com.fant.camera';

/** Build variants installable side by side; selected by EAS via `APP_VARIANT`. */
const VARIANTS = {
  development: { name: 'fanT (Dev)', suffix: 'dev' },
  preview: { name: 'fanT (Preview)', suffix: 'preview' },
  production: { name: 'fanT', suffix: null },
} as const;

type AppVariant = keyof typeof VARIANTS;

function resolveVariant(value: string | undefined): AppVariant {
  if (value === undefined) return 'development';
  if (Object.hasOwn(VARIANTS, value)) return value as AppVariant;
  throw new Error(
    `Unknown APP_VARIANT "${value}". Expected one of: ${Object.keys(VARIANTS).join(', ')}`,
  );
}

/** Optional HTTPS endpoints and keys, set per EAS profile; features without them stay off. */
function optionalHttpsUrl(name: string): string | null {
  const value = process.env[name];
  if (value === undefined || value === '') return null;
  if (!/^https:\/\/[^\s]+[^/]$/.test(value)) {
    throw new Error(`${name} must be an https URL without a trailing slash`);
  }
  return value;
}

function optional(name: string): string | null {
  const value = process.env[name];
  return value === undefined || value === '' ? null : value;
}

function optionalDigits(name: string): string | null {
  const value = optional(name);
  if (value !== null && !/^\d{5,20}$/.test(value)) throw new Error(`${name} must be digits`);
  return value;
}

/** Shown when the camera permission is requested (ONB-02). */
const CAMERA_USAGE = '写真を撮影するためにカメラを使用します。';
/** Shown when the microphone permission is requested for videos (CAM-13). */
const MICROPHONE_USAGE = '動画に音声を録音するためにマイクを使用します。';

const appVariant = resolveVariant(process.env.APP_VARIANT);
const { name, suffix } = VARIANTS[appVariant];
const appId = suffix ? `${BASE_APP_ID}.${suffix}` : BASE_APP_ID;

const config: ExpoConfig = {
  name,
  slug: 'fant',
  scheme: suffix ? `fant-${suffix}` : 'fant',
  version: packageJson.version,
  orientation: 'portrait',
  // Pastel UI on cream; the system UI follows the light style.
  userInterfaceStyle: 'light',
  backgroundColor: '#FFF6FB',
  // Permission texts per language (SET-05); the defaults below are the Japanese ones.
  locales: { ja: './locales/ja.json', en: './locales/en.json' },
  ios: {
    bundleIdentifier: appId,
    infoPlist: {
      // System texts follow the device language too, not only the app's own.
      CFBundleAllowMixedLocalizations: true,
      NSCameraUsageDescription: CAMERA_USAGE,
      NSMicrophoneUsageDescription: MICROPHONE_USAGE,
      // Lets the app check that Instagram can take a story (SHR-03).
      LSApplicationQueriesSchemes: ['instagram-stories'],
    },
  },
  android: {
    package: appId,
    // The microphone records sound with short videos (CAM-13).
    permissions: ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO'],
    blockedPermissions: [
      // Read access added by expo-media-library; saving with add-only access never uses it.
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
      // Draw-over-other-apps from the Expo template; the app has no overlays.
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
  },
  plugins: [
    'expo-router',
    [
      'expo-build-properties',
      {
        android: {
          // VisionCamera and Skia compile their HardwareBuffer frame paths only when minSdk >= 26.
          // Android 10 is the planned floor (docs/requirements/03-non-functional-requirements.md, Q-07).
          minSdkVersion: 29,
        },
      },
    ],
    'expo-sqlite',
    'expo-sharing',
    // Keys are stored without biometrics, so no Face ID prompt text is declared.
    ['expo-secure-store', { faceIDPermission: false }],
    'expo-image',
    [
      'expo-image-picker',
      {
        // The system photo picker needs no library permission. `false` for the camera
        // would block the camera permission for the whole app, so it gets the real text.
        photosPermission: false,
        cameraPermission: CAMERA_USAGE,
        microphonePermission: MICROPHONE_USAGE,
      },
    ],
    [
      'expo-media-library',
      {
        // Add-only access: the app saves photos but never reads the library.
        photosPermission: false,
        savePhotosPermission: '撮影した写真を保存するために使用します。',
        isAccessMediaLocationEnabled: false,
        granularPermissions: [],
      },
    ],
  ],
  experiments: { reactCompiler: true },
  // Read at runtime through expo-constants and validated in src/config.ts.
  extra: {
    appVariant,
    contentBaseUrl: optionalHttpsUrl('CONTENT_BASE_URL'),
    apiBaseUrl: optionalHttpsUrl('API_BASE_URL'),
    revenueCatApiKey: {
      ios: optional('REVENUECAT_IOS_API_KEY'),
      android: optional('REVENUECAT_ANDROID_API_KEY'),
    },
    supportEmail: optional('SUPPORT_EMAIL'),
    // Instagram Stories sharing needs the app's Facebook App ID (SHR-03); off without it.
    facebookAppId: optionalDigits('FACEBOOK_APP_ID'),
  },
};

export default config;
