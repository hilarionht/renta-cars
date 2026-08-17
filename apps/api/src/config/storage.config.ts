import { registerAs } from '@nestjs/config';

const DEFAULT_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

// Namespace "storage" (MinIO/S3, StorageProviderPort). Consumido por
// S3StorageProviderAdapter (platform-integration-providers-infrastructure) y por
// FilesModule (STORAGE_LIMITS, docs/persistence/10-DECISIONES.md).
export default registerAs('storage', () => ({
  endpoint: process.env.STORAGE_ENDPOINT,
  bucket: process.env.STORAGE_BUCKET,
  accessKey: process.env.STORAGE_ACCESS_KEY,
  secretKey: process.env.STORAGE_SECRET_KEY,
  region: process.env.STORAGE_REGION,
  // Tope de tamano de subida - enforcement post-hoc en ConfirmUploadHandler (medido con
  // HeadObjectCommand, no declarado por el cliente). Default 20MB si no esta seteado.
  maxUploadBytes: process.env.STORAGE_MAX_UPLOAD_BYTES
    ? Number(process.env.STORAGE_MAX_UPLOAD_BYTES)
    : DEFAULT_MAX_UPLOAD_BYTES,
}));
