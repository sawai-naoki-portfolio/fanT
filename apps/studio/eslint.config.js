import { typescriptConfig } from '@fant/config/eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/'] },
  ...typescriptConfig({ tsconfigRootDir: import.meta.dirname }),
  reactHooks.configs.flat.recommended,
];
