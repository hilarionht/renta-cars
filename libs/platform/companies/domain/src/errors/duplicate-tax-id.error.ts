import { DomainError } from '@platform/shared-kernel';

// INV-016 (docs/model/07-INVARIANTS.md SS1): TaxId unico a nivel de Plataforma - la unica
// unicidad verdaderamente global del modelo (Company no tiene su propio companyId que la
// escope). Se lanza desde PrismaCompanyRepository.save() al atrapar el constraint unico de
// Postgres (P2002), no desde un pre-check en el agregado - ver docs/persistence/
// 10-DECISIONES.md.
export class DuplicateTaxIdError extends DomainError {
  constructor(taxId: string) {
    super(`Ya existe una company registrada con el TaxId "${taxId}".`);
  }
}
