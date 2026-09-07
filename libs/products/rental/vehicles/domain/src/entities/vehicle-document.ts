import { EntityId } from '@platform/shared-kernel';

import { VehicleDocumentExpiredError } from '../errors/vehicle-document-expired.error';
import type { VehicleDocumentStatusValue } from '../value-objects/vehicle-document-status';
import type { VehicleDocumentTypeValue } from '../value-objects/vehicle-document-type';

export type VehicleDocumentId = EntityId<'VehicleDocument'>;

export interface VehicleDocumentProps {
  id: VehicleDocumentId;
  documentType: VehicleDocumentTypeValue;
  fileId: string;
  expiryDate: Date;
  status: VehicleDocumentStatusValue;
  createdAt: Date;
  updatedAt: Date;
}

// Entidad interna de Vehicle (docs/model/02-AGGREGATES.md SS8) - append-only, sin version
// propia (protegida por la version del aggregate root que la contiene), sin propietario
// polimorfico (a diferencia de IdentityDocument, siempre pertenece a un unico Vehicle).
export class VehicleDocument {
  private constructor(private props: VehicleDocumentProps) {}

  static upload(params: {
    documentType: VehicleDocumentTypeValue;
    fileId: string;
    expiryDate: Date;
  }): VehicleDocument {
    const now = new Date();
    return new VehicleDocument({
      id: EntityId.generate<'VehicleDocument'>(),
      documentType: params.documentType,
      fileId: params.fileId,
      expiryDate: params.expiryDate,
      status: 'Pending',
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: VehicleDocumentProps): VehicleDocument {
    return new VehicleDocument(props);
  }

  get id(): VehicleDocumentId {
    return this.props.id;
  }

  get documentType(): VehicleDocumentTypeValue {
    return this.props.documentType;
  }

  get fileId(): string {
    return this.props.fileId;
  }

  get expiryDate(): Date {
    return this.props.expiryDate;
  }

  get status(): VehicleDocumentStatusValue {
    return this.props.status;
  }

  verify(): void {
    if (this.props.status === 'Expired') {
      throw new VehicleDocumentExpiredError(this.props.id.toString());
    }
    if (this.props.status === 'Verified') {
      return;
    }
    this.props.status = 'Verified';
    this.props.updatedAt = new Date();
  }

  // Computado, no confia solo en `status` - sin job de expiracion (mismo gap ya aceptado
  // que IdentityDocument.isCurrentlyValid en Customers).
  isCurrentlyValid(asOf: Date = new Date()): boolean {
    return this.props.status === 'Verified' && this.props.expiryDate.getTime() > asOf.getTime();
  }
}
