import { createHash } from 'node:crypto';

import { Client } from 'pg';
import request from 'supertest';

import { farFutureExpiryDate, futureRentalWindow } from '../support/dates';
import { seedAdminForCompany } from '../support/seed-identity';

// docs/persistence/10-DECISIONES.md #137 (web de administracion, Incremento 3: Flota). Cubre lo
// que encontro la auditoria en vivo de Flota:
//   - D: datos de entrada invalidos responden 400 INVALID_VALUE (antes 500) y una categoria
//     repetida 409;
//   - A: un dano leve crea un mantenimiento correctivo y el vehiculo se recupera;
//   - B: mantenimiento, dano y fuera de servicio rechazan con 409 si dejarian sin auto a una
//     reserva confirmada;
//   - C: la reserva activa se deriva en la lectura, solo para el personal (nunca con token de
//     cliente, que usa el mismo GET /vehicles desde mobile, #116).
describe('Flota: validaciones, dano leve, conflictos con reservas y estado derivado', () => {
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

  // Mismo mecanismo que customer-self-service.e2e-spec.ts: el codigo OTP solo se persiste como
  // hash SHA-256, se recupera probando las 10^6 combinaciones.
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

  it('recorre los arreglos de Flota de punta a punta', async () => {
    const taxId = `tax-fleet-e2e-${Date.now()}`;
    const registerCompanyResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company fleet e2e ${taxId}`,
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
    const auth = (req: request.Test) =>
      req.set('Authorization', `Bearer ${loginResponse.body.data.accessToken as string}`);

    const branchResponse = await auth(request(baseUrl).post('/api/v1/branches')).send({
      name: 'Sucursal fleet e2e',
      address: { line1: 'Av. Principal 123', city: 'CABA', country: 'AR' },
      operatingHours: [{ day: 'monday', open: '08:00', close: '18:00' }],
    });
    expect(branchResponse.status).toBe(201);
    const branchId: string = branchResponse.body.data.id;

    // --- D: 400 INVALID_VALUE y 409 de categoria repetida
    const categoryResponse = await auth(request(baseUrl).post('/api/v1/vehicle-categories')).send({
      name: 'Economico fleet e2e',
    });
    expect(categoryResponse.status).toBe(201);
    const categoryId: string = categoryResponse.body.data.id;

    const duplicateCategory = await auth(request(baseUrl).post('/api/v1/vehicle-categories')).send({
      name: 'Economico fleet e2e',
    });
    expect(duplicateCategory.status).toBe(409);
    expect(duplicateCategory.body.code).toBe('DUPLICATE_VEHICLE_CATEGORY_NAME');

    const invalidCurrency = await auth(
      request(baseUrl).post(`/api/v1/vehicle-categories/${categoryId}/rates`),
    ).send({
      amountMinorUnits: 100,
      currency: 'XX',
      unit: 'Day',
      validFrom: '2026-01-01T00:00:00.000Z',
    });
    expect(invalidCurrency.status).toBe(400);
    expect(invalidCurrency.body.code).toBe('INVALID_VALUE');

    const invertedRate = await auth(
      request(baseUrl).post(`/api/v1/vehicle-categories/${categoryId}/rates`),
    ).send({
      amountMinorUnits: 100,
      currency: 'USD',
      unit: 'Day',
      validFrom: '2027-06-01T00:00:00.000Z',
      validTo: '2027-01-01T00:00:00.000Z',
    });
    expect(invertedRate.status).toBe(400);
    expect(invertedRate.body.code).toBe('INVALID_VALUE');

    const rateResponse = await auth(
      request(baseUrl).post(`/api/v1/vehicle-categories/${categoryId}/rates`),
    ).send({
      amountMinorUnits: 50000,
      currency: 'USD',
      unit: 'Day',
      validFrom: '2026-01-01T00:00:00.000Z',
    });
    expect(rateResponse.status).toBe(201);

    const invalidVin = await auth(request(baseUrl).post('/api/v1/vehicles')).send({
      branchId,
      vehicleCategoryId: categoryId,
      licensePlate: 'FLT-BAD',
      vin: '123',
    });
    expect(invalidVin.status).toBe(400);
    expect(invalidVin.body.code).toBe('INVALID_VALUE');

    // Vehiculo habilitado (documento verificado)
    const vehicleResponse = await auth(request(baseUrl).post('/api/v1/vehicles')).send({
      branchId,
      vehicleCategoryId: categoryId,
      licensePlate: 'FLT-0001',
      vin: '3HGCM82633A777001',
    });
    expect(vehicleResponse.status).toBe(201);
    const vehicleId: string = vehicleResponse.body.data.id;
    const documentResponse = await auth(
      request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/documents`),
    ).send({
      documentType: 'PropertyCard',
      fileId: 'file-e2e-fleet',
      expiryDate: farFutureExpiryDate(),
    });
    expect(documentResponse.status).toBe(201);
    await auth(
      request(baseUrl).post(
        `/api/v1/vehicles/${vehicleId}/documents/${documentResponse.body.data.id as string}/verify`,
      ),
    );
    expect((await auth(request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/enable`))).status).toBe(
      201,
    );

    const getVehicle = () => auth(request(baseUrl).get(`/api/v1/vehicles/${vehicleId}`));
    async function completeScheduled(type: string) {
      const vehicle = (await getVehicle()).body.data;
      const record = vehicle.maintenanceRecords.find(
        (candidate: { type: string; status: string }) =>
          candidate.type === type && candidate.status === 'Scheduled',
      );
      expect(record).toBeDefined();
      await auth(
        request(baseUrl).post(
          `/api/v1/vehicles/${vehicleId}/maintenance/${record.id as string}/start`,
        ),
      );
      const completed = await auth(
        request(baseUrl).post(
          `/api/v1/vehicles/${vehicleId}/maintenance/${record.id as string}/complete`,
        ),
      ).send({ fitForService: true });
      expect(completed.status).toBe(201);
    }

    // --- A: dano leve con mantenimiento correctivo, recuperable
    const minorDamage = await auth(
      request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/report-damage`),
    ).send({ severity: 'Minor', reason: 'raspon' });
    expect(minorDamage.status).toBe(201);
    expect((await getVehicle()).body.data.status).toBe('Maintenance');
    await completeScheduled('Corrective');
    expect((await getVehicle()).body.data.status).toBe('Available');

    // --- B: reserva confirmada a 60 dias
    // #139: ya canonico (+54 con el 9 de movil); el desafio OTP se guarda con este numero.
    const customerPhone = '+54911000077001';
    const customerResponse = await auth(request(baseUrl).post('/api/v1/customers')).send({
      name: 'Cliente fleet e2e',
      taxIdOrDocumentId: `doc-${taxId}`,
      contactEmail: 'cliente-fleet@example.com',
      contactPhone: customerPhone,
      customerType: 'Individual',
    });
    expect(customerResponse.status).toBe(201);
    const customerId: string = customerResponse.body.data.id;
    const identityDoc = await auth(
      request(baseUrl).post(`/api/v1/customers/${customerId}/identity-documents`),
    ).send({
      documentType: 'NationalId',
      fileId: 'file-e2e-fleet-id',
      expiryDate: farFutureExpiryDate(),
    });
    await auth(
      request(baseUrl).post(
        `/api/v1/customers/${customerId}/identity-documents/${identityDoc.body.data.id as string}/verify`,
      ),
    );

    const window = futureRentalWindow(60, 2);
    const reservationResponse = await auth(request(baseUrl).post('/api/v1/reservations')).send({
      customerId,
      vehicleId,
      startDate: window.startDate,
      endDate: window.endDate,
    });
    expect(reservationResponse.status).toBe(201);
    const reservationId: string = reservationResponse.body.data.id;
    expect(
      (await auth(request(baseUrl).post(`/api/v1/reservations/${reservationId}/confirm`))).status,
    ).toBe(201);

    const dayMs = 86_400_000;
    const blockingMaintenance = await auth(
      request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/maintenance`),
    ).send({
      type: 'Preventive',
      scheduledStart: new Date(window.start.getTime() - dayMs).toISOString(),
      scheduledEnd: new Date(window.start.getTime() + dayMs).toISOString(),
    });
    expect(blockingMaintenance.status).toBe(409);
    expect(blockingMaintenance.body.code).toBe('VEHICLE_HAS_ACTIVE_BOOKINGS');
    expect(blockingMaintenance.body.detail).toContain(reservationId);

    const severeDamage = await auth(
      request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/report-damage`),
    ).send({ severity: 'Severe' });
    expect(severeDamage.status).toBe(409);
    expect(severeDamage.body.code).toBe('VEHICLE_HAS_ACTIVE_BOOKINGS');

    const outOfService = await auth(
      request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/mark-out-of-service`),
    ).send({ reason: 'e2e' });
    expect(outOfService.status).toBe(409);
    expect((await getVehicle()).body.data.status).toBe('Available');

    // Un mantenimiento que termina antes de la reserva si se permite.
    const shortMaintenance = await auth(
      request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/maintenance`),
    ).send({
      type: 'Preventive',
      scheduledStart: new Date(Date.now() + dayMs).toISOString(),
      scheduledEnd: new Date(Date.now() + 2 * dayMs).toISOString(),
    });
    expect(shortMaintenance.status).toBe(201);
    await completeScheduled('Preventive');

    // --- C: reserva derivada para el personal
    const staffList = await auth(request(baseUrl).get('/api/v1/vehicles'));
    const listed = staffList.body.data.find((vehicle: { id: string }) => vehicle.id === vehicleId);
    expect(listed.activeReservation).toEqual(
      expect.objectContaining({ id: reservationId, status: 'Confirmed' }),
    );
    const staffDetail = (await getVehicle()).body.data;
    expect(staffDetail.activeReservations).toEqual([
      expect.objectContaining({ id: reservationId, status: 'Confirmed', overdue: false }),
    ]);

    // ... y nunca para un cliente
    const otpRequest = await request(baseUrl)
      .post('/api/v1/customers/auth/otp/request')
      .send({ companyId, phone: customerPhone });
    expect(otpRequest.status).toBe(201);
    const code = await recoverOtpCode(companyId, customerPhone);
    const verify = await request(baseUrl)
      .post('/api/v1/customers/auth/otp/verify')
      .send({ companyId, phone: customerPhone, code });
    expect(verify.status).toBe(201);
    const asCustomer = (req: request.Test) =>
      req.set('Authorization', `Bearer ${verify.body.data.accessToken as string}`);

    const customerList = await asCustomer(request(baseUrl).get('/api/v1/vehicles'));
    expect(customerList.status).toBe(200);
    for (const vehicle of customerList.body.data as Record<string, unknown>[]) {
      expect(vehicle).not.toHaveProperty('activeReservation');
    }
    const customerDetail = await asCustomer(request(baseUrl).get(`/api/v1/vehicles/${vehicleId}`));
    expect(customerDetail.status).toBe(200);
    expect(customerDetail.body.data).not.toHaveProperty('activeReservations');
  });
});
