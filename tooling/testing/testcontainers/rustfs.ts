import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';

// Almacenamiento S3 compatible para tests: RustFS, la misma version que corre en local
// (docs/engineering/11-ENTORNO-LOCAL-NATIVO.md SS4.1). Reemplaza a MinIO, archivado y sin
// parches (docs/persistence/10-DECISIONES.md #138 y #143). Imagen oficial fijada por digest
// del indice multi-arquitectura (rustfs/rustfs:1.0.1): corre como usuario no root, datos en
// /data (RUSTFS_VOLUMES) y /health/ready responde cuando almacenamiento e IAM estan listos.
// No hay paquete Testcontainers dedicado: GenericContainer, igual que antes con MinIO.
const RUSTFS_IMAGE =
  'rustfs/rustfs@sha256:1803faef57627e2d9c2e7d89d655d712ddded5389040054987163043fecb6a3c';
const S3_PORT = 9000;
const ACCESS_KEY = 'renta-test';
const SECRET_KEY = 'renta-test-1234';
const BUCKET = 'renta-test';
const REGION = 'us-east-1';

export interface S3TestContainer {
  container: StartedTestContainer;
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
}

// El bucket se crea aca con el SDK (en docker-compose.yml lo hace el job `rustfs-init`): un
// contenedor efimero de test no tiene ese job.
export async function startRustfsContainer(): Promise<S3TestContainer> {
  const container = await new GenericContainer(RUSTFS_IMAGE)
    .withEnvironment({
      RUSTFS_ACCESS_KEY: ACCESS_KEY,
      RUSTFS_SECRET_KEY: SECRET_KEY,
      RUSTFS_REGION: REGION,
    })
    .withExposedPorts(S3_PORT)
    .withWaitStrategy(Wait.forHttp('/health/ready', S3_PORT))
    .start();

  // "127.0.0.1" explicito, mismo motivo que postgres.ts/redis.ts - evita la resolucion
  // ambigua de "localhost" (IPv6 primero) contra un puerto publicado por Docker
  // Desktop/Windows.
  const endpoint = `http://127.0.0.1:${container.getMappedPort(S3_PORT)}`;

  const client = new S3Client({
    endpoint,
    region: REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  });
  try {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET }));
  } finally {
    client.destroy();
  }

  return {
    container,
    endpoint,
    bucket: BUCKET,
    accessKey: ACCESS_KEY,
    secretKey: SECRET_KEY,
    region: REGION,
  };
}
