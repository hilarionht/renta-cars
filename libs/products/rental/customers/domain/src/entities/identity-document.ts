import { EntityId } from '@platform/shared-kernel';

import { IdentityDocumentExpiredError } from '../errors/identity-document-expired.error';
import type { DocumentType } from '../value-objects/document-type';
import type { IdentityDocumentStatus } from '../value-objects/identity-document-status';

export type IdentityDocumentId = EntityId<'IdentityDocument'>;

// Propietario polimorfico (docs/persistence/03-RELACIONES.md SS5) - el dominio lo modela de
// forma uniforme como una union discriminada; el limite de infraestructura (Prisma) lo
// traduce a dos columnas FK nulables mutuamente excluyentes (customer_id,
// additional_driver_id) + un CHECK, nunca al reves (el dominio nunca conoce esas 2 columnas).
export type IdentityDocumentOwner =
  { type: 'Customer'; id: string } | { type: 'AdditionalDriver'; id: string };

export interface IdentityDocumentProps {
  id: IdentityDocumentId;
  owner: IdentityDocumentOwner;
  documentType: DocumentType;
  fileId: string;
  expiryDate: Date;
  status: IdentityDocumentStatus;
  extractedByOcr: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Entidad interna de Customer/AdditionalDriver (docs/model/02-AGGREGATES.md SS10) - append-
// only (renovar crea un documento nuevo, nunca revive uno vencido), sin version propia
// (protegida por la version del aggregate root que la contiene).
export class IdentityDocument {
  private constructor(private props: IdentityDocumentProps) {}

  // extractedByOcr siempre false - DocumentExtractionPort (OCR) diferido esta tanda (decision
  // con el usuario), el campo se modela por compatibilidad futura con INV-011 sin ejercitarse.
  static upload(params: {
    owner: IdentityDocumentOwner;
    documentType: DocumentType;
    fileId: string;
    expiryDate: Date;
  }): IdentityDocument {
    const now = new Date();
    return new IdentityDocument({
      id: EntityId.generate<'IdentityDocument'>(),
      owner: params.owner,
      documentType: params.documentType,
      fileId: params.fileId,
      expiryDate: params.expiryDate,
      status: 'Pending',
      extractedByOcr: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: IdentityDocumentProps): IdentityDocument {
    return new IdentityDocument(props);
  }

  get id(): IdentityDocumentId {
    return this.props.id;
  }

  get owner(): IdentityDocumentOwner {
    return this.props.owner;
  }

  get documentType(): DocumentType {
    return this.props.documentType;
  }

  get fileId(): string {
    return this.props.fileId;
  }

  get expiryDate(): Date {
    return this.props.expiryDate;
  }

  get status(): IdentityDocumentStatus {
    return this.props.status;
  }

  get extractedByOcr(): boolean {
    return this.props.extractedByOcr;
  }

  // Requerido siempre como paso explicito (RN-12/INV-011 exige confirmacion humana cuando
  // extractedByOcr=true; con OCR diferido esta tanda, verify() es de todos modos siempre un
  // paso manual explicito, nunca automatico al subir - unica lectura consistente del
  // diagrama de un solo tramo Pending->Verified en docs/model/08-STATE_MACHINES.md SS6.7).
  verify(): void {
    if (this.props.status === 'Expired') {
      throw new IdentityDocumentExpiredError(this.props.id.toString());
    }
    if (this.props.status === 'Verified') {
      return;
    }
    this.props.status = 'Verified';
    this.props.updatedAt = new Date();
  }

  // Computado, no confia solo en `status` - no existe ningun job de expiracion en este
  // codebase (mismo gap ya aceptado que OutboxRelayWorker) que transicione Verified->Expired
  // automaticamente por fecha.
  isCurrentlyValid(asOf: Date = new Date()): boolean {
    return this.props.status === 'Verified' && this.props.expiryDate.getTime() > asOf.getTime();
  }
}
