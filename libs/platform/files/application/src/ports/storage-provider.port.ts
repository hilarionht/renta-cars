// Puerto de I/O externo (docs/ADR/0010-provider-pattern-integraciones.md) - definido junto
// al modulo consumidor (files), implementado en platform-integration-providers-infrastructure
// (S3StorageProviderAdapter). Ningun modulo de dominio conoce el SDK/proveedor concreto.
export const STORAGE_PROVIDER_PORT = Symbol('StorageProviderPort');

export interface RequestUploadUrlInput {
  companyId: string;
  contentType: string;
  uploadedBy: string;
}

export interface RequestUploadUrlResult {
  storageRef: string;
  uploadUrl: string;
  expiresAt: Date;
}

export interface VerifyUploadedObjectInput {
  storageRef: string;
}

export interface VerifyUploadedObjectResult {
  exists: boolean;
  sizeBytes?: number;
  contentType?: string;
}

export interface GetSignedUrlInput {
  storageRef: string;
}

export interface GetSignedUrlResult {
  url: string;
  expiresAt: Date;
}

export interface DeleteObjectInput {
  storageRef: string;
}

export interface StorageProviderPort {
  getUploadUrl(input: RequestUploadUrlInput): Promise<RequestUploadUrlResult>;
  // Reporta hechos medidos por storage (HEAD) - nunca crea un File ni decide pass/fail de
  // tamano, eso lo hace ConfirmUploadHandler.
  verifyUploadedObject(input: VerifyUploadedObjectInput): Promise<VerifyUploadedObjectResult>;
  getSignedUrl(input: GetSignedUrlInput): Promise<GetSignedUrlResult>;
  // Uso real hoy: limpieza best-effort de un objeto que ConfirmUpload rechazo por tamano
  // (docs/persistence/10-DECISIONES.md). DeleteFileHandler NO lo llama - la purga fisica es
  // una politica de retencion separada del ciclo de vida del agregado (docs/model/
  // 02-AGGREGATES.md SS15).
  deleteObject(input: DeleteObjectInput): Promise<void>;
}
