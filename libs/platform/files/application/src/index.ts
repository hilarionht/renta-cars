// Superficie publica de "platform-files-application".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { FILE_REPOSITORY, type FileRepository } from './ports/file.repository';
export {
  STORAGE_PROVIDER_PORT,
  type StorageProviderPort,
  type RequestUploadUrlInput,
  type RequestUploadUrlResult,
  type VerifyUploadedObjectInput,
  type VerifyUploadedObjectResult,
  type GetSignedUrlInput,
  type GetSignedUrlResult,
  type DeleteObjectInput,
} from './ports/storage-provider.port';
export { STORAGE_LIMITS, type StorageLimits } from './ports/storage-limits';
export { RequestUploadUrlHandler } from './commands/request-upload-url/request-upload-url.handler';
export type { RequestUploadUrlCommand } from './commands/request-upload-url/request-upload-url.command';
export { ConfirmUploadHandler } from './commands/confirm-upload/confirm-upload.handler';
export type { ConfirmUploadCommand } from './commands/confirm-upload/confirm-upload.command';
export { DeleteFileHandler } from './commands/delete-file/delete-file.handler';
export type { DeleteFileCommand } from './commands/delete-file/delete-file.command';
export { GetSignedUrlHandler } from './commands/get-signed-url/get-signed-url.handler';
export type { GetSignedUrlCommand } from './commands/get-signed-url/get-signed-url.command';
