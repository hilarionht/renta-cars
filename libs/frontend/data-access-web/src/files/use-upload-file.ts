'use client';

import { useMutation } from '@tanstack/react-query';

import type { ConfirmUploadResponse, RequestUploadUrlResponse } from '@frontend/domain-types';

import { useWebAuth } from '../auth-context';

// docs/persistence/10-DECISIONES.md #137/#138: subida real de archivos desde la web, mismo flujo
// que mobile (libs/frontend/data-access/src/files/use-upload-photo.ts): pedir URL firmada ->
// PUT directo al almacenamiento (el binario no pasa por apps/api) -> confirmar.
//
// Diferencias con mobile: el navegador aplica CORS (el bucket necesita la regla de
// npm run dev:storage-setup) y CSP (connect-src incluye NEXT_PUBLIC_STORAGE_ORIGIN). El PUT es
// un fetch crudo, SIN Authorization: la URL firmada ya es la credencial.

// Espejo de libs/platform/files/domain/src/value-objects/content-type.ts y de
// STORAGE_MAX_UPLOAD_BYTES (20 MB). Se valida antes de subir para dar un error claro; el API
// vuelve a validar al confirmar.
export const UPLOAD_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;
export const UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadValidationError';
  }
}

export function validateUploadFile(file: File): void {
  if (!(UPLOAD_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    throw new UploadValidationError('Formato no permitido: usá PDF, JPG, PNG o WEBP.');
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    throw new UploadValidationError('El archivo supera los 20 MB.');
  }
}

/** Sube el archivo y devuelve el fileId confirmado. */
export function useUploadFile() {
  const { api } = useWebAuth();
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      validateUploadFile(file);
      const contentType = file.type;
      const { storageRef, uploadUrl } = await api.request<RequestUploadUrlResponse>(
        '/api/v1/files/upload-url',
        { method: 'POST', body: { contentType } },
      );
      const uploaded = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      });
      if (!uploaded.ok) {
        throw new Error(`No se pudo subir el archivo al almacenamiento (HTTP ${uploaded.status}).`);
      }
      const { id } = await api.request<ConfirmUploadResponse>('/api/v1/files/confirm-upload', {
        method: 'POST',
        body: { storageRef, contentType },
      });
      return id;
    },
  });
}

/** Pide una URL firmada de lectura (vida corta) para abrir un archivo. */
export function useFileSignedUrl() {
  const { api } = useWebAuth();
  return useMutation({
    mutationFn: async (fileId: string): Promise<string> => {
      const { url } = await api.request<{ url: string; expiresAt: string }>(
        `/api/v1/files/${fileId}/signed-url`,
      );
      return url;
    },
  });
}
