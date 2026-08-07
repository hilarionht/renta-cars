// Preset unico de Jest (docs/engineering/04-TESTING-FOUNDATION.md SS1), heredado por
// `preset` desde el jest.config.ts de cada proyecto que genera
// tooling/generators/bounded-context. @swc/jest: rapido, sin type-check en el propio test
// run (eso ya lo cubre `nx affected --target=typecheck`, paso 4/9). Las particularidades
// por tipo de proyecto (globalSetup/globalTeardown de Testcontainers para
// `infrastructure`, coverage para domain/application) se agregan en el jest.config.ts de
// cada proyecto, no aqui - este archivo es la base comun a todos los tipos.
export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['@swc/jest'],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
