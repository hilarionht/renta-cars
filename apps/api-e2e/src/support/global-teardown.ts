import { stopRegisteredContainer } from '../../../../tooling/testing/testcontainers/container-registry';
import { stopApiProcess } from './process-registry';

export default async function globalTeardown(): Promise<void> {
  stopApiProcess();
  await stopRegisteredContainer('api-e2e-postgres');
  await stopRegisteredContainer('api-e2e-redis');
}
