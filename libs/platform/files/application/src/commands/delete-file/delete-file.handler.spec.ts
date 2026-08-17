import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import { ContentType, File, StorageRef } from '@platform/files/domain';

import type { FileRepository } from '../../ports/file.repository';
import { DeleteFileHandler } from './delete-file.handler';

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
    save: jest.fn().mockResolvedValue(undefined),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new DeleteFileHandler(fileRepository, unitOfWork, eventPublisher);

  return { handler, fileRepository, eventPublisher };
}

describe('DeleteFileHandler', () => {
  it('marca el File como Deleted, lo persiste y publica FileDeleted.v1', async () => {
    const file = createFile('company-a');
    const { handler, fileRepository, eventPublisher } = buildHandler(file);

    await handler.execute({ fileId: file.id.toString(), companyId: 'company-a' });

    expect(file.uploadStatus).toBe('Deleted');
    expect(fileRepository.save).toHaveBeenCalledWith(file, expect.anything());
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'FileDeleted.v1' }),
    );
  });

  it('lanza FileNotFoundError si el repositorio no encuentra el File', async () => {
    const { handler, fileRepository } = buildHandler(null);

    await expect(
      handler.execute({ fileId: createFile('company-a').id.toString(), companyId: 'company-a' }),
    ).rejects.toThrow();
    expect(fileRepository.save).not.toHaveBeenCalled();
  });

  it('lanza FileNotFoundError si el File pertenece a otra company (defensa en profundidad ademas de RLS)', async () => {
    const file = createFile('company-a');
    const { handler, fileRepository } = buildHandler(file);

    await expect(
      handler.execute({ fileId: file.id.toString(), companyId: 'company-b' }),
    ).rejects.toThrow();
    expect(fileRepository.save).not.toHaveBeenCalled();
  });
});
