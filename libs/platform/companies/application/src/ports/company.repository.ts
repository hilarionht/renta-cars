import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { Company, CompanyId } from '@platform/companies/domain';

export const COMPANY_REPOSITORY = Symbol('CompanyRepository');

export interface CompanyRepository {
  findById(id: CompanyId): Promise<Company | null>;
  // Lanza DuplicateTaxIdError al atrapar el constraint unico de Postgres (P2002) - no hay
  // findByTaxId aca porque un pre-check cruzaria RLS de companies (docs/persistence/
  // 06-RLS.md SS4.1, solo deja ver "la propia") - ver docs/persistence/10-DECISIONES.md.
  save(company: Company, tx: UnitOfWorkTransaction): Promise<void>;
}
