import 'reflect-metadata';

import { validate } from './env.validation';

// docs/persistence/10-DECISIONES.md #158: el schema exige lo que el arranque exige de verdad.
const REQUIRED = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  APP_DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  PLATFORM_ADMIN_DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  STORAGE_ENDPOINT: 'http://localhost:9002',
  STORAGE_BUCKET: 'b',
  STORAGE_ACCESS_KEY: 'a',
  STORAGE_SECRET_KEY: 's',
  STORAGE_REGION: 'us-east-1',
  JWT_PRIVATE_KEY: 'priv',
  JWT_PUBLIC_KEY: 'pub',
  JWT_ACTIVE_KID: 'kid',
  MFA_SECRET_ENCRYPTION_KEY: '0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0',
};

describe('validate (env)', () => {
  it('acepta la configuracion minima obligatoria', () => {
    expect(() => validate({ ...REQUIRED })).not.toThrow();
  });

  it('rechaza el arranque sin MFA_SECRET_ENCRYPTION_KEY', () => {
    const withoutKey: Record<string, unknown> = { ...REQUIRED };
    delete withoutKey.MFA_SECRET_ENCRYPTION_KEY;
    expect(() => validate(withoutKey)).toThrow(
      /- MFA_SECRET_ENCRYPTION_KEY: .*openssl rand -hex 32/,
    );
  });

  it.each([
    ['vacia', ''],
    ['corta', 'abcd'],
    ['no hex', 'z'.repeat(64)],
  ])('rechaza una MFA_SECRET_ENCRYPTION_KEY %s', (_case, value) => {
    expect(() => validate({ ...REQUIRED, MFA_SECRET_ENCRYPTION_KEY: value })).toThrow(
      /MFA_SECRET_ENCRYPTION_KEY/,
    );
  });
});
