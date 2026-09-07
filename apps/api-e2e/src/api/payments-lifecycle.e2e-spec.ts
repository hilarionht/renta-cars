import request from 'supertest';

import { seedAdminForCompany } from '../support/seed-identity';

interface SecurityDepositSummary {
  id: string;
  reservationId: string;
  status: string;
  amountMinorUnits: number;
  retainedAmountMinorUnits?: number;
}

// SecurityDepositHoldListener/SecurityDepositResolveListener reaccionan a
// ReservationConfirmed.v1/ReservationCheckedIn.v1 via EventEmitter2.emit() (fire-and-forget,
// docs/persistence/10-DECISIONES.md #20) - consistencia eventual respecto al request HTTP que
// disparo el evento, mismo criterio ya confirmado flaky en audit-log.e2e-spec.ts si se lee de
// forma sincronica. Se hace polling corto en vez de una unica lectura.
async function pollSecurityDeposits(
  baseUrl: string,
  accessToken: string,
  reservationId: string,
  predicate: (deposits: SecurityDepositSummary[]) => boolean,
  { timeoutMs = 5000, intervalMs = 100 } = {},
): Promise<SecurityDepositSummary[]> {
  const deadline = Date.now() + timeoutMs;
  let deposits: SecurityDepositSummary[] = [];
  do {
    const response = await request(baseUrl)
      .get(`/api/v1/security-deposits?reservationId=${reservationId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    deposits = response.body.data;
    if (predicate(deposits)) return deposits;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (Date.now() < deadline);
  return deposits;
}

// Verifica de punta a punta el primer item de Fase 2 (docs/01-ROADMAP.md SS4): el flujo
// 100% event-driven de SecurityDeposit (hold automatico en confirm(), retain automatico en
// check-in con dano) y el flujo manual de Payment (request -> capture directo, adaptador
// "fake" via PAYMENT_GATEWAY_PROVIDER, Cash salta authorize() por completo - RN-24).
describe('Payments: SecurityDeposit event-driven + Payment manual', () => {
  let baseUrl: string;

  beforeAll(() => {
    baseUrl = process.env.API_E2E_BASE_URL as string;
  });

  it('confirm() retiene un SecurityDeposit, check-in con dano lo retiene parcialmente, y un Payment manual completa capture+refund', async () => {
    const taxId = `tax-payments-e2e-${Date.now()}`;
    const registerCompanyResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company payments e2e ${taxId}`,
        taxId,
        billingContactEmail: 'billing@example.com',
      });
    expect(registerCompanyResponse.status).toBe(201);
    const companyId: string = registerCompanyResponse.body.data.id;

    const admin = await seedAdminForCompany(companyId);
    const loginResponse = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({ companyId, email: admin.adminEmail, password: admin.adminPassword });
    expect(loginResponse.status).toBe(201);
    const accessToken: string = loginResponse.body.data.accessToken;
    const auth = (req: request.Test) => req.set('Authorization', `Bearer ${accessToken}`);

    // DepositPolicy.applies=false por default (Decision #59) - sin este PATCH,
    // SecurityDepositHoldListener nunca crea nada.
    const depositPolicyResponse = await auth(
      request(baseUrl).patch('/api/v1/company-settings/deposit-policy'),
    ).send({ applies: true, percentageOfTotal: 20 });
    expect(depositPolicyResponse.status).toBe(200);

    const branchResponse = await auth(request(baseUrl).post('/api/v1/branches')).send({
      name: 'Sucursal payments e2e',
      address: { line1: 'Av. Principal 123', city: 'CDMX', country: 'MX' },
      operatingHours: [{ day: 'monday', open: '08:00', close: '18:00' }],
    });
    expect(branchResponse.status).toBe(201);
    const branchId: string = branchResponse.body.data.id;

    const customerResponse = await auth(request(baseUrl).post('/api/v1/customers')).send({
      name: 'Cliente e2e',
      taxIdOrDocumentId: `doc-${taxId}`,
      contactEmail: 'cliente@example.com',
      contactPhone: '+525500000000',
      customerType: 'Individual',
    });
    expect(customerResponse.status).toBe(201);
    const customerId: string = customerResponse.body.data.id;

    const identityDocResponse = await auth(
      request(baseUrl).post(`/api/v1/customers/${customerId}/identity-documents`),
    ).send({
      documentType: 'NationalId',
      fileId: 'file-e2e-identity',
      expiryDate: '2030-01-01T00:00:00.000Z',
    });
    expect(identityDocResponse.status).toBe(201);
    const identityDocumentId: string = identityDocResponse.body.data.id;
    await auth(
      request(baseUrl).post(
        `/api/v1/customers/${customerId}/identity-documents/${identityDocumentId}/verify`,
      ),
    );

    const categoryResponse = await auth(request(baseUrl).post('/api/v1/vehicle-categories')).send({
      name: 'Economico payments e2e',
    });
    expect(categoryResponse.status).toBe(201);
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
      licensePlate: 'PAY-0001',
      vin: '3HGCM82633A333444',
    });
    expect(vehicleResponse.status).toBe(201);
    const vehicleId: string = vehicleResponse.body.data.id;

    const vehicleDocResponse = await auth(
      request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/documents`),
    ).send({
      documentType: 'PropertyCard',
      fileId: 'file-e2e-vehicle',
      expiryDate: '2030-01-01T00:00:00.000Z',
    });
    expect(vehicleDocResponse.status).toBe(201);
    const vehicleDocumentId: string = vehicleDocResponse.body.data.id;
    await auth(
      request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/documents/${vehicleDocumentId}/verify`),
    );
    await auth(request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/enable`));

    const startDate = '2026-09-10T10:00:00.000Z';
    const endDate = '2026-09-13T10:00:00.000Z';

    const createReservationResponse = await auth(
      request(baseUrl).post('/api/v1/reservations'),
    ).send({ customerId, vehicleId, startDate, endDate });
    expect(createReservationResponse.status).toBe(201);
    const reservationId: string = createReservationResponse.body.data.id;

    // Confirmed -> SecurityDepositHoldListener crea el deposit: 20% de 150000 = 30000.
    const confirmResponse = await auth(
      request(baseUrl).post(`/api/v1/reservations/${reservationId}/confirm`),
    );
    expect(confirmResponse.status).toBe(201);

    const heldDeposits = await pollSecurityDeposits(
      baseUrl,
      accessToken,
      reservationId,
      (deposits) => deposits.length > 0,
    );
    expect(heldDeposits).toHaveLength(1);
    expect(heldDeposits[0]).toMatchObject({ status: 'Held', amountMinorUnits: 30000 });
    const securityDepositId = heldDeposits[0].id;

    // CheckedOut -> CheckedIn con dano -> SecurityDepositResolveListener retiene.
    await auth(request(baseUrl).post(`/api/v1/reservations/${reservationId}/check-out`)).send({
      odometer: 1000,
      fuelLevelPercentage: 100,
      photoFileIds: ['file-e2e-checkout'],
      inspectedBy: admin.adminUserId,
    });

    const checkInResponse = await auth(
      request(baseUrl).post(`/api/v1/reservations/${reservationId}/check-in`),
    ).send({
      odometer: 1300,
      fuelLevelPercentage: 80,
      photoFileIds: ['file-e2e-checkin'],
      inspectedBy: admin.adminUserId,
      damages: [
        {
          description: 'rayón puerta trasera',
          severity: 'Minor',
          imputableToCustomer: true,
          photoFileIds: ['file-e2e-damage'],
          penaltyAmountMinorUnits: 2500,
        },
      ],
    });
    expect(checkInResponse.status).toBe(201);

    const retainedDeposits = await pollSecurityDeposits(
      baseUrl,
      accessToken,
      reservationId,
      (deposits) => deposits[0]?.status === 'RetainedPartially',
    );
    expect(retainedDeposits[0]).toMatchObject({
      status: 'RetainedPartially',
      retainedAmountMinorUnits: 2500,
    });

    // Manual override tambien esta expuesto - release() sobre un deposit ya resuelto es
    // rechazado (INV-020).
    const releaseAlreadyResolvedResponse = await auth(
      request(baseUrl).post(`/api/v1/security-deposits/${securityDepositId}/release`),
    );
    expect(releaseAlreadyResolvedResponse.status).toBe(409);
    expect(releaseAlreadyResolvedResponse.body.code).toBe('DEPOSIT_ALREADY_RESOLVED');

    // Flujo manual de Payment - Cash salta authorize() por completo (RN-24), capture directo.
    const requestPaymentResponse = await auth(request(baseUrl).post('/api/v1/payments')).send({
      targetType: 'SecurityDeposit',
      targetId: securityDepositId,
      amountMinorUnits: 2500,
      currency: 'USD',
      method: 'Cash',
      idempotencyKey: `idem-${reservationId}`,
    });
    expect(requestPaymentResponse.status).toBe(201);
    const paymentId: string = requestPaymentResponse.body.data.id;

    const getRequestedResponse = await auth(request(baseUrl).get(`/api/v1/payments/${paymentId}`));
    expect(getRequestedResponse.body.data.status).toBe('Requested');

    const captureResponse = await auth(
      request(baseUrl).post(`/api/v1/payments/${paymentId}/capture`),
    );
    expect(captureResponse.status).toBe(201);

    const getCapturedResponse = await auth(request(baseUrl).get(`/api/v1/payments/${paymentId}`));
    expect(getCapturedResponse.body.data.status).toBe('Captured');

    const refundResponse = await auth(
      request(baseUrl).post(`/api/v1/payments/${paymentId}/refund`),
    );
    expect(refundResponse.status).toBe(201);

    const getRefundedResponse = await auth(request(baseUrl).get(`/api/v1/payments/${paymentId}`));
    expect(getRefundedResponse.body.data.status).toBe('Refunded');

    // Reintentar el mismo idempotencyKey - INV-021, doble capa (aplicacion + UNIQUE).
    const duplicateRequestResponse = await auth(request(baseUrl).post('/api/v1/payments')).send({
      targetType: 'SecurityDeposit',
      targetId: securityDepositId,
      amountMinorUnits: 2500,
      currency: 'USD',
      method: 'Cash',
      idempotencyKey: `idem-${reservationId}`,
    });
    expect(duplicateRequestResponse.status).toBe(409);
    expect(duplicateRequestResponse.body.code).toBe('PAYMENT_ALREADY_PROCESSED');

    const auditLogResponse = await auth(request(baseUrl).get('/api/v1/audit-log'));
    const eventTypes: string[] = auditLogResponse.body.data.map(
      (entry: { action: string }) => entry.action,
    );
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        'SecurityDepositHeld.v1',
        'SecurityDepositPartiallyRetained.v1',
        'PaymentSucceeded.v1',
        'PaymentRefunded.v1',
      ]),
    );
  });
});
