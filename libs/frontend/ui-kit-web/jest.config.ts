// docs/engineering/04-TESTING-FOUNDATION.md §1: frontend (ui-kit-*, data-access) usa
// @swc/jest (heredado del preset base) + testEnvironment jsdom. moduleFileExtensions/
// testMatch amplian el preset base (solo .ts/.js) con .tsx/.jsx - particularidad de
// proyecto frontend, no del preset compartido con backend (tooling/jest/base.config.ts).
export default {
  displayName: 'frontend-ui-kit-web',
  preset: '../../../tooling/jest/base.config.ts',
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/*.spec.[jt]s?(x)', '**/*.test.[jt]s?(x)'],
  setupFilesAfterEnv: ['../../../tooling/jest/jsdom-setup.ts'],
  // @swc/jest no lee `jsx: "react-jsx"` de tsconfig.json por si solo - sin este runtime
  // explicito, JSX se transforma al runtime clasico (`React.createElement`, exige `React`
  // en scope), verificado con un componente de prueba durante el bootstrap del paso 13.
  transform: {
    '^.+\\.[tj]sx?$': ['@swc/jest', { jsc: { transform: { react: { runtime: 'automatic' } } } }],
  },
  passWithNoTests: true,
};
