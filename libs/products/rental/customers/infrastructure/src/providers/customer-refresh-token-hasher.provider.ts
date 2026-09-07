import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type { CustomerRefreshTokenHasher } from '@rental/customers/application';

// Espejo deliberado de platform/identity/infrastructure/src/providers/
// refresh-token-hasher.provider.ts.
const TOKEN_BYTES = 32;

@Injectable()
export class Sha256CustomerRefreshTokenHasher implements CustomerRefreshTokenHasher {
  generate(): { plaintext: string; hash: string } {
    const plaintext = randomBytes(TOKEN_BYTES).toString('base64url');
    return { plaintext, hash: this.hash(plaintext) };
  }

  hash(plaintext: string): string {
    return createHash('sha256').update(plaintext).digest('hex');
  }
}
