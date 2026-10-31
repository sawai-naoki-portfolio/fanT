import { typescriptConfig } from '@fant/config/eslint';

export default [
  ...typescriptConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    rules: {
      // The worklets Babel plugin turns worklet function declarations into variables
      // that are not hoisted, and a worklet captures its helpers when the module loads,
      // so a helper used before its declaration is `undefined` on the camera thread.
      '@typescript-eslint/no-use-before-define': [
        'error',
        { functions: true, classes: true, variables: true },
      ],
    },
  },
];
