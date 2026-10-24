import request from 'supertest';

// docs/persistence/10-DECISIONES.md #149. El AuditLogEntry lo escribe un listener
// fire-and-forget (DomainEventAuditListener, docs/technical/05-EVENTING.md SS5) despues de
// que el API ya respondio: un GET /audit-log inmediato puede no ver el ultimo evento. Se
// reintenta hasta que `isComplete` acepte las acciones o venza el plazo; al vencer devuelve
// la ultima lectura, para que la asercion del test muestre que falto.
export async function readAuditActionsUntil(
  baseUrl: string,
  accessToken: string,
  isComplete: (actions: string[]) => boolean,
  timeoutMs = 5000,
): Promise<string[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const response = await request(baseUrl)
      .get('/api/v1/audit-log')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(response.status).toBe(200);
    const body = response.body as { data: { action: string }[] };
    const actions = body.data.map((entry) => entry.action);
    if (isComplete(actions) || Date.now() >= deadline) {
      return actions;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
