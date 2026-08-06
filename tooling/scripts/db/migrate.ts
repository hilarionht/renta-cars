// Wrapper de `prisma migrate dev` - docs/engineering/02-DEVELOPER-EXPERIENCE.md §1 paso 5
// y §2 (`db:migrate`). Nunca se invoca Prisma directamente: este script es el unico punto
// que fija `DATABASE_URL` de forma uniforme (hoy desde `.env`; cuando exista `ConfigModule`
// en apps/api el mismo mecanismo de resolucion se reutiliza aqui).

import { spawnSync } from 'node:child_process';

import { config as loadEnv } from 'dotenv';

loadEnv();

const result = spawnSync('npx', ['prisma', 'migrate', 'dev', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
