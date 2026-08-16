export default {
  displayName: 'platform-audit-infrastructure',
  preset: '../../../../tooling/jest/base.config.ts',
  testEnvironment: 'node',
  testMatch: ['**/*.integration.spec.ts'],
  globalSetup: '../../../../tooling/testing/testcontainers/jest-global-setup.ts',
  globalTeardown: '../../../../tooling/testing/testcontainers/jest-global-teardown.ts',
  testTimeout: 60000,
  passWithNoTests: true,
};
