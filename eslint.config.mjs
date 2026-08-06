// Config raiz: aplica la configuracion unica de tooling/eslint/ a todo el repo. Un
// proyecto Nx generado (paso 4) trae su propio eslint.config.mjs que reexporta
// tooling/eslint/index.mjs y agrega, si aplica, tooling/eslint/domain-restrictions.mjs.

import eslintConfigPrettier from 'eslint-config-prettier';

import { sharedConfig } from './tooling/eslint/index.mjs';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      '**/dist',
      '**/node_modules',
      '**/.nx',
      '**/coverage',
      '**/tmp',
      '**/.next',
      '**/.expo',
      'prisma/migrations/**',
    ],
  },
  ...sharedConfig,
  eslintConfigPrettier,
];
