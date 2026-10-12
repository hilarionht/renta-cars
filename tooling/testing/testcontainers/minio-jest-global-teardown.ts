import { stopRegisteredContainer } from './container-registry';

export default async function globalTeardown(): Promise<void> {
  await stopRegisteredContainer('minio');
}
