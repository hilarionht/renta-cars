// Ayuda de DESARROLLO (docs/persistence/10-DECISIONES.md #138): prepara el almacenamiento S3
// local (RustFS nativo, docs/engineering/11-ENTORNO-LOCAL-NATIVO.md) para la subida de
// archivos desde la web de administracion. Idempotente:
//   1. crea el bucket STORAGE_BUCKET si no existe;
//   2. fija la regla CORS que el navegador necesita para el PUT directo a la URL firmada
//      (preflight: application/pdf e image/* no son "safelisted"). Mobile no la necesita.
//
// Uso: npm run dev:storage-setup   (con RustFS corriendo en STORAGE_ENDPOINT)

import { config as loadEnv } from 'dotenv';
import {
  CreateBucketCommand,
  GetBucketCorsCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  S3Client,
} from '@aws-sdk/client-s3';

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
  const client = new S3Client({
    endpoint: required('STORAGE_ENDPOINT'),
    region: required('STORAGE_REGION'),
    forcePathStyle: true,
    credentials: {
      accessKeyId: required('STORAGE_ACCESS_KEY'),
      secretAccessKey: required('STORAGE_SECRET_KEY'),
    },
  });

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`Bucket ${bucket}: ya existia.`);
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`Bucket ${bucket}: creado.`);
  }

  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [WEB_ADMIN_ORIGIN],
            AllowedMethods: ['PUT', 'GET'],
            AllowedHeaders: ['Content-Type'],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    }),
  );
  const cors = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
  console.log(`CORS de ${bucket}: ${JSON.stringify(cors.CORSRules)}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
