import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type { PasswordResetTokenHasher } from '@platform/users/application';

const TOKEN_BYTES = 32;

@Injectable()
export class Sha256PasswordResetTokenHasher implements PasswordResetTokenHasher {
  generate(): { plaintext: string; hash: string } {
    const plaintext = randomBytes(TOKEN_BYTES).toString('base64url');
    return { plaintext, hash: this.hash(plaintext) };
  }

  hash(plaintext: string): string {
    return createHash('sha256').update(plaintext).digest('hex');
  }
}
