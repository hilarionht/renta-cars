// Configuracion unica de docs/engineering/03-CODE-QUALITY.md SS1: cada proyecto la hereda
// sin excepcion via su propio eslint.config.mjs (`export default [...sharedConfig]`).
// No se edita a mano por proyecto - un generador de tooling/generators/* la referencia
// por defecto (SS1, ultimo parrafo).

import nx from '@nx/eslint-plugin';

import { baseConfig } from './base.mjs';
import { boundariesConfig } from './boundaries.mjs';

/** @type {import('eslint').Linter.Config[]} */
export const sharedConfig = [
  // Ignores globales aqui (no solo en el eslint.config.mjs raiz): `nx run <proyecto>:lint`
  // corre `eslint .` acotado a la carpeta del proyecto, usando el eslint.config.mjs propio
  // de ese proyecto (que reexporta sharedConfig) - el `ignores` del raiz nunca se evalua
  // en ese caso.
  { ignores: ['**/dist', '**/coverage', '**/.next', '**/.expo'] },
  ...nx.configs['flat/base'],
  ...baseConfig,
  ...boundariesConfig,
];

export { domainLayerRestrictions } from './domain-restrictions.mjs';
export { ALL_MODULES, PLATFORM_MODULES, RENTAL_MODULES } from './modules.mjs';

export default sharedConfig;
