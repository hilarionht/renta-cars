import { registerContainer } from './container-registry';
import { startPostgresContainer } from './postgres';
import { startRedisContainer } from './redis';

// globalSetup de docs/engineering/04-TESTING-FOUNDATION.md SS1 (fila `infrastructure`) -
// un contenedor por proyecto, reutilizado entre todos los .integration.spec.ts de ese
// proyecto en la misma corrida (no uno por archivo). Levanta ambos siempre: mas simple que
// parametrizar por proyecto, y el costo de un Redis efimero que un test no usa es bajo.
export default async function globalSetup(): Promise<void> {
  const postgres = await startPostgresContainer();
  registerContainer('postgres', postgres.container);
  process.env.TEST_DATABASE_URL = postgres.connectionUri;
  // Conexion como app_runtime (sujeta a RLS, docs/persistence/06-RLS.md §3) - necesaria para
  // cualquier .integration.spec.ts que valide aislamiento de tenant o fail-closed, no solo
  // round-trip de repositorio (que puede usar TEST_DATABASE_URL, el rol dueño de las tablas).
  process.env.TEST_APP_DATABASE_URL = postgres.appRuntimeConnectionUri;

  const redis = await startRedisContainer();
  registerContainer('redis', redis.container);
  process.env.TEST_REDIS_URL = redis.connectionUri;
}
