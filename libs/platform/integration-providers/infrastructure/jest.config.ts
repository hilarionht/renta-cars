export default {
  displayName: 'platform-integration-providers-infrastructure',
  preset: '../../../../tooling/jest/base.config.ts',
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  // Almacenamiento S3 (RustFS, #143), no el par Postgres+Redis del preset compartido de otros
  // *-infrastructure - este proyecto no toca Postgres en absoluto (ver tooling/testing/
  // testcontainers/s3-jest-global-setup.ts).
  globalSetup: '../../../../tooling/testing/testcontainers/s3-jest-global-setup.ts',
  globalTeardown: '../../../../tooling/testing/testcontainers/s3-jest-global-teardown.ts',
  testTimeout: 60000,
  passWithNoTests: true,
};
