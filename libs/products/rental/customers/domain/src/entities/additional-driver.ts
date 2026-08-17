import { EntityId } from '@platform/shared-kernel';

import { AdditionalDriverMissingValidLicenseError } from '../errors/additional-driver-missing-valid-license.error';
import { AdditionalDriverRevokedError } from '../errors/additional-driver-revoked.error';
import type { AdditionalDriverStatus } from '../value-objects/additional-driver-status';
import type { IdentityDocument } from './identity-document';

export type AdditionalDriverId = EntityId<'AdditionalDriver'>;

export interface AdditionalDriverProps {
  id: AdditionalDriverId;
  customerId: string;
  name: string;
  status: AdditionalDriverStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Entidad interna de Customer (docs/model/02-AGGREGATES.md SS10) - a diferencia de
// IdentityDocument (append-only, sin version), esta SI tiene version propia
// (docs/persistence/04-COLUMNAS-CONCEPTUALES.md SS6), excepcion real y deliberada a la
// regla general de "version solo en Aggregate Roots" (docs/persistence/10-DECISIONES.md).
export class AdditionalDriver {
  private isNewEntity = false;

  private constructor(private props: AdditionalDriverProps) {}

  static register(params: { customerId: string; name: string }): AdditionalDriver {
    const now = new Date();
    const driver = new AdditionalDriver({
      id: EntityId.generate<'AdditionalDriver'>(),
      customerId: params.customerId,
      name: params.name,
      status: 'Registered',
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
    driver.isNewEntity = true;
    return driver;
  }

  static reconstitute(props: AdditionalDriverProps): AdditionalDriver {
    return new AdditionalDriver(props);
  }

  get id(): AdditionalDriverId {
    return this.props.id;
  }

  get customerId(): string {
    return this.props.customerId;
  }

  get name(): string {
    return this.props.name;
  }

  get status(): AdditionalDriverStatus {
    return this.props.status;
  }

  get version(): number {
    return this.props.version;
  }

  get isNew(): boolean {
    return this.isNewEntity;
  }

  markPersisted(): void {
    this.isNewEntity = false;
  }

  // INV-012: no puede quedar Validated sin una licencia de conducir (IdentityDocument)
  // propia y vigente - el aggregate root (Customer) es quien localiza la licencia del
  // driver entre sus documentos y la pasa aca, este metodo no la busca por si mismo.
  validateLicense(license: IdentityDocument | undefined): void {
    if (this.props.status === 'Revoked') {
      throw new AdditionalDriverRevokedError(this.props.id.toString());
    }
    if (this.props.status === 'Validated') {
      return;
    }
    if (!license || !license.isCurrentlyValid()) {
      throw new AdditionalDriverMissingValidLicenseError(this.props.id.toString());
    }
    this.props.status = 'Validated';
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }

  revoke(): void {
    if (this.props.status === 'Revoked') {
      return;
    }
    this.props.status = 'Revoked';
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }
}
