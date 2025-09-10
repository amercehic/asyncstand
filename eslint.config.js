import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import nestjs from 'eslint-plugin-nestjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  // Base configs
  ...compat.extends(
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ),

  // Parser & globals + ban of "../" imports
  {
    ignores: ['node_modules', 'dist', '**/*.d.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: ['./tsconfig.json'] },
      globals: { NodeJS: 'readonly' },
    },
    rules: {
      // Disallow any parent‑directory imports; enforce use of "@…" aliases only
      'no-restricted-imports': [
        'error',
        {
          patterns: ['../*', './*'],
        },
      ],
    },
  },

  // Shared package overrides - allow relative imports
  {
    files: ['packages/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  // Frontend overrides
  {
    files: ['apps/frontend/**/*.{ts,tsx}'],
    plugins: { react: react, 'react-hooks': reactHooks },
    rules: {},
    languageOptions: {
      globals: { window: 'readonly', document: 'readonly' },
    },
    settings: {
      react: { version: '18.0' },
    },
  },

  // E2E tests overrides - allow relative imports for test organization
  {
    files: ['apps/frontend/src/e2e/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
      'no-console': 'off', // Allow console.log in E2E tests
    },
  },

  // Backend & Worker overrides
  {
    files: ['apps/backend/src/**/*.ts', 'apps/worker/src/**/*.ts'],
    plugins: { nestjs: nestjs },
    rules: {
      // Prevent console usage
      'no-console': 'error',
      // Prevent console methods specifically
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.object.name="console"]',
          message: 'Console methods are not allowed. Use the LoggerService instead.',
        },
      ],
      // Catch unused variables and imports
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  // Feature seeds overrides - allow console for seed scripts
  {
    files: ['apps/backend/src/features/seeds/**/*.ts'],
    rules: {
      'no-console': 'off',
      'no-restricted-syntax': 'off',
    },
  },

  // Feature system overrides - allow imports to shared feature constants
  {
    files: ['apps/backend/src/features/**/*.ts', 'apps/backend/scripts/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
