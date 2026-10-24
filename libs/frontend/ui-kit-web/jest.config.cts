// docs/engineering/04-TESTING-FOUNDATION.md §1: frontend (ui-kit-*, data-access) usa
// @swc/jest (heredado del preset base) + testEnvironment jsdom. moduleFileExtensions/
// testMatch amplian el preset base (solo .ts/.js) con .tsx/.jsx - particularidad de
// proyecto frontend, no del preset compartido con backend (tooling/jest/base.config.ts).
//
// .cts (CommonJS), como ui-kit-mobile y apps/mobile (docs/persistence/10-DECISIONES.md #149):
// con Node 24, un jest.config.ts con import/export se carga como modulo ES (Node ya entiende
// TypeScript) y ahi __dirname no existe.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { pathsToModuleNameMapper } from 'ts-jest';

// moduleNameMapper del proyecto REEMPLAZA (no combina) el del preset: se rearma aca el mapeo
// de aliases de tsconfig.base.json + el mock de CSS Modules (docs/persistence/
// 10-DECISIONES.md #134), mismo patron que apps/mobile/jest.config.cts.
const repoRoot = join(__dirname, '..', '..', '..');
const tsconfig = JSON.parse(readFileSync(join(repoRoot, 'tsconfig.base.json'), 'utf-8')) as {
  compilerOptions: { paths: Record<string, string[]> };
};

module.exports = {
  displayName: 'frontend-ui-kit-web',
  preset: '../../../tooling/jest/base.config.ts',
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/*.spec.[jt]s?(x)', '**/*.test.[jt]s?(x)'],
  setupFilesAfterEnv: ['../../../tooling/jest/jsdom-setup.ts'],
  moduleNameMapper: {
    '\.module\.css$': '<rootDir>/src/testing/css-module.mock.ts',
    ...pathsToModuleNameMapper(tsconfig.compilerOptions.paths, { prefix: `${repoRoot}/` }),
  },
  // @swc/jest no lee `jsx: "react-jsx"` de tsconfig.json por si solo - sin este runtime
  // explicito, JSX se transforma al runtime clasico (`React.createElement`, exige `React`
  // en scope), verificado con un componente de prueba durante el bootstrap del paso 13.
  transform: {
    '^.+\.[tj]sx?$': ['@swc/jest', { jsc: { transform: { react: { runtime: 'automatic' } } } }],
  },
  passWithNoTests: true,
};
