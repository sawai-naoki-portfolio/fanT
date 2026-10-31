import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Type-aware TypeScript rules shared by every workspace package.
 *
 * @param {{ tsconfigRootDir: string }} options Directory of the package's tsconfig.json.
 * @returns {import('eslint').Linter.Config[]}
 */
export function typescriptConfig({ tsconfigRootDir }) {
  return [
    js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir },
      },
    },
    {
      files: ['**/*.{js,mjs,cjs}'],
      ...tseslint.configs.disableTypeChecked,
    },
  ];
}
