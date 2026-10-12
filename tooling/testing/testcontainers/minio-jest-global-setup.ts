import { registerContainer } from './container-registry';
import { startMinioContainer } from './minio';

// globalSetup dedicado (no el jest-global-setup.ts compartido de Postgres+Redis) - a
// diferencia de esos dos, MinIO hoy solo lo necesita un unico proyecto
// (platform-integration-providers-infrastructure), asi que no se justifica sumarlo al
// arranque de cada `*-infrastructure` que ya paga el costo de Postgres+Redis sin usarlo.
export default async function globalSetup(): Promise<void> {
  const minio = await startMinioContainer();
  registerContainer('minio', minio.container);
  process.env.TEST_STORAGE_ENDPOINT = minio.endpoint;
  process.env.TEST_STORAGE_BUCKET = minio.bucket;
  process.env.TEST_STORAGE_ACCESS_KEY = minio.accessKey;
  process.env.TEST_STORAGE_SECRET_KEY = minio.secretKey;
  process.env.TEST_STORAGE_REGION = minio.region;
}
