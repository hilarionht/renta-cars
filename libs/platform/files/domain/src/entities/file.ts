import { EntityId } from '@platform/shared-kernel';

import { FileAlreadyDeletedError } from '../errors/file-already-deleted.error';
import type { FileDeletedEvent } from '../events/file-deleted.event';
import type { FileUploadedEvent } from '../events/file-uploaded.event';
import type { ContentType } from '../value-objects/content-type';
import type { StorageRef } from '../value-objects/storage-ref';
import type { UploadStatus } from '../value-objects/upload-status';

export type FileId = EntityId<'File'>;
type FileDomainEvent = FileUploadedEvent | FileDeletedEvent;

export interface FileProps {
  id: FileId;
  companyId: string;
  storageRef: StorageRef;
  contentType: ContentType;
  uploadStatus: UploadStatus;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Aggregate root - docs/model/02-AGGREGATES.md SS15. Sin entidades internas. companyId y
// uploadedBy son strings planos (sin FK, sin VO propio) - mismo criterio que
// AuditLogEntry.companyId/actorRef: referencias cross-schema opacas.
export class File {
  private domainEvents: FileDomainEvent[] = [];
  private isNewAggregate = false;

  private constructor(private props: FileProps) {}

  static create(params: {
    companyId: string;
    storageRef: StorageRef;
    contentType: ContentType;
    uploadedBy: string;
  }): File {
    const now = new Date();
    const file = new File({
      id: EntityId.generate<'File'>(),
      companyId: params.companyId,
      storageRef: params.storageRef,
      contentType: params.contentType,
      uploadStatus: 'Uploaded',
      uploadedBy: params.uploadedBy,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });

    file.domainEvents.push({
      eventType: 'FileUploaded.v1',
      fileId: file.props.id.toString(),
      contentType: params.contentType.toString(),
      uploadedBy: params.uploadedBy,
    });
    file.isNewAggregate = true;

    return file;
  }

  static reconstitute(props: FileProps): File {
    return new File(props);
  }

  get id(): FileId {
    return this.props.id;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get storageRef(): StorageRef {
    return this.props.storageRef;
  }

  get contentType(): ContentType {
    return this.props.contentType;
  }

  get uploadStatus(): UploadStatus {
    return this.props.uploadStatus;
  }

  get uploadedBy(): string {
    return this.props.uploadedBy;
  }

  get version(): number {
    return this.props.version;
  }

  get isNew(): boolean {
    return this.isNewAggregate;
  }

  markPersisted(): void {
    this.isNewAggregate = false;
  }

  // Guarda compartida por delete() y ensureReadable() - regla de docs/model/
  // 02-AGGREGATES.md SS15 ("un File en Deleted no puede generar una nueva URL firmada"),
  // extendida por simetria a "tampoco puede volver a eliminarse".
  private assertNotDeleted(): void {
    if (this.props.uploadStatus === 'Deleted') {
      throw new FileAlreadyDeletedError(this.props.id.toString());
    }
  }

  // Llamado antes de pedir una signed URL de lectura - nunca muta estado.
  ensureReadable(): void {
    this.assertNotDeleted();
  }

  delete(): void {
    this.assertNotDeleted();
    this.props.uploadStatus = 'Deleted';
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({ eventType: 'FileDeleted.v1', fileId: this.props.id.toString() });
  }

  pullDomainEvents(): FileDomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}
