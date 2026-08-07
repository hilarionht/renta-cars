// Genera un par de claves RS256 de desarrollo (paso 9 de
// docs/engineering/10-BOOTSTRAP-PLAN.md) - docs/technical/07-SECURITY.md SS1 y
// docs/technical/10-DECISIONES.md #3. Imprime a stdout en formato listo para pegar en
// `.env`; nunca escribe el archivo directamente (evita pisar otras variables ya
// configuradas). En CI/produccion las claves vienen del almacen de secretos del entorno
// de despliegue (docs/technical/07-SECURITY.md SS3) - este script es exclusivamente para
// desarrollo local.

import { generateKeyPairSync, randomBytes } from 'node:crypto';

function toEnvValue(pem: string): string {
  return pem.trim().replace(/\n/g, '\\n');
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const kid = `dev-${randomBytes(4).toString('hex')}`;

console.log('# Par de claves RS256 de desarrollo - pegar en .env (nunca versionar).');
console.log(`JWT_PRIVATE_KEY="${toEnvValue(privateKey)}"`);
console.log(`JWT_PUBLIC_KEY="${toEnvValue(publicKey)}"`);
console.log(`JWT_ACTIVE_KID=${kid}`);
console.log('JWT_ACCESS_TTL=900');
