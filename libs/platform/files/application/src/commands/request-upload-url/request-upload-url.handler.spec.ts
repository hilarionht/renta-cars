import type { StorageProviderPort } from '../../ports/storage-provider.port';
import { RequestUploadUrlHandler } from './request-upload-url.handler';

function buildHandler() {
  const storageProvider: StorageProviderPort = {
    getUploadUrl: jest.fn().mockResolvedValue({
      storageRef: 'company-a/uuid-1',
      uploadUrl: 'https://storage.local/company-a/uuid-1?signed',
      expiresAt: new Date('2026-01-01T00:05:00.000Z'),
    }),
    verifyUploadedObject: jest.fn(),
    getSignedUrl: jest.fn(),
    deleteObject: jest.fn(),
  };

  const handler = new RequestUploadUrlHandler(storageProvider);

  return { handler, storageProvider };
}

describe('RequestUploadUrlHandler', () => {
  it('valida el contentType y delega en StorageProviderPort.getUploadUrl', async () => {
    const { handler, storageProvider } = buildHandler();

    const result = await handler.execute({
      companyId: 'company-a',
      uploadedBy: 'user-1',
      contentType: 'application/pdf',
    });

    expect(storageProvider.getUploadUrl).toHaveBeenCalledWith({
      companyId: 'company-a',
      contentType: 'application/pdf',
      uploadedBy: 'user-1',
    });
    expect(result.storageRef).toBe('company-a/uuid-1');
  });

  it('rechaza un contentType fuera del allowlist ANTES de llamar al puerto', async () => {
    const { handler, storageProvider } = buildHandler();

    await expect(
      handler.execute({ companyId: 'company-a', uploadedBy: 'user-1', contentType: 'video/mp4' }),
    ).rejects.toThrow();
    expect(storageProvider.getUploadUrl).not.toHaveBeenCalled();
  });
});
