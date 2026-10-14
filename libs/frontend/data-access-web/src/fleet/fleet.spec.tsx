import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { ApiClient } from '@frontend/data-access-core';

import {
  UPLOAD_MAX_BYTES,
  UploadValidationError,
  useUploadFile,
  validateUploadFile,
} from '../files/use-upload-file';
import { vehicleActionPath } from './mutations';

const request = jest.fn();

jest.mock('../auth-context', () => ({
  useWebAuth: () => ({ api: { request } as unknown as ApiClient }),
}));

// docs/persistence/10-DECISIONES.md #137.
describe('vehicleActionPath', () => {
  it('arma la sub-ruta de cada accion', () => {
    expect(vehicleActionPath('v1', { action: 'enable' })).toBe('/api/v1/vehicles/v1/enable');
    expect(vehicleActionPath('v1', { action: 'verify-document', documentId: 'd1' })).toBe(
      '/api/v1/vehicles/v1/documents/d1/verify',
    );
    expect(vehicleActionPath('v1', { action: 'start-maintenance', maintenanceId: 'm1' })).toBe(
      '/api/v1/vehicles/v1/maintenance/m1/start',
    );
    expect(
      vehicleActionPath('v1', {
        action: 'complete-maintenance',
        maintenanceId: 'm1',
        body: { fitForService: true },
      }),
    ).toBe('/api/v1/vehicles/v1/maintenance/m1/complete');
    expect(vehicleActionPath('v1', { action: 'report-damage', body: { severity: 'Minor' } })).toBe(
      '/api/v1/vehicles/v1/report-damage',
    );
  });
});

describe('validateUploadFile', () => {
  it('acepta PDF e imagenes del allowlist', () => {
    expect(() =>
      validateUploadFile(new File(['x'], 'a.pdf', { type: 'application/pdf' })),
    ).not.toThrow();
  });

  it('rechaza un tipo fuera del allowlist', () => {
    expect(() =>
      validateUploadFile(new File(['x'], 'a.docx', { type: 'application/msword' })),
    ).toThrow(UploadValidationError);
  });

  it('rechaza un archivo de mas de 20 MB', () => {
    const big = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: UPLOAD_MAX_BYTES + 1 });
    expect(() => validateUploadFile(big)).toThrow(/20 MB/);
  });
});

describe('useUploadFile', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    request.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  function wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  it('pide la URL firmada, sube con PUT sin Authorization y confirma', async () => {
    request
      .mockResolvedValueOnce({
        storageRef: 'c1/ref',
        uploadUrl: 'http://storage/put',
        expiresAt: 'x',
      })
      .mockResolvedValueOnce({ id: 'file-1' });
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const file = new File(['%PDF'], 'poliza.pdf', { type: 'application/pdf' });
    const { result } = renderHook(() => useUploadFile(), { wrapper });

    let fileId = '';
    await act(async () => {
      fileId = await result.current.mutateAsync(file);
    });

    expect(fileId).toBe('file-1');
    expect(request).toHaveBeenNthCalledWith(1, '/api/v1/files/upload-url', {
      method: 'POST',
      body: { contentType: 'application/pdf' },
    });
    expect(fetchMock).toHaveBeenCalledWith('http://storage/put', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: file,
    });
    expect(request).toHaveBeenNthCalledWith(2, '/api/v1/files/confirm-upload', {
      method: 'POST',
      body: { storageRef: 'c1/ref', contentType: 'application/pdf' },
    });
  });

  it('si el PUT falla, no confirma', async () => {
    request.mockResolvedValueOnce({
      storageRef: 'r',
      uploadUrl: 'http://storage/put',
      expiresAt: 'x',
    });
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    const { result } = renderHook(() => useUploadFile(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync(new File(['x'], 'a.pdf', { type: 'application/pdf' })),
      ).rejects.toThrow(/403/);
    });

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('un archivo invalido no toca el API', async () => {
    const { result } = renderHook(() => useUploadFile(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync(new File(['x'], 'a.exe', { type: 'application/x-msdownload' })),
      ).rejects.toBeInstanceOf(UploadValidationError);
    });

    expect(request).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
