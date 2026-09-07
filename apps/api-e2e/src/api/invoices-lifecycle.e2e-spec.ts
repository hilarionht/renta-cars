import request from 'supertest';

import { seedAdminForCompany } from '../support/seed-identity';

interface InvoiceChargeSummary {
  kind: string;
  amountMinorUnits: number;
  description: string;
}

interface InvoiceSummary {
  id: string;
  reservationId: string;
  status: string;
  invoiceNumber: string;
  totalMinorUnits: number;
  charges: InvoiceChargeSummary[];
}

// InvoiceIssuedFromCheckInListener/InvoiceIssuedListener reaccionan a
// ReservationCheckedIn.v1/InvoiceIssued.v1 via EventEmitter2.emit() (fire-and-forget,
// docs/persistence/10-DECISIONES.md #20) - consistencia eventual, mismo criterio de polling
// corto que audit-log.e2e-spec.ts/payments-lifecycle.e2e-spec.ts.
async function pollInvoices(
  baseUrl: string,
  accessToken: string,
  reservationId: string,
  predicate: (invoices: InvoiceSummary[]) => boolean,
  { timeoutMs = 5000, intervalMs = 100 } = {},
): Promise<InvoiceSummary[]> {
  const deadline = Date.now() + timeoutMs;
  let invoices: InvoiceSummary[] = [];
  do {
    const response = await request(baseUrl)
      .get(`/api/v1/invoices?reservationId=${reservationId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    invoices = response.body.data;
    if (predicate(invoices)) return invoices;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (Date.now() < deadline);
  return invoices;
}

async function pollReservationStatus(
  baseUrl: string,
  accessToken: string,
  reservationId: string,
  expectedStatus: string,
  { timeoutMs = 5000, intervalMs = 100 } = {},
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let status = '';
  do {
    const response = await request(baseUrl)
      .get(`/api/v1/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    status = response.body.data.status;
    if (status === expectedStatus) return status;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (Date.now() < deadline);
  return status;
}

// Verifica de punta a punta el segundo y ultimo item de Fase 2 (docs/01-ROADMAP.md SS4): la
// emision 100% event-driven de Invoice (check-in con dano -> RentalFee + Penalty) y el cierre
// del ciclo de vida completo de Reservation que Fase 1 dejo pendiente a proposito
// (docs/persistence/10-DECISIONES.md #69/#79) - Draft -> Confirmed -> CheckedOut -> CheckedIn
// -> Closed, disparado automaticamente por InvoiceIssued.v1.
describe('Invoices: emision event-driven + cierre automatico de Reservation', () => {
  let baseUrl: string;

  beforeAll(() => {
    baseUrl = process.env.API_E2E_BASE_URL as string;
  });

  it('check-in con dano y combustible incompleto emite una Invoice con RentalFee+Damage+Fuel, cierra la Reservation, y void() la anula', async () => {
    const taxId = `tax-invoices-e2e-${Date.now()}`;
    const registerCompanyResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company invoices e2e ${taxId}`,
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

    const branchResponse = await auth(request(baseUrl).post('/api/v1/branches')).send({
      name: 'Sucursal invoices e2e',
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
      name: 'Economico invoices e2e',
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
      licensePlate: 'INV-0001',
      vin: '3HGCM82633A444555',
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

    const startDate = '2026-09-15T10:00:00.000Z';
    const endDate = '2026-09-18T10:00:00.000Z';

    const createReservationResponse = await auth(
      request(baseUrl).post('/api/v1/reservations'),
    ).send({ customerId, vehicleId, startDate, endDate });
    expect(createReservationResponse.status).toBe(201);
    const reservationId: string = createReservationResponse.body.data.id;

    await auth(request(baseUrl).post(`/api/v1/reservations/${reservationId}/confirm`));

    await auth(request(baseUrl).post(`/api/v1/reservations/${reservationId}/check-out`)).send({
      odometer: 1000,
      fuelLevelPercentage: 100,
      photoFileIds: ['file-e2e-checkout'],
      inspectedBy: admin.adminUserId,
    });

    // CheckedIn con dano y combustible incompleto -> InvoiceIssuedFromCheckInListener emite
    // RentalFee (150000) + Damage (2500, DamagePenalty -> Damage) + Fuel (10000, 20% de
    // deficit sobre la tarifa diaria de 50000 - PricingService.calculateFuelDifferenceCharge(),
    // FuelDifference -> Fuel).
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

    const issuedInvoices = await pollInvoices(
      baseUrl,
      accessToken,
      reservationId,
      (invoices) => invoices.length > 0,
    );
    expect(issuedInvoices).toHaveLength(1);
    const invoice = issuedInvoices[0];
    expect(invoice.status).toBe('Issued');
    expect(invoice.invoiceNumber).toMatch(/^INV-\d{8}$/);
    expect(invoice.totalMinorUnits).toBe(162500);
    expect(invoice.charges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'RentalFee', amountMinorUnits: 150000 }),
        expect.objectContaining({ kind: 'Damage', amountMinorUnits: 2500 }),
        expect.objectContaining({ kind: 'Fuel', amountMinorUnits: 10000 }),
      ]),
    );

    // InvoiceIssued.v1 -> InvoiceIssuedListener (reservations) -> CloseReservationHandler,
    // unico disparador real ahora que Invoice existe de verdad (docs/persistence/
    // 10-DECISIONES.md #79).
    const closedStatus = await pollReservationStatus(baseUrl, accessToken, reservationId, 'Closed');
    expect(closedStatus).toBe('Closed');

    const voidResponse = await auth(
      request(baseUrl).post(`/api/v1/invoices/${invoice.id}/void`),
    ).send({ reason: 'error de tipificacion fiscal' });
    expect(voidResponse.status).toBe(201);

    const getVoidedResponse = await auth(request(baseUrl).get(`/api/v1/invoices/${invoice.id}`));
    expect(getVoidedResponse.body.data).toMatchObject({
      status: 'Voided',
      voidReason: 'error de tipificacion fiscal',
    });

    const auditLogResponse = await auth(request(baseUrl).get('/api/v1/audit-log'));
    const eventTypes: string[] = auditLogResponse.body.data.map(
      (entry: { action: string }) => entry.action,
    );
    expect(eventTypes).toEqual(
      expect.arrayContaining(['InvoiceIssued.v1', 'ReservationClosed.v1', 'InvoiceVoided.v1']),
    );
  });
});
