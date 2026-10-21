import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  S3Client,
} from '@aws-sdk/client-s3';

export interface BucketCorsOptions {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  // Origenes de la web que suben archivos con PUT directo a la URL firmada.
  origins: string[];
}

// docs/persistence/10-DECISIONES.md #138 y #148. Idempotente: crea el bucket si no existe y fija
// la regla CORS que el navegador necesita para el PUT directo (preflight: application/pdf e
// image/* no son "safelisted"). Lo usan `npm run dev:storage-setup` y el e2e de la web.
// Devuelve si el bucket se creo.
export async function ensureBucketWithWebCors(options: BucketCorsOptions): Promise<boolean> {
  const client = new S3Client({
    endpoint: options.endpoint,
    region: options.region,
    forcePathStyle: true,
    credentials: { accessKeyId: options.accessKey, secretAccessKey: options.secretKey },
  });
  try {
    let created = false;
    try {
      await client.send(new HeadBucketCommand({ Bucket: options.bucket }));
    } catch {
      await client.send(new CreateBucketCommand({ Bucket: options.bucket }));
      created = true;
    }
    await client.send(
      new PutBucketCorsCommand({
        Bucket: options.bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: options.origins,
              AllowedMethods: ['PUT', 'GET'],
              AllowedHeaders: ['Content-Type'],
              MaxAgeSeconds: 3000,
            },
          ],
        },
      }),
    );
    return created;
  } finally {
    client.destroy();
  }
}
