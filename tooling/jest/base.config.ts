import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pathsToModuleNameMapper } from 'ts-jest';

// Preset unico de Jest (docs/engineering/04-TESTING-FOUNDATION.md SS1), heredado por
// `preset` desde el jest.config.ts de cada proyecto que genera
// tooling/generators/bounded-context. @swc/jest: rapido, sin type-check en el propio test
// run (eso ya lo cubre `nx affected --target=typecheck`, paso 4/9). Las particularidades
// por tipo de proyecto (globalSetup/globalTeardown de Testcontainers para
// `infrastructure`, coverage para domain/application) se agregan en el jest.config.ts de
// cada proyecto, no aqui - este archivo es la base comun a todos los tipos.
//
// moduleNameMapper para los alias @platform/*: sin esto, ningun test unitario que importe
// otro modulo publico (p. ej. platform-identity-domain importando @platform/shared-kernel)
// puede correr - jest no conoce los "paths" de tsconfig.base.json por si solo. Gap real,
// nunca antes ejercitado porque este es el primer .spec.ts del repo.
//
// import.meta.url (no __dirname) - el loader de configuracion de Jest ejecuta este archivo
// como modulo ESM sincrono (import.meta SI esta disponible, __dirname/require no).
// `repoRoot` se calcula desde la ubicacion fija de este archivo (tooling/jest/base.config.ts),
// no desde el rootDir de cada proyecto (que varia en profundidad segun el modulo).
// Sin `interface`/`as` (TS puro) mas abajo, a proposito: el loader de configuracion de Jest
// carga este archivo como ESM sincrono sin pasar por el compilador de TypeScript completo -
// solo tolera sintaxis que tambien es JavaScript valido (confirmado empiricamente: tanto
// `interface` como `as` rompen la carga con "Unexpected ..."). `tsconfig`/`paths` quedan sin
// tipar aca por esa razon, no por descuido.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- ver comentario arriba
const tsconfig = JSON.parse(readFileSync(join(repoRoot, 'tsconfig.base.json'), 'utf-8'));

export default {
  testEnvironment: 'node',
  // uuid v14 publica solo ESM (dist-node/index.js usa `export`) - Jest no transforma
  // node_modules por defecto y swc solo estaba registrado para .ts(x); EntityId
  // (shared-kernel) importa uuid, asi que cualquier test que toque un agregado con
  // EntityId.generate()/EntityId.from() lo necesita transformado tambien. `.jsx?` se agrega
  // al patron de transform (no solo se whitelist en transformIgnorePatterns) porque swc solo
  // actua sobre extensiones que matchean esa clave.
  // Parser de decoradores explicito - sin esto swc rechaza cualquier clase con @Injectable()/
  // @Inject() (sintaxis "legacy decorators", la que usa NestJS) con "Expression expected".
  // Nunca antes ejercitado: hasta este spec, ningun test importaba una clase decorada de
  // application/infrastructure (solo domain/, sin @nestjs/common).
  transform: {
    '^.+\\.[tj]sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', tsx: false, decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
        },
      },
    ],
  },
  // otplib (MFA TOTP, docs/persistence/10-DECISIONES.md #111): sus paquetes .cjs no vienen
  // bundleados (tsup los deja como dependencias reales) y uno de sus proveedores por default
  // (@otplib/plugin-base32-scure -> @scure/base, y transitivamente @otplib/plugin-crypto-noble
  // -> @noble/hashes) es ESM-only (sin build CJS propio) - un require() sin transformar tira
  // "Unexpected token 'export'" en cualquier test que instancie `new OTP(...)`.
  transformIgnorePatterns: ['/node_modules/(?!(uuid|otplib|@otplib|@scure|@noble)/)'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access -- ver comentario junto a `tsconfig` arriba
  moduleNameMapper: pathsToModuleNameMapper(tsconfig.compilerOptions.paths, {
    prefix: `${repoRoot}/`,
  }),
};
