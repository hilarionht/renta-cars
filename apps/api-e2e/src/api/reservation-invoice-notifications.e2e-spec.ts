import request from 'supertest';

import { seedAdminForCompany } from '../support/seed-identity';

interface NotificationSummary {
  id: string;
  kind: string;
  status: string;
  recipientEmail?: string;
  templateId: string;
  channel?: string;
}

// ReservationConfirmedNotificationListener/InvoiceIssuedNotificationListener reaccionan a
// ReservationConfirmed.v1/InvoiceIssued.v1 via EventEmitter2.emit() (fire-and-forget,
// docs/persistence/10-DECISIONES.md #20) - consistencia eventual, mismo criterio de polling
// corto que audit-log.e2e-spec.ts/invoices-lifecycle.e2e-spec.ts.
async function pollNotifications(
  baseUrl: string,
  accessToken: string,
  predicate: (items: NotificationSummary[]) => boolean,
  { timeoutMs = 5000, intervalMs = 100 } = {},
): Promise<NotificationSummary[]> {
  const deadline = Date.now() + timeoutMs;
  let items: NotificationSummary[] = [];
  do {
    const response = await request(baseUrl)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${accessToken}`);
    items = response.body.data;
    if (predicate(items)) return items;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (Date.now() < deadline);
  return items;
}

// Verifica de punta a punta Fase 3 item 3 (docs/01-ROADMAP.md SS5): confirmar una Reservation
// y emitir su Invoice (check-in sin dano ni deficit de combustible) disparan, cada uno, una
// Notification real (kind/templateId correctos) via el adaptador fake
// (NOTIFICATION_SENDER_PROVIDER=fake por defecto).
describe('Reservations/Invoices -> Notifications (Fase 3 item 3)', () => {
  let baseUrl: string;

  beforeAll(() => {
    baseUrl = process.env.API_E2E_BASE_URL as string;
  });

  it('confirmar una reservation notifica Confirmation, y emitir su invoice notifica Receipt', async () => {
    const taxId = `tax-notif-e2e-${Date.now()}`;
    const registerCompanyResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company notif e2e ${taxId}`,
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
      name: 'Sucursal notif e2e',
      address: { line1: 'Av. Principal 456', city: 'CDMX', country: 'MX' },
      operatingHours: [{ day: 'monday', open: '08:00', close: '18:00' }],
    });
    expect(branchResponse.status).toBe(201);
    const branchId: string = branchResponse.body.data.id;

    const customerEmail = `cliente-notif-${Date.now()}@example.com`;
    const customerResponse = await auth(request(baseUrl).post('/api/v1/customers')).send({
      name: 'Cliente Notif E2E',
      taxIdOrDocumentId: `doc-${taxId}`,
      contactEmail: customerEmail,
      contactPhone: '+525500000001',
      customerType: 'Individual',
    });
    expect(customerResponse.status).toBe(201);
    const customerId: string = customerResponse.body.data.id;

    const identityDocResponse = await auth(
      request(baseUrl).post(`/api/v1/customers/${customerId}/identity-documents`),
    ).send({
      documentType: 'NationalId',
      fileId: 'file-e2e-identity-notif',
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
      name: 'Economico notif e2e',
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
      licensePlate: 'NOT-0001',
      vin: '3HGCM82633A444666',
    });
    expect(vehicleResponse.status).toBe(201);
    const vehicleId: string = vehicleResponse.body.data.id;

    const vehicleDocResponse = await auth(
      request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/documents`),
    ).send({
      documentType: 'PropertyCard',
      fileId: 'file-e2e-vehicle-notif',
      expiryDate: '2030-01-01T00:00:00.000Z',
    });
    expect(vehicleDocResponse.status).toBe(201);
    const vehicleDocumentId: string = vehicleDocResponse.body.data.id;
    await auth(
      request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/documents/${vehicleDocumentId}/verify`),
    );
    await auth(request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/enable`));

    const startDate = '2026-10-15T10:00:00.000Z';
    const endDate = '2026-10-18T10:00:00.000Z';

    const createReservationResponse = await auth(
      request(baseUrl).post('/api/v1/reservations'),
    ).send({ customerId, vehicleId, startDate, endDate });
    expect(createReservationResponse.status).toBe(201);
    const reservationId: string = createReservationResponse.body.data.id;

    const confirmResponse = await auth(
      request(baseUrl).post(`/api/v1/reservations/${reservationId}/confirm`),
    );
    expect(confirmResponse.status).toBe(201);

    const confirmationNotifications = await pollNotifications(baseUrl, accessToken, (items) =>
      items.some(
        (item) =>
          item.recipientEmail === customerEmail &&
          item.templateId === 'reservation-confirmed' &&
          item.status === 'Sent',
      ),
    );
    const confirmation = confirmationNotifications.find(
      (item) =>
        item.recipientEmail === customerEmail && item.templateId === 'reservation-confirmed',
    );
    expect(confirmation).toMatchObject({
      kind: 'Confirmation',
      status: 'Sent',
      templateId: 'reservation-confirmed',
      channel: 'Email',
    });

    await auth(request(baseUrl).post(`/api/v1/reservations/${reservationId}/check-out`)).send({
      odometer: 2000,
      fuelLevelPercentage: 100,
      photoFileIds: ['file-e2e-checkout-notif'],
      inspectedBy: admin.adminUserId,
    });

    const checkInResponse = await auth(
      request(baseUrl).post(`/api/v1/reservations/${reservationId}/check-in`),
    ).send({
      odometer: 2300,
      fuelLevelPercentage: 100,
      photoFileIds: ['file-e2e-checkin-notif'],
      inspectedBy: admin.adminUserId,
      damages: [],
    });
    expect(checkInResponse.status).toBe(201);

    const receiptNotifications = await pollNotifications(baseUrl, accessToken, (items) =>
      items.some(
        (item) =>
          item.recipientEmail === customerEmail &&
          item.templateId === 'invoice-receipt' &&
          item.status === 'Sent',
      ),
    );
    const receipt = receiptNotifications.find(
      (item) => item.recipientEmail === customerEmail && item.templateId === 'invoice-receipt',
    );
    expect(receipt).toMatchObject({
      kind: 'Receipt',
      status: 'Sent',
      templateId: 'invoice-receipt',
      channel: 'Email',
    });
  });
});
