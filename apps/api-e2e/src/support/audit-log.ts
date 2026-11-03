import request from 'supertest';

// docs/persistence/10-DECISIONES.md #149 y #153. El AuditLogEntry lo escribe un listener
// fire-and-forget (DomainEventAuditListener, docs/technical/05-EVENTING.md SS5) despues de
// que el API ya respondio: un GET /audit-log inmediato puede no ver el ultimo evento. Se
// reintenta hasta que `isComplete` acepte las entradas o venza el plazo; al vencer devuelve
// la ultima lectura, para que la asercion del test muestre que falto.
export async function readAuditEntriesUntil<T extends { action: string }>(
  baseUrl: string,
  accessToken: string,
  isComplete: (entries: T[]) => boolean,
  timeoutMs = 5000,
): Promise<T[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const response = await request(baseUrl)
      .get('/api/v1/audit-log')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(response.status).toBe(200);
    const entries = (response.body as { data: T[] }).data;
    if (isComplete(entries) || Date.now() >= deadline) {
      return entries;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

export async function readAuditActionsUntil(
  baseUrl: string,
  accessToken: string,
  isComplete: (actions: string[]) => boolean,
  timeoutMs = 5000,
): Promise<string[]> {
  const entries = await readAuditEntriesUntil(
    baseUrl,
    accessToken,
    (all) => isComplete(all.map((entry) => entry.action)),
    timeoutMs,
  );
  return entries.map((entry) => entry.action);
}

// Lo mas comun en los specs: esperar a que aparezcan todas estas acciones.
export function readAuditActionsIncluding(
  baseUrl: string,
  accessToken: string,
  expected: string[],
): Promise<string[]> {
  return readAuditActionsUntil(baseUrl, accessToken, (actions) =>
    expected.every((action) => actions.includes(action)),
  );
}
