import request from 'supertest';

import { seedAdminForCompany } from '../support/seed-identity';

// Verifica de punta a punta el primer item de Fase 1 (Alquiler de Vehiculos, MVP) y el
// primer modulo scope:product-rental del proyecto: registrar company -> habilitar/probar el
// gate de TenantModuleEnabledGuard (primer consumidor real de @RequiresProductModule(), sin
// ejercitar durante toda la Fase 0) -> registrar customer -> flujo real de Files
// (upload-url -> PUT a MinIO -> confirm-upload, mismo patron que
// files-upload-signed-url-delete.e2e-spec.ts) -> cargar y verificar el documento propio ->
// confirmar el efecto lateral status: Registered -> Active -> conductor adicional ->
// validate-license falla 422 sin licencia (INV-012) -> cargar y verificar la licencia ->
// validate-license OK -> block/unblock -> GET /audit-log confirma los 7 eventos.
describe('Customers: registro, documentacion, conductor adicional, bloqueo, y auditoria', () => {
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

  it('ciclo de vida completo de un Customer', async () => {
    const taxId = `tax-customers-e2e-${Date.now()}`;
    const registerCompanyResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company customers e2e ${taxId}`,
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

    // CompanySettings se crea junto con Company con EnabledProductModules=['Rental'] por
    // defecto (docs/persistence/10-DECISIONES.md) - se prueba el gate real desactivandolo
    // primero, no asumiendo que ya esta desactivado.
    const disableRentalResponse = await request(baseUrl)
      .patch('/api/v1/company-settings/enabled-product-modules')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ enabledProductModules: ['Workshop'] });
    expect(disableRentalResponse.status).toBe(200);

    const gatedResponse = await request(baseUrl)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Cliente Bloqueado',
        taxIdOrDocumentId: 'DOC-GATED',
        contactEmail: 'gated@example.com',
        contactPhone: '+525512345678',
        customerType: 'Individual',
      });
    expect(gatedResponse.status).toBe(403);
    expect(gatedResponse.body.code).toBe('PRODUCT_MODULE_NOT_ENABLED');

    const enableRentalResponse = await request(baseUrl)
      .patch('/api/v1/company-settings/enabled-product-modules')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ enabledProductModules: ['Rental'] });
    expect(enableRentalResponse.status).toBe(200);

    const registerCustomerResponse = await request(baseUrl)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Juan Perez',
        taxIdOrDocumentId: 'DOC-0001',
        contactEmail: 'juan@example.com',
        contactPhone: '+525512345678',
        customerType: 'Individual',
      });
    expect(registerCustomerResponse.status).toBe(201);
    const customerId: string = registerCustomerResponse.body.data.id;

    const getInitialResponse = await request(baseUrl)
      .get(`/api/v1/customers/${customerId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getInitialResponse.body.data.status).toBe('Registered');

    const fileId = await uploadAndConfirmFile(accessToken, Buffer.from('documento de prueba'));

    const uploadDocumentResponse = await request(baseUrl)
      .post(`/api/v1/customers/${customerId}/identity-documents`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ documentType: 'NationalId', fileId, expiryDate: '2030-01-01T00:00:00.000Z' });
    expect(uploadDocumentResponse.status).toBe(201);
    const documentId: string = uploadDocumentResponse.body.data.id;

    const verifyDocumentResponse = await request(baseUrl)
      .post(`/api/v1/customers/${customerId}/identity-documents/${documentId}/verify`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(verifyDocumentResponse.status).toBe(201);

    const getAfterVerifyResponse = await request(baseUrl)
      .get(`/api/v1/customers/${customerId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getAfterVerifyResponse.body.data.status).toBe('Active');

    const registerDriverResponse = await request(baseUrl)
      .post(`/api/v1/customers/${customerId}/additional-drivers`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Maria Lopez' });
    expect(registerDriverResponse.status).toBe(201);
    const driverId: string = registerDriverResponse.body.data.id;

    const validateWithoutLicenseResponse = await request(baseUrl)
      .post(`/api/v1/customers/${customerId}/additional-drivers/${driverId}/validate-license`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(validateWithoutLicenseResponse.status).toBe(422);
    expect(validateWithoutLicenseResponse.body.code).toBe(
      'ADDITIONAL_DRIVER_MISSING_VALID_LICENSE',
    );

    const licenseFileId = await uploadAndConfirmFile(
      accessToken,
      Buffer.from('licencia de prueba'),
    );

    const uploadLicenseResponse = await request(baseUrl)
      .post(`/api/v1/customers/${customerId}/identity-documents`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        documentType: 'DriversLicense',
        fileId: licenseFileId,
        expiryDate: '2030-01-01T00:00:00.000Z',
        additionalDriverId: driverId,
      });
    expect(uploadLicenseResponse.status).toBe(201);
    const licenseDocumentId: string = uploadLicenseResponse.body.data.id;

    const verifyLicenseResponse = await request(baseUrl)
      .post(`/api/v1/customers/${customerId}/identity-documents/${licenseDocumentId}/verify`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(verifyLicenseResponse.status).toBe(201);

    const validateWithLicenseResponse = await request(baseUrl)
      .post(`/api/v1/customers/${customerId}/additional-drivers/${driverId}/validate-license`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(validateWithLicenseResponse.status).toBe(201);

    const blockResponse = await request(baseUrl)
      .post(`/api/v1/customers/${customerId}/block`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'fraude sospechoso' });
    expect(blockResponse.status).toBe(201);

    const unblockResponse = await request(baseUrl)
      .post(`/api/v1/customers/${customerId}/unblock`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(unblockResponse.status).toBe(201);

    const auditLogResponse = await request(baseUrl)
      .get('/api/v1/audit-log')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(auditLogResponse.status).toBe(200);
    const eventTypes: string[] = auditLogResponse.body.data.map(
      (entry: { action: string }) => entry.action,
    );
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        'CustomerRegistered.v1',
        'AdditionalDriverRegistered.v1',
        'AdditionalDriverValidated.v1',
        'CustomerBlocked.v1',
        'CustomerUnblocked.v1',
      ]),
    );
    expect(
      eventTypes.filter((eventType) => eventType === 'CustomerDocumentValidated.v1'),
    ).toHaveLength(2);
  });
});
