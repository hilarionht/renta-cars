import { registerContainer } from './container-registry';
import { startRustfsContainer } from './rustfs';

// globalSetup dedicado (no el jest-global-setup.ts compartido de Postgres+Redis) - el
// almacenamiento S3 hoy solo lo necesita un unico proyecto
// (platform-integration-providers-infrastructure), asi que no se justifica sumarlo al
// arranque de cada `*-infrastructure` que ya paga el costo de Postgres+Redis sin usarlo.
export default async function globalSetup(): Promise<void> {
  const s3 = await startRustfsContainer();
  registerContainer('s3', s3.container);
  process.env.TEST_STORAGE_ENDPOINT = s3.endpoint;
  process.env.TEST_STORAGE_BUCKET = s3.bucket;
  process.env.TEST_STORAGE_ACCESS_KEY = s3.accessKey;
  process.env.TEST_STORAGE_SECRET_KEY = s3.secretKey;
  process.env.TEST_STORAGE_REGION = s3.region;
}
