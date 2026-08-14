import { Injectable } from '@nestjs/common';

import type { CompanyExistsPort } from './company-exists.port';

// Companies (Fase 0 item 3) no esta construido todavia - este adapter es un placeholder
// que siempre responde true, documentado como tal, no una validacion real disfrazada.
// Reemplazar por un adapter real (contra platform-companies-infrastructure) cuando ese
// modulo exista. No es una decision de arquitectura nueva, es un hueco conocido y
// explicitamente aceptado en el plan de esta tanda (Fase 0 - Identity & Access).
@Injectable()
export class NoopCompanyExistsAdapter implements CompanyExistsPort {
  exists(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
