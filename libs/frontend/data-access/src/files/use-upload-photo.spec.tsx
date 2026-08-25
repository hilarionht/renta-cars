import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { apiRequest } from '../auth/api-client';
import { useUploadPhoto } from './use-upload-photo';

jest.mock('../auth/api-client', () => ({ apiRequest: jest.fn() }));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useUploadPhoto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('orquesta upload-url -> PUT al storage -> confirm-upload, devuelve el id', async () => {
    (apiRequest as jest.Mock)
      .mockResolvedValueOnce({
        storageRef: 'ref-1',
        uploadUrl: 'https://storage.test/put',
        expiresAt: '2026-01-01T00:00:00Z',
      })
      .mockResolvedValueOnce({ id: 'file-1' });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ blob: () => Promise.resolve(new Blob(['photo'])) })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const { result } = renderHook(() => useUploadPhoto(), { wrapper });
    result.current.mutate('file:///local/photo.jpg');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('file-1');
    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/v1/files/upload-url', {
      method: 'POST',
      body: { contentType: 'image/jpeg' },
    });
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://storage.test/put',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/v1/files/confirm-upload', {
      method: 'POST',
      body: { storageRef: 'ref-1', contentType: 'image/jpeg' },
    });
  });

  it('si el PUT al storage falla, la mutation falla y nunca llama a confirm-upload', async () => {
    (apiRequest as jest.Mock).mockResolvedValueOnce({
      storageRef: 'ref-1',
      uploadUrl: 'https://storage.test/put',
      expiresAt: '2026-01-01T00:00:00Z',
    });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ blob: () => Promise.resolve(new Blob(['photo'])) })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    const { result } = renderHook(() => useUploadPhoto(), { wrapper });
    result.current.mutate('file:///local/photo.jpg');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
});
