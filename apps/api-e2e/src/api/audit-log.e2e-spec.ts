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

  // Fase 4 item 2 (revision de cobertura de Audit) - LoginFailed.v1 es un caso de riesgo real:
  // aggregateId es command.email (string arbitrario), no un EntityId/UUID como el resto del
  // catalogo (login.handler.ts, "sin agregado que cambie de estado en un login fallido") -
  // nunca se habia verificado que ese shape distinto se audite correctamente.
  it('registra LoginFailed.v1 con subjectId = email (no UUID) y actorRef "system"', async () => {
    const taxId = `tax-audit-loginfail-${Date.now()}`;
    const registerResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company audit loginfail e2e ${taxId}`,
        taxId,
        billingContactEmail: 'billing@example.com',
      });
    const companyId: string = registerResponse.body.data.id;
    const admin = await seedAdminForCompany(companyId);

    const failedLoginResponse = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({ companyId, email: admin.adminEmail, password: 'ContraseñaIncorrecta!1' });
    expect(failedLoginResponse.status).toBe(401);

    const loginResponse = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({ companyId, email: admin.adminEmail, password: admin.adminPassword });
    const accessToken: string = loginResponse.body.data.accessToken;

    const entries = await pollAuditLog(baseUrl, accessToken, (current) =>
      current.some((e) => e.action === 'LoginFailed.v1'),
    );
    const loginFailed = entries.find((e) => e.action === 'LoginFailed.v1');
    expect(loginFailed).toMatchObject({
      subjectType: 'Session',
      subjectId: admin.adminEmail,
      actorRef: 'system',
    });
  });

  // ReservationRejectedByAvailability.v1 se publica en su PROPIA transaccion, independiente
  // de la del aggregate Reservation (confirm-reservation.handler.ts, "el evento se publica
  // sin tocar el agregado - permanece Draft") - nunca se habia verificado que ese publish
  // desacoplado igual llegue completo a Audit.
  it('registra ReservationRejectedByAvailability.v1 al confirmar 2 reservations superpuestas del mismo vehicle', async () => {
    const taxId = `tax-audit-rejected-${Date.now()}`;
    const registerResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company audit rejected e2e ${taxId}`,
        taxId,
        billingContactEmail: 'billing@example.com',
      });
    const companyId: string = registerResponse.body.data.id;
    const admin = await seedAdminForCompany(companyId);
    const loginResponse = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({ companyId, email: admin.adminEmail, password: admin.adminPassword });
    const accessToken: string = loginResponse.body.data.accessToken;
    const auth = (req: request.Test) => req.set('Authorization', `Bearer ${accessToken}`);

    const branchResponse = await auth(request(baseUrl).post('/api/v1/branches')).send({
      name: 'Sucursal audit rejected e2e',
      address: { line1: 'Av. Rejected 1', city: 'CDMX', country: 'MX' },
      operatingHours: [{ day: 'monday', open: '08:00', close: '18:00' }],
    });
    const branchId: string = branchResponse.body.data.id;

    const categoryResponse = await auth(request(baseUrl).post('/api/v1/vehicle-categories')).send({
      name: 'Economico audit rejected e2e',
    });
    const categoryId: string = categoryResponse.body.data.id;
    await auth(request(baseUrl).post(`/api/v1/vehicle-categories/${categoryId}/rates`)).send({
      amountMinorUnits: 50000,
      currency: 'USD',
      unit: 'Day',
      validFrom: '2026-01-01T00:00:00.000Z',
    });

    const vehicleResponse = await auth(request(baseUrl).post('/api/v1/vehicles')).send({
      branchId,
      vehicleCategoryId: categoryId,
      licensePlate: `AUD-${Date.now() % 100000}`,
      vin: '3HGCM82633A4447RJ',
    });
    const vehicleId: string = vehicleResponse.body.data.id;
    const vehicleDocResponse = await auth(
      request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/documents`),
    ).send({
      documentType: 'PropertyCard',
      fileId: 'file-e2e-vehicle-audit-rejected',
      expiryDate: '2030-01-01T00:00:00.000Z',
    });
    const vehicleDocumentId: string = vehicleDocResponse.body.data.id;
    await auth(
      request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/documents/${vehicleDocumentId}/verify`),
    );
    await auth(request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/enable`));

    async function createEligibleCustomer(suffix: string): Promise<string> {
      const customerResponse = await auth(request(baseUrl).post('/api/v1/customers')).send({
        name: `Cliente Audit Rejected E2E ${suffix}`,
        taxIdOrDocumentId: `doc-${taxId}-${suffix}`,
        contactEmail: `cliente-rejected-${suffix}-${Date.now()}@example.com`,
        contactPhone: '+525500000003',
        customerType: 'Individual',
      });
      const customerId: string = customerResponse.body.data.id;
      const identityDocResponse = await auth(
        request(baseUrl).post(`/api/v1/customers/${customerId}/identity-documents`),
      ).send({
        documentType: 'NationalId',
        fileId: `file-e2e-identity-audit-rejected-${suffix}`,
        expiryDate: '2030-01-01T00:00:00.000Z',
      });
      const identityDocumentId: string = identityDocResponse.body.data.id;
      await auth(
        request(baseUrl).post(
          `/api/v1/customers/${customerId}/identity-documents/${identityDocumentId}/verify`,
        ),
      );
      return customerId;
    }

    const customerAId = await createEligibleCustomer('A');
    const customerBId = await createEligibleCustomer('B');

    const startDate = '2026-12-10T10:00:00.000Z';
    const endDate = '2026-12-13T10:00:00.000Z';

    const reservationAResponse = await auth(request(baseUrl).post('/api/v1/reservations')).send({
      customerId: customerAId,
      vehicleId,
      startDate,
      endDate,
    });
    const reservationAId: string = reservationAResponse.body.data.id;
    const reservationBResponse = await auth(request(baseUrl).post('/api/v1/reservations')).send({
      customerId: customerBId,
      vehicleId,
      startDate,
      endDate,
    });
    const reservationBId: string = reservationBResponse.body.data.id;

    const confirmAResponse = await auth(
      request(baseUrl).post(`/api/v1/reservations/${reservationAId}/confirm`),
    );
    expect(confirmAResponse.status).toBe(201);

    const confirmBResponse = await auth(
      request(baseUrl).post(`/api/v1/reservations/${reservationBId}/confirm`),
    );
    expect(confirmBResponse.status).toBe(409);
    expect(confirmBResponse.body.code).toBe('VEHICLE_NOT_AVAILABLE');

    const entries = await pollAuditLog(baseUrl, accessToken, (current) =>
      current.some(
        (e) =>
          e.action === 'ReservationRejectedByAvailability.v1' && e.subjectId === reservationBId,
      ),
    );
    const rejected = entries.find(
      (e) => e.action === 'ReservationRejectedByAvailability.v1' && e.subjectId === reservationBId,
    );
    expect(rejected).toMatchObject({
      subjectType: 'Reservation',
      subjectId: reservationBId,
      actorRef: admin.adminUserId,
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
