import request from 'supertest';

import { seedAdminForCompany } from '../support/seed-identity';

// Paginacion por cursor de GET /reservations (docs/persistence/10-DECISIONES.md #112) -
// CreateReservationHandler no chequea solapamiento en Draft (solo confirm() lo hace, ver
// reservations-lifecycle.e2e-spec.ts), asi que no hace falta variar fechas entre las 5
// reservas creadas para este test.
describe('Reservations: paginacion por cursor de GET /reservations', () => {
  let baseUrl: string;

  beforeAll(() => {
    baseUrl = process.env.API_E2E_BASE_URL as string;
  });

  it('recorre todas las paginas sin repetir ids, y la ultima pagina tiene nextCursor null', async () => {
    const taxId = `tax-reservations-pagination-e2e-${Date.now()}`;
    const registerCompanyResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company reservations pagination e2e ${taxId}`,
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
      name: 'Sucursal pagination e2e',
      address: { line1: 'Av. Principal 123', city: 'CDMX', country: 'MX' },
      operatingHours: [{ day: 'monday', open: '08:00', close: '18:00' }],
    });
    expect(branchResponse.status).toBe(201);
    const branchId: string = branchResponse.body.data.id;

    const customerResponse = await auth(request(baseUrl).post('/api/v1/customers')).send({
      name: 'Cliente pagination e2e',
      taxIdOrDocumentId: `doc-${taxId}`,
      contactEmail: 'cliente-pagination@example.com',
      contactPhone: '+525500000001',
      customerType: 'Individual',
    });
    expect(customerResponse.status).toBe(201);
    const customerId: string = customerResponse.body.data.id;

    const categoryResponse = await auth(request(baseUrl).post('/api/v1/vehicle-categories')).send({
      name: 'Economico pagination e2e',
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
      licensePlate: 'PAG-0001',
      vin: '3HGCM82633A111333',
    });
    expect(vehicleResponse.status).toBe(201);
    const vehicleId: string = vehicleResponse.body.data.id;

    // Draft no chequea solapamiento - 5 reservas identicas sobre el mismo vehiculo/fechas.
    const totalReservations = 5;
    const createdIds = new Set<string>();
    for (let i = 0; i < totalReservations; i += 1) {
      const createResponse = await auth(request(baseUrl).post('/api/v1/reservations')).send({
        customerId,
        vehicleId,
        startDate: '2026-09-01T10:00:00.000Z',
        endDate: '2026-09-04T10:00:00.000Z',
      });
      expect(createResponse.status).toBe(201);
      createdIds.add(createResponse.body.data.id);
    }

    const collectedIds = new Set<string>();
    let cursor: string | undefined;
    let pageCount = 0;

    do {
      const query = cursor
        ? `?customerId=${customerId}&limit=2&cursor=${encodeURIComponent(cursor)}`
        : `?customerId=${customerId}&limit=2`;
      const listResponse = await auth(request(baseUrl).get(`/api/v1/reservations${query}`));
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.meta.limit).toBe(2);

      for (const item of listResponse.body.data as { id: string }[]) {
        expect(collectedIds.has(item.id)).toBe(false);
        collectedIds.add(item.id);
      }

      cursor = listResponse.body.meta.nextCursor ?? undefined;
      pageCount += 1;
      expect(pageCount).toBeLessThan(10); // corta un loop infinito si algo sale mal
    } while (cursor);

    expect(collectedIds.size).toBe(totalReservations);
    expect(collectedIds).toEqual(createdIds);

    const invalidCursorResponse = await auth(
      request(baseUrl).get('/api/v1/reservations?cursor=cursor-invalido-no-base64url-json'),
    );
    expect(invalidCursorResponse.status).toBe(400);
    expect(invalidCursorResponse.body.code).toBe('VALIDATION_FAILED');
  });
});
