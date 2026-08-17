import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';

// Misma imagen que docker-compose.yml (paso 5) - no hay paquete Testcontainers dedicado
// para MinIO (a diferencia de @testcontainers/postgresql / @testcontainers/redis), asi que
// se usa el GenericContainer generico ya presente como dependencia directa (testcontainers).
const MINIO_IMAGE = 'minio/minio';
const MINIO_PORT = 9000;
const ROOT_USER = 'renta-test';
const ROOT_PASSWORD = 'renta-test-1234';
const BUCKET = 'renta-test';
const REGION = 'us-east-1';

export interface MinioTestContainer {
  container: StartedTestContainer;
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
}

// docker-compose.yml crea el bucket por defecto via el job sidecar `minio-init` (`mc mb`) -
// un contenedor efimero de test no tiene ese sidecar, asi que el bucket se crea aca mismo
// con el SDK, antes de exponer el contenedor a los tests.
export async function startMinioContainer(): Promise<MinioTestContainer> {
  const container = await new GenericContainer(MINIO_IMAGE)
    .withCommand(['server', '/data'])
    .withEnvironment({ MINIO_ROOT_USER: ROOT_USER, MINIO_ROOT_PASSWORD: ROOT_PASSWORD })
    .withExposedPorts(MINIO_PORT)
    .withWaitStrategy(Wait.forHttp('/minio/health/live', MINIO_PORT))
    .start();

  // "127.0.0.1" explicito, mismo motivo que postgres.ts/redis.ts - evita la resolucion
  // ambigua de "localhost" (IPv6 primero) contra un puerto publicado por Docker
  // Desktop/Windows.
  const endpoint = `http://127.0.0.1:${container.getMappedPort(MINIO_PORT)}`;

  const client = new S3Client({
    endpoint,
    region: REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: ROOT_USER, secretAccessKey: ROOT_PASSWORD },
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
    accessKey: ROOT_USER,
    secretKey: ROOT_PASSWORD,
    region: REGION,
  };
}

export async function stopMinioContainer(instance: MinioTestContainer): Promise<void> {
  await instance.container.stop();
}
