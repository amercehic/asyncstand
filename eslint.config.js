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
  // Load config from your old .eslintrc.js
  ...compat.extends(
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ),

  // Parser & globals
  {
    ignores: ['node_modules', 'dist'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: ['./tsconfig.json'] },
      globals: { NodeJS: 'readonly' },
    },
  },

  // Frontend overrides
  {
    files: ['apps/frontend/**/*.{ts,tsx}'],
    rules: {},
    languageOptions: {
      globals: { window: 'readonly', document: 'readonly' },
    },
    plugins: { react: react, 'react-hooks': reactHooks },
    settings: { react: { version: '18.0' } },
  },

  // Backend & Worker overrides
  {
    files: ['apps/backend/src/**/*.ts', 'apps/worker/src/**/*.ts'],
    plugins: { nestjs: nestjs },
    rules: {},
  },
];
