import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { type FileId, FileNotFoundError } from '@platform/files/domain';

import { FILE_REPOSITORY, type FileRepository } from '../../ports/file.repository';
import type { DeleteFileCommand } from './delete-file.command';

@Injectable()
export class DeleteFileHandler {
  constructor(
    @Inject(FILE_REPOSITORY) private readonly fileRepository: FileRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: DeleteFileCommand): Promise<void> {
    const fileId: FileId = EntityId.from(command.fileId);
    const file = await this.fileRepository.findById(fileId);
    if (!file || file.companyId !== command.companyId) {
      throw new FileNotFoundError(command.fileId);
    }

    file.delete();

    await this.unitOfWork.run(async (tx) => {
      await this.fileRepository.save(file, tx);
      for (const event of file.pullDomainEvents()) {
        await this.eventPublisher.publish(tx, {
          eventType: event.eventType,
          aggregateType: 'File',
          aggregateId: file.id.toString(),
          companyId: file.companyId,
          payload: { ...event },
        });
      }
    });
  }
}
