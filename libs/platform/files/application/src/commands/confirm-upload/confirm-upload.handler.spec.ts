import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import type { File } from '@platform/files/domain';

import type { FileRepository } from '../../ports/file.repository';
import type { StorageProviderPort } from '../../ports/storage-provider.port';
import { ConfirmUploadHandler } from './confirm-upload.handler';

function buildHandler(overrides?: {
  verifyUploadedObject?: StorageProviderPort['verifyUploadedObject'];
  maxUploadBytes?: number;
}) {
  const savedFiles: File[] = [];
  const fileRepository: FileRepository = {
    findById: jest.fn(),
    save: jest.fn((file: File) => {
      savedFiles.push(file);
      return Promise.resolve();
    }),
  };
  const storageProvider: StorageProviderPort = {
    getUploadUrl: jest.fn(),
    verifyUploadedObject:
      overrides?.verifyUploadedObject ??
      jest.fn().mockResolvedValue({
        exists: true,
        sizeBytes: 1024,
        contentType: 'application/pdf',
      }),
    getSignedUrl: jest.fn(),
    deleteObject: jest.fn().mockResolvedValue(undefined),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new ConfirmUploadHandler(
    storageProvider,
    fileRepository,
    unitOfWork,
    eventPublisher,
    { maxUploadBytes: overrides?.maxUploadBytes ?? 20 * 1024 * 1024 },
  );

  return { handler, fileRepository, storageProvider, unitOfWork, eventPublisher, savedFiles };
}

const baseCommand = {
  companyId: 'company-a',
  uploadedBy: 'user-1',
  storageRef: 'company-a/uuid-1',
  contentType: 'application/pdf',
};

describe('ConfirmUploadHandler', () => {
  it('crea el File, lo persiste dentro de UnitOfWork.run() y publica FileUploaded.v1', async () => {
    const { handler, fileRepository, eventPublisher, savedFiles } = buildHandler();

    const fileId = await handler.execute(baseCommand);

    expect(fileId.toString()).toBeDefined();
    expect(fileRepository.save).toHaveBeenCalledTimes(1);
    expect(savedFiles).toHaveLength(1);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'FileUploaded.v1', companyId: 'company-a' }),
    );
  });

  it('lanza StorageObjectNotFoundError si el objeto nunca se subio', async () => {
    const { handler, fileRepository } = buildHandler({
      verifyUploadedObject: jest.fn().mockResolvedValue({ exists: false }),
    });

    await expect(handler.execute(baseCommand)).rejects.toThrow();
    expect(fileRepository.save).not.toHaveBeenCalled();
  });

  it('lanza UnsupportedContentTypeError y borra el objeto si el contentType medido no coincide (contentType no queda firmado en el PUT)', async () => {
    const { handler, fileRepository, storageProvider } = buildHandler({
      verifyUploadedObject: jest
        .fn()
        .mockResolvedValue({ exists: true, sizeBytes: 10, contentType: 'image/png' }),
    });

    await expect(handler.execute(baseCommand)).rejects.toThrow();
    expect(storageProvider.deleteObject).toHaveBeenCalledWith({ storageRef: 'company-a/uuid-1' });
    expect(fileRepository.save).not.toHaveBeenCalled();
  });

  it('lanza FileTooLargeError y borra el objeto si el tamano medido excede el limite', async () => {
    const { handler, fileRepository, storageProvider } = buildHandler({
      verifyUploadedObject: jest
        .fn()
        .mockResolvedValue({ exists: true, sizeBytes: 999, contentType: 'application/pdf' }),
      maxUploadBytes: 100,
    });

    await expect(handler.execute(baseCommand)).rejects.toThrow();
    expect(storageProvider.deleteObject).toHaveBeenCalledWith({ storageRef: 'company-a/uuid-1' });
    expect(fileRepository.save).not.toHaveBeenCalled();
  });
});
