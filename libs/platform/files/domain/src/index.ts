// Superficie publica de "platform-files-domain".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { File, type FileId, type FileProps } from './entities/file';
export {
  ContentType,
  ALLOWED_CONTENT_TYPES,
  type AllowedContentType,
} from './value-objects/content-type';
export { StorageRef } from './value-objects/storage-ref';
export type { UploadStatus } from './value-objects/upload-status';
export { UnsupportedContentTypeError } from './errors/unsupported-content-type.error';
export { FileTooLargeError } from './errors/file-too-large.error';
export { StorageObjectNotFoundError } from './errors/storage-object-not-found.error';
export { FileAlreadyDeletedError } from './errors/file-already-deleted.error';
export { FileAlreadyConfirmedError } from './errors/file-already-confirmed.error';
export { FileNotFoundError } from './errors/file-not-found.error';
export type { FileUploadedEvent } from './events/file-uploaded.event';
export type { FileDeletedEvent } from './events/file-deleted.event';
