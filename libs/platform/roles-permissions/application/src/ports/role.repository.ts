import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { Role, RoleId } from '@platform/roles-permissions/domain';

// Puerto (docs/05-CONVENCIONES-BACKEND.md SS1) - interfaz pura, cero dependencia de
// @prisma/client. La implementacion real vive en infrastructure/persistence/prisma.
// `save` recibe el `tx` de UnitOfWork.run() - la escritura del agregado y la del evento de
// dominio (DomainEventPublisher.publish) deben ocurrir en la misma transaccion.
export const ROLE_REPOSITORY = Symbol('RoleRepository');

// docs/persistence/10-DECISIONES.md #140: lectura liviana por el id crudo (sin EntityId ni
// reconstituir el agregado), para decidir 404/403 antes de cargar. Los roles System de los
// seeds viejos tienen id v4 y EntityId.from exige v7: cargarlos daba 500.
export interface RoleRecordSummary {
  scope: 'System' | 'Custom';
  companyId: string | null;
  status: 'Active' | 'Inactive';
}

export interface RoleRepository {
  findById(id: RoleId): Promise<Role | null>;
  findSummaryById(id: string): Promise<RoleRecordSummary | null>;
  // #140: sin distinguir mayusculas, contra los Custom de la company y contra todos los System.
  existsWithName(companyId: string, roleName: string): Promise<boolean>;
  findAllForCompany(companyId: string): Promise<Role[]>;
  save(role: Role, tx: UnitOfWorkTransaction): Promise<void>;
}
