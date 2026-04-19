// @ts-check
import js from '@eslint/js';
import { fixupPluginRules } from '@eslint/compat';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  // ── Ignore generated / build output ────────────────────────────────────────
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'next-env.d.ts',
      '*.config.js', // next.config.js, postcss.config.js, tailwind.config.js
    ],
  },

  // ── Base JS rules ───────────────────────────────────────────────────────────
  js.configs.recommended,

  // ── TypeScript: type-aware linting ─────────────────────────────────────────
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // ── Hooks flat config ───────────────────────────────────────────────────────
  reactHooksPlugin.configs.flat.recommended,

  // ── Project rules ───────────────────────────────────────────────────────────
  {
    plugins: {
      // fixupPluginRules shims the v7 plugin's deprecated context.getFilename()
      // calls so it works under ESLint v10's flat config.
      react: fixupPluginRules(reactPlugin),
      'jsx-a11y': jsxA11y,
      'simple-import-sort': simpleImportSort,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // React — spread recommended then override
      ...reactPlugin.configs.recommended.rules,
      // New JSX transform (React 17+): no 'react' import needed in scope
      ...reactPlugin.configs['jsx-runtime'].rules,
      'react/prop-types': 'off', // TypeScript handles this
      'react/display-name': 'off', // common with anonymous arrow components

      // Accessibility
      ...jsxA11y.configs.recommended.rules,
      // autofocus is good UX for modals/dialogs — downgrade from error to warn
      'jsx-a11y/no-autofocus': 'warn',

      // Import ordering
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',

      // TypeScript
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow void-returning async event handlers (common in React)
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      // Floating promises catch real bugs — prefix with void for intentional fire-and-forget
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
      // Prefer ?? over || for nullish checks
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      // Consistent type imports (import type { Foo })
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // better-sqlite3 types return `any` — downgrade to warn rather than blocking
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      // Sync SQLite ops inside async Next.js route handlers is the normal pattern here
      '@typescript-eslint/require-await': 'off',
    },
  },

  // ── Prettier must come last — disables all formatting rules ────────────────
  prettierConfig,
);
