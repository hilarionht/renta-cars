// docs/06-CONVENCIONES-FRONTEND.md SS6. Orquesta las 3 llamadas reales del flujo de subida
// (libs/platform/files/infrastructure/src/http/files.controller.ts): pedir URL firmada,
// subir el binario directo a esa URL (MinIO/S3, no pasa por apps/api), confirmar. Devuelve
// el id de archivo listo para photoFileIds. CORS no aplica (React Native fetch no lo
// enforce, a diferencia de un browser) - sin configuracion adicional de MinIO necesaria.
import { useMutation } from '@tanstack/react-query';

import type { RequestUploadUrlResponse, ConfirmUploadResponse } from '@frontend/domain-types';

import { apiRequest } from '../auth/api-client';

async function uploadPhoto(localUri: string): Promise<string> {
  const contentType = 'image/jpeg';

  const { storageRef, uploadUrl } = await apiRequest<RequestUploadUrlResponse>(
    '/api/v1/files/upload-url',
    { method: 'POST', body: { contentType } },
  );

  const photoBlob = await (await fetch(localUri)).blob();
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: photoBlob,
  });
  if (!uploadResponse.ok) {
    throw new Error(`No se pudo subir la foto a storage: HTTP ${uploadResponse.status}`);
  }

  const { id } = await apiRequest<ConfirmUploadResponse>('/api/v1/files/confirm-upload', {
    method: 'POST',
    body: { storageRef, contentType },
  });
  return id;
}

export function useUploadPhoto() {
  return useMutation({ mutationFn: uploadPhoto });
}
