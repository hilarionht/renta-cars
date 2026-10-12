import { DomainError } from '@platform/shared-kernel';

// Medido con HeadObjectCommand (lo que storage realmente recibio), no un tamano declarado
// por el cliente - ver ConfirmUploadHandler y docs/persistence/10-DECISIONES.md.
export class FileTooLargeError extends DomainError {
  constructor(sizeBytes: number, maxBytes: number) {
    super(`El archivo (${sizeBytes} bytes) excede el tamano maximo permitido (${maxBytes} bytes).`);
  }
}
