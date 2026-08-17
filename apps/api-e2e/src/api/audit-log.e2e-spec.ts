import request from 'supertest';

import { seedAdminForCompany } from '../support/seed-identity';

interface AuditLogEntrySummary {
  action: string;
  subjectType: string;
  subjectId: string;
  actorRef: string;
}

// Verifica de punta a punta el pipeline completo de Audit (docs/technical/05-EVENTING.md SS5):
// OutboxWriter.publish() (emit real via EventEmitter2, commit bb56ca2) -> DomainEventAuditListener
// (@OnEvent('**')) -> RecordAuditLogEntryHandler -> PrismaAuditLogRepository.save() (RLS-aware) ->
// GET /audit-log. Registrar company + crear branch produce, en ese orden, CompanyRegistered.v1
// (actor 'system', ruta @Public()), SessionCreated.v1 (actor 'system', Login tambien @Public())
// y BranchOpened.v1 (actor = el userId autenticado) - los 3 deben aparecer con subjectType/
// subjectId/actorRef correctos. Validado antes a mano via curl contra un servidor real; este
// spec formaliza esa misma corrida.
//
// El emit de OutboxWriter es fire-and-forget (docs/persistence/10-DECISIONES.md #20 - un fallo
// del listener de Audit nunca debe hacer fallar la operacion de negocio que lo origino), asi que
// GET /audit-log es consistente-eventual respecto al request que disparo el evento, no
// consistente-inmediato: se confirmo empiricamente que una lectura sincronica justo despues del
// POST /branches es flaky (Nx lo marco como "flaky task" en una corrida real) - se hace polling
// corto en vez de una unica lectura.
async function pollAuditLog(
  baseUrl: string,
  accessToken: string,
  predicate: (entries: AuditLogEntrySummary[]) => boolean,
  { timeoutMs = 5000, intervalMs = 100 } = {},
): Promise<AuditLogEntrySummary[]> {
  const deadline = Date.now() + timeoutMs;
  let entries: AuditLogEntrySummary[] = [];
  do {
    const response = await request(baseUrl)
      .get('/api/v1/audit-log')
      .set('Authorization', `Bearer ${accessToken}`);
    entries = response.body.data;
    if (predicate(entries)) return entries;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (Date.now() < deadline);
  return entries;
}

describe('GET /audit-log', () => {
  let baseUrl: string;

  beforeAll(() => {
    baseUrl = process.env.API_E2E_BASE_URL as string;
  });

  it('registra CompanyRegistered.v1, SessionCreated.v1 y BranchOpened.v1 con actorRef correcto', async () => {
    const taxId = `tax-audit-${Date.now()}`;
    const registerResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company audit e2e ${taxId}`,
        taxId,
        billingContactEmail: 'billing@example.com',
      });
    expect(registerResponse.status).toBe(201);
    const companyId: string = registerResponse.body.data.id;

    const admin = await seedAdminForCompany(companyId);

    const loginResponse = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({ companyId, email: admin.adminEmail, password: admin.adminPassword });
    expect(loginResponse.status).toBe(201);
    const accessToken: string = loginResponse.body.data.accessToken;
    const userId: string = admin.adminUserId;

    const createBranchResponse = await request(baseUrl)
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Sucursal Auditoria',
        address: { line1: 'Calle Audit 1', city: 'CABA', country: 'Argentina' },
        operatingHours: [],
      });
    expect(createBranchResponse.status).toBe(201);
    const branchId: string = createBranchResponse.body.data.id;

    const expectedActions = ['CompanyRegistered.v1', 'SessionCreated.v1', 'BranchOpened.v1'];
    const entries = await pollAuditLog(baseUrl, accessToken, (current) =>
      expectedActions.every((action) => current.some((e) => e.action === action)),
    );

    const companyRegistered = entries.find((e) => e.action === 'CompanyRegistered.v1');
    expect(companyRegistered).toMatchObject({
      subjectType: 'Company',
      subjectId: companyId,
      actorRef: 'system',
    });

    const sessionCreated = entries.find((e) => e.action === 'SessionCreated.v1');
    expect(sessionCreated).toMatchObject({ subjectType: 'Session', actorRef: 'system' });

    const branchOpened = entries.find((e) => e.action === 'BranchOpened.v1');
    expect(branchOpened).toMatchObject({
      subjectType: 'Branch',
      subjectId: branchId,
      actorRef: userId,
    });
  });

  it('una company no ve las filas de audit_log de otra company (RLS)', async () => {
    const registerA = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company audit cross A ${Date.now()}`,
        taxId: `tax-audit-cross-a-${Date.now()}`,
        billingContactEmail: 'billing@example.com',
      });
    const companyAId: string = registerA.body.data.id;

    const registerB = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company audit cross B ${Date.now()}`,
        taxId: `tax-audit-cross-b-${Date.now()}`,
        billingContactEmail: 'billing@example.com',
      });
    const companyBId: string = registerB.body.data.id;

    const adminB = await seedAdminForCompany(companyBId);
    const loginB = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({ companyId: companyBId, email: adminB.adminEmail, password: adminB.adminPassword });
    const tokenB: string = loginB.body.data.accessToken;

    const auditLogFromB = await request(baseUrl)
      .get('/api/v1/audit-log')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(auditLogFromB.status).toBe(200);
    const subjectIdsVisibleFromB = (auditLogFromB.body.data as Array<{ subjectId: string }>).map(
      (e) => e.subjectId,
    );
    expect(subjectIdsVisibleFromB).not.toContain(companyAId);
  });
});
