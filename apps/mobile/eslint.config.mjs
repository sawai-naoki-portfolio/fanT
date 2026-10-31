import { typescriptConfig } from '@fant/config/eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['.expo/', 'android/', 'ios/'] },
  ...typescriptConfig({ tsconfigRootDir: import.meta.dirname }),
  reactHooks.configs.flat.recommended,
  {
    // Build scripts run on Node.js.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly' } },
  },
  {
    // Camera and drawing libraries stay inside src/engine (03 §8), so upgrading them
    // touches one place.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/engine/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@shopify/react-native-skia',
                'react-native-vision-camera',
                'react-native-vision-camera-*',
                'react-native-worklets',
              ],
              message: 'Use these through src/engine.',
            },
          ],
        },
      ],
    },
  },
  {
    // The worklets Babel plugin turns worklet function declarations into variables that
    // are not hoisted, and a worklet captures its helpers when the module loads, so a
    // helper used before its declaration is `undefined` on the camera thread.
    files: ['**/*.worklet.ts'],
    rules: {
      '@typescript-eslint/no-use-before-define': [
        'error',
        { functions: true, classes: true, variables: true },
      ],
    },
  },
];
