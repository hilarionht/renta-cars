// Verificado contra libs/platform/files/infrastructure/src/http/{files.controller.ts,dto/*}.
// ConfirmUploadResponse.id (no storageRef/fileId) - confirmado leyendo
// FilesController.confirm() directo: `return { id: id.toString() };`.
export interface RequestUploadUrlRequest {
  contentType: string;
}

export interface RequestUploadUrlResponse {
  storageRef: string;
  uploadUrl: string;
  expiresAt: string;
}

export interface ConfirmUploadRequest {
  storageRef: string;
  contentType: string;
}

export interface ConfirmUploadResponse {
  id: string;
}
