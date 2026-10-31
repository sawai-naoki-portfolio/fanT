import { typescriptConfig } from '@fant/config/eslint';

export default [
  { ignores: ['dist/'] },
  ...typescriptConfig({ tsconfigRootDir: import.meta.dirname }),
];
