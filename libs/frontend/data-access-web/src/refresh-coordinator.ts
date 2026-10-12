// docs/persistence/10-DECISIONES.md #134. El API rota el refresh token en cada uso y, si un
// refresh YA rotado se vuelve a presentar, revoca TODAS las sesiones del usuario (incluida
// mobile) por sospecha de robo (session-security.service.ts, INV-015). En el navegador eso
// pasa facil: dos requests con 401 a la vez, el doble efecto de StrictMode, o dos pestanas
// que recargan juntas mandarian la misma cookie dos veces.
//
// Por eso todo refresh pasa por aca:
//   - single-flight dentro de la pestana: llamadas concurrentes comparten UNA promesa;
//   - serializado entre pestanas con Web Locks (navigator.locks): la segunda pestana espera
//     y, cuando entra, el navegador ya tiene la cookie nueva que dejo la primera.
// Si el navegador no soporta Web Locks, cae a solo single-flight (mejor esfuerzo).

const LOCK_NAME = 'renta-refresh';

type LockManager = {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
};

function getLockManager(): LockManager | undefined {
  if (typeof navigator === 'undefined') {
    return undefined;
  }
  return (navigator as Navigator & { locks?: LockManager }).locks;
}

export function createRefreshCoordinator(doRefresh: () => Promise<string>): () => Promise<string> {
  let inFlight: Promise<string> | null = null;

  return () => {
    if (!inFlight) {
      const locks = getLockManager();
      const run = locks ? locks.request(LOCK_NAME, doRefresh) : doRefresh();
      inFlight = run.finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  };
}
