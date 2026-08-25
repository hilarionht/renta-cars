/// <reference types="jest" />
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathsToModuleNameMapper } from 'ts-jest';

// moduleNameMapper para @frontend/* - jest-expo no lee los "paths" de tsconfig.base.json
// por si solo, mismo gap que libs/frontend/ui-kit-mobile/jest.config.cts ya documenta,
// ejercitado aca por primera vez porque Fase 5 (docs/persistence/10-DECISIONES.md #108) es
// el primer consumidor real de @frontend/data-access/@frontend/ui-kit-mobile en apps/mobile.
const repoRoot = join(__dirname, '..', '..');
const tsconfig = JSON.parse(readFileSync(join(repoRoot, 'tsconfig.base.json'), 'utf-8')) as {
  compilerOptions: { paths: Record<string, string[]> };
};

module.exports = {
  displayName: 'mobile',
  preset: 'jest-expo',
  moduleFileExtensions: ['ts', 'js', 'html', 'tsx', 'jsx'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  moduleNameMapper: {
    '[.]svg$': '@nx/expo/plugins/jest/svg-mock',
    ...pathsToModuleNameMapper(tsconfig.compilerOptions.paths, { prefix: `${repoRoot}/` }),
  },
  transform: {
    '[.][jt]sx?$': [
      'babel-jest',
      {
        configFile: __dirname + '/.babelrc.js',
      },
    ],
    '^.+[.](bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp|ttf|otf|m4v|mov|mp4|mpeg|mpg|webm|aac|aiff|caf|m4a|mp3|wav|html|pdf|obj)$':
      require.resolve('jest-expo/src/preset/assetFileTransformer.js'),
  },
  coverageDirectory: '../../coverage/apps/mobile',
};
