import { type CanActivate, Inject, Injectable } from '@nestjs/common';

import { RequestContext } from '@platform/persistence-kernel';
import { COMPANY_LOOKUP_PORT, type CompanyLookupPort } from '@platform/companies/application';

import { ApiException } from '../errors/api-exception';

// docs/technical/03-BACKEND-ARCHITECTURE.md SS7, tercer guard de la cadena (corre despues de
// TenantContextGuard). Rechaza la request si la Company del token esta Suspended (INV de
// docs/model/02-AGGREGATES.md SS4). Rutas @Public() (RegisterCompany, login, refresh) nunca
// tienen RequestContext poblado en este punto - las deja pasar, igual que TenantContextGuard.
@Injectable()
export class CompanyStatusGuard implements CanActivate {
  constructor(
    private readonly requestContext: RequestContext,
    @Inject(COMPANY_LOOKUP_PORT) private readonly companyLookup: CompanyLookupPort,
  ) {}

  async canActivate(): Promise<boolean> {
    const context = this.requestContext.tryGet();
    if (!context) {
      return true;
    }

    const status = await this.companyLookup.getStatus(context.companyId);
    if (status === 'Suspended') {
      throw new ApiException(403, 'COMPANY_SUSPENDED', 'La company esta suspendida.');
    }

    return true;
  }
}
