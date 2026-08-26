import { createHash } from 'node:crypto';

import { Client } from 'pg';
import request from 'supertest';

import { seedAdminForCompany } from '../support/seed-identity';

// Fase 5 cliente-autogestion (docs/persistence/10-DECISIONES.md #109) - flujo completo
// desde el lado del Customer: OTP por WhatsApp (PROVIDER=fake en test) -> CustomerSession +
// access_token (actorType: 'Customer') -> crear/listar/cancelar reservas propias -> 404 al
// intentar tocar la reserva de otro customer (nunca se filtra su existencia). No hay forma
// de leer el codigo OTP en claro (solo se persiste su hash SHA-256, por diseño) - el test lo
// recupera fuerza-bruteando las 10^6 combinaciones posibles contra el hash persistido en
// rental.customer_otp_challenges, mismo principio que seed-identity.ts leyendo directo de
// Postgres (rol migrator, exento de RLS), pero sin necesitar ningun insert directo: los 2
// customers se registran via la API real (POST /api/v1/customers), igual que
// reservations-lifecycle.e2e-spec.ts.
describe('Customer self-service: OTP login -> crear/listar/cancelar reservas propias', () => {
  let baseUrl: string;
  let dbClient: Client;

  beforeAll(async () => {
    baseUrl = process.env.API_E2E_BASE_URL as string;
    dbClient = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await dbClient.connect();
  });

  afterAll(async () => {
    await dbClient.end();
  });

  async function recoverOtpCode(companyId: string, phone: string): Promise<string> {
    const result = await dbClient.query<{ code_hash: string }>(
      `SELECT code_hash FROM rental.customer_otp_challenges
       WHERE company_id = $1 AND phone = $2
       ORDER BY created_at DESC LIMIT 1`,
      [companyId, phone],
    );
    const targetHash = result.rows[0]?.code_hash;
    if (!targetHash) {
      throw new Error(`No se encontro un CustomerOtpChallenge para "${phone}".`);
    }
    for (let i = 0; i < 1_000_000; i++) {
      const code = i.toString().padStart(6, '0');
      if (createHash('sha256').update(code).digest('hex') === targetHash) {
        return code;
      }
    }
    throw new Error('No se pudo recuperar el codigo OTP a partir de su hash.');
  }

  async function loginAsCustomer(companyId: string, phone: string): Promise<string> {
    const requestOtpResponse = await request(baseUrl)
      .post('/api/v1/customers/auth/otp/request')
      .send({ companyId, phone });
    expect(requestOtpResponse.status).toBe(201);

    const code = await recoverOtpCode(companyId, phone);

    const verifyResponse = await request(baseUrl)
      .post('/api/v1/customers/auth/otp/verify')
      .send({ companyId, phone, code });
    expect(verifyResponse.status).toBe(201);
    return verifyResponse.body.data.accessToken as string;
  }

  it('ciclo completo de autogestion + aislamiento entre customers', async () => {
    const taxId = `tax-customer-self-service-e2e-${Date.now()}`;
    const registerCompanyResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company customer self-service e2e ${taxId}`,
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
    const staffToken: string = loginResponse.body.data.accessToken;
    const asStaff = (req: request.Test) => req.set('Authorization', `Bearer ${staffToken}`);

    const branchResponse = await asStaff(request(baseUrl).post('/api/v1/branches')).send({
      name: 'Sucursal customer self-service e2e',
      address: { line1: 'Av. Principal 123', city: 'CDMX', country: 'MX' },
      operatingHours: [{ day: 'monday', open: '08:00', close: '18:00' }],
    });
    expect(branchResponse.status).toBe(201);
    const branchId: string = branchResponse.body.data.id;

    const categoryResponse = await asStaff(
      request(baseUrl).post('/api/v1/vehicle-categories'),
    ).send({ name: 'Economico customer self-service e2e' });
    expect(categoryResponse.status).toBe(201);
    const categoryId: string = categoryResponse.body.data.id;

    const addRateResponse = await asStaff(
      request(baseUrl).post(`/api/v1/vehicle-categories/${categoryId}/rates`),
    ).send({
      amountMinorUnits: 50000,
      currency: 'USD',
      unit: 'Day',
      validFrom: '2026-01-01T00:00:00.000Z',
    });
    expect(addRateResponse.status).toBe(201);

    const vehicleResponse = await asStaff(request(baseUrl).post('/api/v1/vehicles')).send({
      branchId,
      vehicleCategoryId: categoryId,
      licensePlate: 'CSS-0001',
      vin: '3HGCM82633A999888',
    });
    expect(vehicleResponse.status).toBe(201);
    const vehicleId: string = vehicleResponse.body.data.id;

    // 2 customers reales via la API (POST /api/v1/customers, staff) - sin identity-document/
    // additional-driver: ninguno hace falta para create()/cancel() en Draft (INV-104/CUSTOMER_
    // NOT_ELIGIBLE solo aplica al intentar confirm()).
    const phoneA = '+525500000101';
    const phoneB = '+525500000102';
    const customerAResponse = await asStaff(request(baseUrl).post('/api/v1/customers')).send({
      name: 'Cliente A e2e',
      taxIdOrDocumentId: `doc-a-${taxId}`,
      contactEmail: 'cliente-a@example.com',
      contactPhone: phoneA,
      customerType: 'Individual',
    });
    expect(customerAResponse.status).toBe(201);

    const customerBResponse = await asStaff(request(baseUrl).post('/api/v1/customers')).send({
      name: 'Cliente B e2e',
      taxIdOrDocumentId: `doc-b-${taxId}`,
      contactEmail: 'cliente-b@example.com',
      contactPhone: phoneB,
      customerType: 'Individual',
    });
    expect(customerBResponse.status).toBe(201);

    const tokenA = await loginAsCustomer(companyId, phoneA);
    const tokenB = await loginAsCustomer(companyId, phoneB);
    const asCustomerA = (req: request.Test) => req.set('Authorization', `Bearer ${tokenA}`);
    const asCustomerB = (req: request.Test) => req.set('Authorization', `Bearer ${tokenB}`);

    // Crear - customerId siempre forzado del access_token, nunca del body.
    const createResponse = await asCustomerA(request(baseUrl).post('/api/v1/me/reservations')).send(
      {
        vehicleId,
        startDate: '2026-09-01T10:00:00.000Z',
        endDate: '2026-09-04T10:00:00.000Z',
      },
    );
    expect(createResponse.status).toBe(201);
    const reservationId: string = createResponse.body.data.id;

    // Listar - solo aparecen las reservas propias.
    const listResponse = await asCustomerA(request(baseUrl).get('/api/v1/me/reservations'));
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.data[0].id).toBe(reservationId);

    const listAsBResponse = await asCustomerB(request(baseUrl).get('/api/v1/me/reservations'));
    expect(listAsBResponse.status).toBe(200);
    expect(listAsBResponse.body.data).toHaveLength(0);

    // Ownership: B nunca puede ver ni cancelar la reserva de A - mismo codigo que "no existe".
    const getAsBResponse = await asCustomerB(
      request(baseUrl).get(`/api/v1/me/reservations/${reservationId}`),
    );
    expect(getAsBResponse.status).toBe(404);
    expect(getAsBResponse.body.code).toBe('RESOURCE_NOT_FOUND');

    const cancelAsBResponse = await asCustomerB(
      request(baseUrl).post(`/api/v1/me/reservations/${reservationId}/cancel`),
    );
    expect(cancelAsBResponse.status).toBe(404);
    expect(cancelAsBResponse.body.code).toBe('RESOURCE_NOT_FOUND');

    // A si puede ver y cancelar la propia.
    const getAsAResponse = await asCustomerA(
      request(baseUrl).get(`/api/v1/me/reservations/${reservationId}`),
    );
    expect(getAsAResponse.status).toBe(200);
    expect(getAsAResponse.body.data.status).toBe('Draft');

    const cancelAsAResponse = await asCustomerA(
      request(baseUrl).post(`/api/v1/me/reservations/${reservationId}/cancel`),
    );
    expect(cancelAsAResponse.status).toBe(201);

    const getAfterCancelResponse = await asCustomerA(
      request(baseUrl).get(`/api/v1/me/reservations/${reservationId}`),
    );
    expect(getAfterCancelResponse.body.data.status).toBe('Cancelled');
  });

  it('un access_token de staff (sin actorType Customer) nunca puede alcanzar /me/reservations', async () => {
    const taxId = `tax-customer-self-service-staff-e2e-${Date.now()}`;
    const registerCompanyResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company staff-actor e2e ${taxId}`,
        taxId,
        billingContactEmail: 'billing@example.com',
      });
    const companyId: string = registerCompanyResponse.body.data.id;
    const admin = await seedAdminForCompany(companyId);
    const loginResponse = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({ companyId, email: admin.adminEmail, password: admin.adminPassword });
    const staffToken: string = loginResponse.body.data.accessToken;

    const response = await request(baseUrl)
      .get('/api/v1/me/reservations')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });
});
