import { registerAs } from '@nestjs/config';

// Namespace "storage" (MinIO/S3, StorageProviderPort). Su consumidor de hoy es
// docker-compose.yml (credenciales del contenedor MinIO) - el modulo `files` que lo
// consumira desde NestJS llega en Fase 0+ (docs/01-ROADMAP.md).
export default registerAs('storage', () => ({
  endpoint: process.env.STORAGE_ENDPOINT,
  bucket: process.env.STORAGE_BUCKET,
  accessKey: process.env.STORAGE_ACCESS_KEY,
  secretKey: process.env.STORAGE_SECRET_KEY,
  region: process.env.STORAGE_REGION,
}));
