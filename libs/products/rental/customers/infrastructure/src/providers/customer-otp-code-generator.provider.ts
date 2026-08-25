import { createHash, randomInt } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type { CustomerOtpCodeGenerator } from '@rental/customers/application';

// crypto.randomInt (nunca Math.random) - 6 digitos, con ceros a la izquierda preservados.
const CODE_MIN = 0;
const CODE_MAX = 1_000_000;

@Injectable()
export class Sha256CustomerOtpCodeGenerator implements CustomerOtpCodeGenerator {
  generate(): { code: string; hash: string } {
    const code = randomInt(CODE_MIN, CODE_MAX).toString().padStart(6, '0');
    return { code, hash: this.hash(code) };
  }

  hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }
}
