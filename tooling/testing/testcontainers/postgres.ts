import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// Misma version mayor que docker-compose.yml (paso 5) y produccion -
// docs/engineering/04-TESTING-FOUNDATION.md SS2, docs/engineering/06-DOCKER.md SS6.
const POSTGRES_IMAGE = 'postgres:16-alpine';

const WORKSPACE_ROOT = join(__dirname, '..', '..', '..');

export interface PostgresTestContainer {
  container: StartedPostgreSqlContainer;
  connectionUri: string;
}

// docs/engineering/04-TESTING-FOUNDATION.md SS2: aplica el historial de Prisma Migrate
// contra la base efimera antes de exponerla - ningun test de integracion corre contra un
// schema desactualizado.
export async function startPostgresContainer(): Promise<PostgresTestContainer> {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  // `getConnectionUri()` devuelve el host como "localhost" - el motor de migraciones de
  // Prisma (binario Rust, no el driver `pg`/Node de la app) lo resuelve a veces por IPv6
  // primero y falla con P1001 contra un puerto publicado solo en IPv4 (reproducido de forma
  // 100% consistente en el bootstrap del paso 12, con Docker Desktop/Windows; un cliente TCP
  // de Node contra el mismo puerto conecta al instante). "127.0.0.1" explicito evita la
  // resolucion ambigua sin depender de la happy-eyeballs fallback de cada cliente.
  const connectionUri = container.getConnectionUri().replace('localhost', '127.0.0.1');

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: WORKSPACE_ROOT,
    env: { ...process.env, DATABASE_URL: connectionUri },
    stdio: 'inherit',
    shell: true,
  });

  return { container, connectionUri };
}

export async function stopPostgresContainer(instance: PostgresTestContainer): Promise<void> {
  await instance.container.stop();
}
