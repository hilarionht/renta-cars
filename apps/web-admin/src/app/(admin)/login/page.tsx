// Feature "login" de "web-admin" - docs/06-CONVENCIONES-FRONTEND.md SS2.
// Regla de dependencia: esta feature -> @frontend/data-access + ui-kit -> @frontend/domain-types.
// Nunca al reves, y nunca importa '@frontend/ui-kit-core' directamente (solo la variante de plataforma).
//
// Pantalla minima del bootstrap (docs/engineering/10-BOOTSTRAP-PLAN.md, paso 13) - sin
// logica de negocio real todavia (Identity no existe hasta Fase 0). Server Component por
// defecto (docs/06-CONVENCIONES-FRONTEND.md SS3): el fetch a /health/ready corre en el
// servidor, no en el navegador, asi que no aplica CORS. Cuando exista @frontend/data-access
// real, este fetch directo se reemplaza por su hook correspondiente.

interface HealthStatus {
  ok: boolean;
}

async function getApiHealth(): Promise<HealthStatus> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health/ready`, {
      cache: 'no-store',
    });
    return { ok: response.ok };
  } catch {
    return { ok: false };
  }
}

export default async function LoginPage() {
  const health = await getApiHealth();

  return (
    <main>
      <h1>Iniciar sesión</h1>
      <p>Estado de la API: {health.ok ? 'disponible' : 'no disponible'}</p>
    </main>
  );
}
