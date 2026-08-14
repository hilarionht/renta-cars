import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash, verify } from '@node-rs/argon2';

import type { PasswordHasher } from '@platform/users/application';

// docs/09-SEGURIDAD.md SS3: argon2id. Parametros en apps/api/src/config/security.config.ts
// (baseline OWASP, no calibrado contra hardware de produccion - Fase 6). @node-rs/argon2
// (no `argon2`): ese ultimo requiere compilar nativo con Python/node-gyp, no disponible sin
// mas en Windows sin toolchain instalado; @node-rs/argon2 distribuye binarios precompilados
// (NAPI-RS) para cada plataforma, mismo patron que @nx/nx-*.
@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  constructor(private readonly configService: ConfigService) {}

  async hash(plainPassword: string): Promise<string> {
    const config = this.configService.getOrThrow<{
      memoryCost: number;
      timeCost: number;
      parallelism: number;
    }>('security.argon2');

    return hash(plainPassword, {
      memoryCost: config.memoryCost,
      timeCost: config.timeCost,
      parallelism: config.parallelism,
    });
  }

  async verify(passwordHash: string, plainPassword: string): Promise<boolean> {
    return verify(passwordHash, plainPassword);
  }
}
