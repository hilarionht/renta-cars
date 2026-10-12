import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { Role, RoleId } from '@platform/roles-permissions/domain';

// Puerto (docs/05-CONVENCIONES-BACKEND.md SS1) - interfaz pura, cero dependencia de
// @prisma/client. La implementacion real vive en infrastructure/persistence/prisma.
// `save` recibe el `tx` de UnitOfWork.run() - la escritura del agregado y la del evento de
// dominio (DomainEventPublisher.publish) deben ocurrir en la misma transaccion.
export const ROLE_REPOSITORY = Symbol('RoleRepository');

export interface RoleRepository {
  findById(id: RoleId): Promise<Role | null>;
  findByCompanyAndName(companyId: string | null, roleName: string): Promise<Role | null>;
  findAllForCompany(companyId: string): Promise<Role[]>;
  save(role: Role, tx: UnitOfWorkTransaction): Promise<void>;
}
