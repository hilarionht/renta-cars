export default {
  displayName: 'platform-integration-providers-infrastructure',
  preset: '../../../../tooling/jest/base.config.ts',
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  // MinIO, no el par Postgres+Redis del preset compartido de otros *-infrastructure - este
  // proyecto no toca Postgres en absoluto (ver tooling/testing/testcontainers/
  // minio-jest-global-setup.ts).
  globalSetup: '../../../../tooling/testing/testcontainers/minio-jest-global-setup.ts',
  globalTeardown: '../../../../tooling/testing/testcontainers/minio-jest-global-teardown.ts',
  testTimeout: 60000,
  passWithNoTests: true,
};
