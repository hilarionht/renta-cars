import { ConcurrentModificationError, type DomainErrorEntries } from '@platform/shared-kernel';
import {
  FileAlreadyConfirmedError,
  FileAlreadyDeletedError,
  FileNotFoundError,
  FileTooLargeError,
  StorageObjectNotFoundError,
  UnsupportedContentTypeError,
} from '@platform/files/domain';

export const FILES_DOMAIN_ERROR_ENTRIES: DomainErrorEntries = [
  [
    UnsupportedContentTypeError,
    { status: 422, code: 'UNSUPPORTED_CONTENT_TYPE', title: 'Tipo de contenido no soportado' },
  ],
  [
    FileTooLargeError,
    { status: 422, code: 'FILE_TOO_LARGE', title: 'Archivo excede el tamano maximo permitido' },
  ],
  [
    StorageObjectNotFoundError,
    { status: 422, code: 'STORAGE_OBJECT_NOT_FOUND', title: 'El objeto no existe en storage' },
  ],
  [
    FileAlreadyDeletedError,
    { status: 409, code: 'FILE_ALREADY_DELETED', title: 'El archivo ya fue eliminado' },
  ],
  [
    FileAlreadyConfirmedError,
    { status: 409, code: 'FILE_ALREADY_CONFIRMED', title: 'El archivo ya fue confirmado' },
  ],
  [FileNotFoundError, { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'File no encontrado' }],
  [
    ConcurrentModificationError,
    { status: 409, code: 'CONCURRENT_MODIFICATION', title: 'Modificacion concurrente' },
  ],
];
