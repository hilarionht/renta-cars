import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { Customer, CustomerId } from '@rental/customers/domain';

export const CUSTOMER_REPOSITORY = Symbol('CustomerRepository');

// Un unico repositorio para todo el aggregate - IdentityDocument/AdditionalDriver son
// entidades internas de Customer, nunca tienen repositorio propio (DDD estandar). Ver
// PrismaCustomerRepository para el diseño de persistencia con dirty-tracking.
export interface CustomerRepository {
  findById(id: CustomerId): Promise<Customer | null>;
  save(customer: Customer, tx: UnitOfWorkTransaction): Promise<void>;
}
