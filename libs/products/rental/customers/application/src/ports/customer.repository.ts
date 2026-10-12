import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { Customer, CustomerId } from '@rental/customers/domain';

export const CUSTOMER_REPOSITORY = Symbol('CustomerRepository');

// Un unico repositorio para todo el aggregate - IdentityDocument/AdditionalDriver son
// entidades internas de Customer, nunca tienen repositorio propio (DDD estandar). Ver
// PrismaCustomerRepository para el diseño de persistencia con dirty-tracking.
export interface CustomerRepository {
  // companyId opcional - RefreshCustomerSessionHandler/VerifyCustomerOtpHandler corren en
  // rutas @Public() (encontrado por un smoke test real fallando: "RequestContext no
  // inicializado - TenantContextGuard no corrio antes"), sin RequestContext poblado, pero ya
  // conocen el companyId por otra via (la CustomerSession/CustomerOtpChallenge ya
  // encontrada) - mismo mecanismo que ReadTransaction.run()/UnitOfWork.run() y que
  // CustomerLookupPort.getContactInfo(customerId, companyId?) en este mismo modulo.
  findById(id: CustomerId, companyId?: string): Promise<Customer | null>;
  // Fase 5 cliente-autogestion (docs/persistence/10-DECISIONES.md #109) - lookup interno de
  // auth por telefono (RequestCustomerOtpHandler/VerifyCustomerOtpHandler). Deliberadamente
  // NO en CUSTOMER_LOOKUP_PORT (la superficie publica cross-modulo, keyed solo por
  // customerId) - un lookup por telefono es interno de este modulo. Match exacto por string
  // E.164 (PhoneNumber.equals() en el dominio, sin normalizar espacios/guiones) - requisito
  // de contrato para el cliente mobile de la tanda siguiente.
  findByCompanyIdAndPhone(companyId: string, phone: string): Promise<Customer | null>;
  save(customer: Customer, tx: UnitOfWorkTransaction): Promise<void>;
}
