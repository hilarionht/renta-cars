import request from 'supertest';

import { seedAdminForCompany } from '../support/seed-identity';

// Verifica de punta a punta el segundo item de Fase 1 (Alquiler de Vehiculos, MVP):
// registrar company -> registrar branch (POST /branches real) -> crear VehicleCategory +
// Rate -> registrar Vehicle (BRANCH_LOOKUP_PORT valida la branch, primer consumidor real
// del puerto) -> flujo real de Files (upload-url -> PUT a MinIO -> confirm-upload, mismo
// patron que customers-lifecycle.e2e-spec.ts) -> cargar y verificar el documento del
// vehicle -> enable() (INV-007) -> confirmar status: Available -> scheduleMaintenance() ->
// confirmar Maintenance -> startMaintenance() -> completeMaintenance(true) -> confirmar
// Available -> GET /audit-log confirma los eventos esperados.
describe('Vehicles: registro, documentacion, mantenimiento, y auditoria', () => {
  let baseUrl: string;

  beforeAll(() => {
    baseUrl = process.env.API_E2E_BASE_URL as string;
  });

  async function uploadAndConfirmFile(accessToken: string, contentBytes: Buffer): Promise<string> {
    const uploadUrlResponse = await request(baseUrl)
      .post('/api/v1/files/upload-url')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ contentType: 'image/png' });
    expect(uploadUrlResponse.status).toBe(201);
    const { storageRef, uploadUrl } = uploadUrlResponse.body.data;

    const putResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: new Uint8Array(contentBytes),
      headers: { 'Content-Type': 'image/png' },
    });
    expect(putResponse.ok).toBe(true);

    const confirmResponse = await request(baseUrl)
      .post('/api/v1/files/confirm-upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ storageRef, contentType: 'image/png' });
    expect(confirmResponse.status).toBe(201);
    return confirmResponse.body.data.id as string;
  }

  it('ciclo de vida completo de un Vehicle', async () => {
    const taxId = `tax-vehicles-e2e-${Date.now()}`;
    const registerCompanyResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company vehicles e2e ${taxId}`,
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

    const registerBranchResponse = await request(baseUrl)
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Sucursal e2e',
        address: { line1: 'Av. Principal 123', city: 'CDMX', country: 'MX' },
        operatingHours: [{ day: 'monday', open: '08:00', close: '18:00' }],
      });
    expect(registerBranchResponse.status).toBe(201);
    const branchId: string = registerBranchResponse.body.data.id;

    const createCategoryResponse = await request(baseUrl)
      .post('/api/v1/vehicle-categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Economico e2e' });
    expect(createCategoryResponse.status).toBe(201);
    const categoryId: string = createCategoryResponse.body.data.id;

    const addRateResponse = await request(baseUrl)
      .post(`/api/v1/vehicle-categories/${categoryId}/rates`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        amountMinorUnits: 50000,
        currency: 'MXN',
        unit: 'Day',
        validFrom: '2026-01-01T00:00:00.000Z',
      });
    expect(addRateResponse.status).toBe(201);

    const registerVehicleResponse = await request(baseUrl)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        branchId,
        vehicleCategoryId: categoryId,
        licensePlate: 'ZZZ-9999',
        vin: '2HGCM82633A654321',
      });
    expect(registerVehicleResponse.status).toBe(201);
    const vehicleId: string = registerVehicleResponse.body.data.id;

    const getInitialResponse = await request(baseUrl)
      .get(`/api/v1/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getInitialResponse.body.data.status).toBe('Registered');

    const fileId = await uploadAndConfirmFile(accessToken, Buffer.from('documento de prueba'));

    const uploadDocumentResponse = await request(baseUrl)
      .post(`/api/v1/vehicles/${vehicleId}/documents`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ documentType: 'PropertyCard', fileId, expiryDate: '2030-01-01T00:00:00.000Z' });
    expect(uploadDocumentResponse.status).toBe(201);
    const documentId: string = uploadDocumentResponse.body.data.id;

    const verifyDocumentResponse = await request(baseUrl)
      .post(`/api/v1/vehicles/${vehicleId}/documents/${documentId}/verify`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(verifyDocumentResponse.status).toBe(201);

    const enableResponse = await request(baseUrl)
      .post(`/api/v1/vehicles/${vehicleId}/enable`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(enableResponse.status).toBe(201);

    const getAfterEnableResponse = await request(baseUrl)
      .get(`/api/v1/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getAfterEnableResponse.body.data.status).toBe('Available');

    const scheduleMaintenanceResponse = await request(baseUrl)
      .post(`/api/v1/vehicles/${vehicleId}/maintenance`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: 'Preventive',
        scheduledStart: '2026-02-01T09:00:00.000Z',
        scheduledEnd: '2026-02-01T17:00:00.000Z',
      });
    expect(scheduleMaintenanceResponse.status).toBe(201);
    const maintenanceId: string = scheduleMaintenanceResponse.body.data.id;

    const getAfterScheduleResponse = await request(baseUrl)
      .get(`/api/v1/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getAfterScheduleResponse.body.data.status).toBe('Maintenance');

    const startMaintenanceResponse = await request(baseUrl)
      .post(`/api/v1/vehicles/${vehicleId}/maintenance/${maintenanceId}/start`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(startMaintenanceResponse.status).toBe(201);

    const completeMaintenanceResponse = await request(baseUrl)
      .post(`/api/v1/vehicles/${vehicleId}/maintenance/${maintenanceId}/complete`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fitForService: true });
    expect(completeMaintenanceResponse.status).toBe(201);

    const getFinalResponse = await request(baseUrl)
      .get(`/api/v1/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getFinalResponse.body.data.status).toBe('Available');

    const auditLogResponse = await request(baseUrl)
      .get('/api/v1/audit-log')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(auditLogResponse.status).toBe(200);
    const eventTypes: string[] = auditLogResponse.body.data.map(
      (entry: { action: string }) => entry.action,
    );
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        'VehicleRegistered.v1',
        'VehicleDocumentationLoaded.v1',
        'VehicleEnabled.v1',
        'MaintenanceScheduled.v1',
        'MaintenanceCompleted.v1',
        'VehicleCategoryCreated.v1',
        'RateChanged.v1',
      ]),
    );
    expect(eventTypes.filter((eventType) => eventType === 'VehicleStatusChanged.v1')).toHaveLength(
      2,
    );
  });
});
