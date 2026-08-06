// Prisma 7 movio la configuracion de package.json a este archivo. Ubicacion del schema
// multi-archivo y del historial de migraciones - docs/technical/04-PERSISTENCE.md SS1.
//
// Prisma ya no carga `.env` implicitamente antes de evaluar este archivo (a diferencia de
// versiones previas) - se carga explicitamente aqui para que `env('DATABASE_URL')` resuelva.

import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

loadEnv();

export default defineConfig({
  schema: 'prisma/schema',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node tooling/scripts/db/seed.ts',
  },
});
