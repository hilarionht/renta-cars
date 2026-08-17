import { ContentType, File, StorageRef } from '@platform/files/domain';

import type { FileRepository } from '../../ports/file.repository';
import type { StorageProviderPort } from '../../ports/storage-provider.port';
import { GetSignedUrlHandler } from './get-signed-url.handler';

function createFile(companyId: string): File {
  return File.create({
    companyId,
    storageRef: StorageRef.from(`${companyId}/uuid-1`),
    contentType: ContentType.from('application/pdf'),
    uploadedBy: 'user-1',
  });
}

function buildHandler(existingFile: File | null) {
  const fileRepository: FileRepository = {
    findById: jest.fn().mockResolvedValue(existingFile),
    save: jest.fn(),
  };
  const storageProvider: StorageProviderPort = {
    getUploadUrl: jest.fn(),
    verifyUploadedObject: jest.fn(),
    getSignedUrl: jest.fn().mockResolvedValue({
      url: 'https://storage.local/company-a/uuid-1?signed-read',
      expiresAt: new Date('2026-01-01T00:05:00.000Z'),
    }),
    deleteObject: jest.fn(),
  };

  const handler = new GetSignedUrlHandler(fileRepository, storageProvider);

  return { handler, fileRepository, storageProvider };
}

describe('GetSignedUrlHandler', () => {
  it('devuelve la URL firmada del puerto para un File Uploaded', async () => {
    const file = createFile('company-a');
    const { handler, storageProvider } = buildHandler(file);

    const result = await handler.execute({ fileId: file.id.toString(), companyId: 'company-a' });

    expect(storageProvider.getSignedUrl).toHaveBeenCalledWith({
      storageRef: file.storageRef.toString(),
    });
    expect(result.url).toBe('https://storage.local/company-a/uuid-1?signed-read');
  });

  it('lanza FileNotFoundError si el repositorio no encuentra el File', async () => {
    const { handler, storageProvider } = buildHandler(null);

    await expect(
      handler.execute({ fileId: createFile('company-a').id.toString(), companyId: 'company-a' }),
    ).rejects.toThrow();
    expect(storageProvider.getSignedUrl).not.toHaveBeenCalled();
  });

  it('lanza FileAlreadyDeletedError si el File ya esta Deleted (invariante de dominio, no solo un flag en la query)', async () => {
    const file = createFile('company-a');
    file.delete();
    const { handler, storageProvider } = buildHandler(file);

    await expect(
      handler.execute({ fileId: file.id.toString(), companyId: 'company-a' }),
    ).rejects.toThrow();
    expect(storageProvider.getSignedUrl).not.toHaveBeenCalled();
  });
});
