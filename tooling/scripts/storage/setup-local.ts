// Ayuda de DESARROLLO (docs/persistence/10-DECISIONES.md #138): prepara el almacenamiento S3
// local (RustFS nativo, docs/engineering/11-ENTORNO-LOCAL-NATIVO.md) para la subida de
// archivos desde la web de administracion. Idempotente:
//   1. crea el bucket STORAGE_BUCKET si no existe;
//   2. fija la regla CORS que el navegador necesita para el PUT directo a la URL firmada
//      (preflight: application/pdf e image/* no son "safelisted"). Mobile no la necesita.
//
// Uso: npm run dev:storage-setup   (con RustFS corriendo en STORAGE_ENDPOINT)

import { config as loadEnv } from 'dotenv';
import { GetBucketCorsCommand, S3Client } from '@aws-sdk/client-s3';

import { ensureBucketWithWebCors } from '../../testing/storage/bucket-cors';

loadEnv();

const WEB_ADMIN_ORIGIN = process.env.WEB_ADMIN_ORIGIN ?? 'http://localhost:4200';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta ${name} en el .env`);
  }
  return value;
}

async function main(): Promise<void> {
  const bucket = required('STORAGE_BUCKET');
  const connection = {
    endpoint: required('STORAGE_ENDPOINT'),
    region: required('STORAGE_REGION'),
    accessKey: required('STORAGE_ACCESS_KEY'),
    secretKey: required('STORAGE_SECRET_KEY'),
  };
  // La logica vive en tooling/testing/storage/bucket-cors.ts (#148): la comparte el e2e de la web.
  const created = await ensureBucketWithWebCors({
    ...connection,
    bucket,
    origins: [WEB_ADMIN_ORIGIN],
  });
  console.log(`Bucket ${bucket}: ${created ? 'creado' : 'ya existia'}.`);

  const client = new S3Client({
    endpoint: connection.endpoint,
    region: connection.region,
    forcePathStyle: true,
    credentials: { accessKeyId: connection.accessKey, secretAccessKey: connection.secretKey },
  });
  try {
    const cors = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
    console.log(`CORS de ${bucket}: ${JSON.stringify(cors.CORSRules)}`);
  } finally {
    client.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
