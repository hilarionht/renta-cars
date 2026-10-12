/// <reference types="jest" />
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathsToModuleNameMapper } from 'ts-jest';

// Mismo preset que apps/mobile/jest.config.cts (jest-expo, unica forma de correr tests de
// componentes React Native reales en este repo) - se duplica aca en vez de compartir un
// preset central porque ui-kit-mobile es la primera libreria (no app) que necesita este
// setup; centralizarlo en tooling/jest es un refactor aparte, no de esta tanda.
//
// moduleNameMapper para @frontend/* - a diferencia de tooling/jest/base.config.ts (el
// preset comun del resto del repo), jest-expo no conoce los "paths" de tsconfig.base.json
// por si solo. Mismo gap que ese archivo ya documenta para @platform/*, ejercitado aca por
// primera vez para @frontend/* porque este es el primer componente de ui-kit-mobile que
// importa otro proyecto de libs/frontend (ui-kit-core).
const repoRoot = join(__dirname, '..', '..', '..');
const tsconfig = JSON.parse(readFileSync(join(repoRoot, 'tsconfig.base.json'), 'utf-8')) as {
  compilerOptions: { paths: Record<string, string[]> };
};

module.exports = {
  displayName: 'frontend-ui-kit-mobile',
  preset: 'jest-expo',
  moduleFileExtensions: ['ts', 'js', 'html', 'tsx', 'jsx'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  moduleNameMapper: pathsToModuleNameMapper(tsconfig.compilerOptions.paths, {
    prefix: `${repoRoot}/`,
  }),
  transform: {
    '[.][jt]sx?$': [
      'babel-jest',
      {
        configFile: __dirname + '/.babelrc.js',
      },
    ],
  },
  coverageDirectory: '../../../coverage/libs/frontend/ui-kit-mobile',
};
