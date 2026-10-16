import { Client } from 'pg';
import request from 'supertest';

import { farFutureExpiryDate, futureRentalDates, utcDayFromNow } from '../support/dates';
import { seedAdminForCompany } from '../support/seed-identity';

// docs/persistence/10-DECISIONES.md #139 (Incremento 4, Clientes): reglas encontradas en la
// auditoria en vivo.
// - A: datos invalidos o repetidos dan 400/409, nunca 500.
// - B/E: telefono unico por company; un +54 sin el 9 de movil es el mismo telefono.
// - C: renovacion de documentos (clientes y vehiculos): el nuevo reemplaza al anterior al
//   verificarse, no se verifica uno vencido ni uno reemplazado, y un vehiculo no se habilita
//   con un documento vencido.
// - C2: la licencia de un conductor tiene que ser DriversLicense.
// - D: bloquear con una reserva confirmada se permite, pero el check-out rechaza a un cliente
//   bloqueado o con el documento vencido.
// Los vencimientos "despues de verificar" se simulan escribiendo expiry_date directo en
// Postgres (rol migrator, exento de RLS, mismo criterio que seed-identity.ts): por API no se
// puede verificar un documento vencido, que es justamente la regla.
describe('Customers: documentos, unicidades y reglas del check-out', () => {
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

  it('unicidades, renovacion de documentos y check-out con cliente no elegible', async () => {
    const taxId = `tax-customer-rules-e2e-${Date.now()}`;
    const registerCompanyResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company customer rules e2e ${taxId}`,
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

    // --- A, B y E: alta y unicidades
    const customerBody = {
      name: 'Cliente Reglas',
      taxIdOrDocumentId: 'DOC-RULES-1',
      contactEmail: 'reglas@example.com',
      contactPhone: '+541155554444',
      customerType: 'Individual',
    };
    const customerResponse = await auth(request(baseUrl).post('/api/v1/customers')).send(
      customerBody,
    );
    expect(customerResponse.status).toBe(201);
    const customerId: string = customerResponse.body.data.id;

    const detailResponse = await auth(request(baseUrl).get(`/api/v1/customers/${customerId}`));
    expect(detailResponse.body.data.contactPhone).toBe('+5491155554444');

    const duplicateDocumentResponse = await auth(request(baseUrl).post('/api/v1/customers')).send({
      ...customerBody,
      contactPhone: '+5491100000001',
    });
    expect(duplicateDocumentResponse.status).toBe(409);
    expect(duplicateDocumentResponse.body.code).toBe('DUPLICATE_CUSTOMER_DOCUMENT_ID');

    for (const contactPhone of ['+5491155554444', '+541155554444']) {
      const duplicatePhoneResponse = await auth(request(baseUrl).post('/api/v1/customers')).send({
        ...customerBody,
        taxIdOrDocumentId: `DOC-RULES-${contactPhone}`,
        contactPhone,
      });
      expect(duplicatePhoneResponse.status).toBe(409);
      expect(duplicatePhoneResponse.body.code).toBe('DUPLICATE_CUSTOMER_PHONE');
    }

    const invalidPhoneResponse = await auth(request(baseUrl).post('/api/v1/customers')).send({
      ...customerBody,
      taxIdOrDocumentId: 'DOC-RULES-2',
      contactPhone: '1155554444',
    });
    expect(invalidPhoneResponse.status).toBe(400);
    expect(invalidPhoneResponse.body.code).toBe('INVALID_VALUE');

    const blankDocumentResponse = await auth(request(baseUrl).post('/api/v1/customers')).send({
      ...customerBody,
      taxIdOrDocumentId: '   ',
      contactPhone: '+5491100000002',
    });
    expect(blankDocumentResponse.status).toBe(400);
    expect(blankDocumentResponse.body.code).toBe('INVALID_VALUE');

    // --- C: renovacion del documento del cliente
    const uploadIdentityDocument = (expiryDate: string, extra: object = {}) =>
      auth(request(baseUrl).post(`/api/v1/customers/${customerId}/identity-documents`)).send({
        documentType: 'NationalId',
        fileId: 'file-e2e-rules',
        expiryDate,
        ...extra,
      });
    const verifyIdentityDocument = (documentId: string) =>
      auth(
        request(baseUrl).post(
          `/api/v1/customers/${customerId}/identity-documents/${documentId}/verify`,
        ),
      );
    const documentStatuses = async (): Promise<string[]> => {
      const response = await auth(request(baseUrl).get(`/api/v1/customers/${customerId}`));
      return (response.body.data.identityDocuments as { documentType: string; status: string }[])
        .filter((document) => document.documentType === 'NationalId')
        .map((document) => document.status);
    };

    const expiredResponse = await uploadIdentityDocument(utcDayFromNow(-1).toISOString());
    expect(expiredResponse.status).toBe(201);
    const expiredId: string = expiredResponse.body.data.id;
    const verifyExpiredResponse = await verifyIdentityDocument(expiredId);
    expect(verifyExpiredResponse.status).toBe(409);
    expect(verifyExpiredResponse.body.code).toBe('IDENTITY_DOCUMENT_EXPIRED');

    const firstResponse = await uploadIdentityDocument(utcDayFromNow(60).toISOString());
    expect(firstResponse.status).toBe(201);
    const firstId: string = firstResponse.body.data.id;
    const verifyReplacedResponse = await verifyIdentityDocument(expiredId);
    expect(verifyReplacedResponse.status).toBe(409);
    expect(verifyReplacedResponse.body.code).toBe('IDENTITY_DOCUMENT_REPLACED');
    expect((await verifyIdentityDocument(firstId)).status).toBe(201);

    const renewalResponse = await uploadIdentityDocument(farFutureExpiryDate());
    expect(renewalResponse.status).toBe(201);
    const renewalId: string = renewalResponse.body.data.id;
    expect(await documentStatuses()).toEqual(['Replaced', 'Verified', 'Pending']);
    expect((await verifyIdentityDocument(renewalId)).status).toBe(201);
    expect(await documentStatuses()).toEqual(['Replaced', 'Replaced', 'Verified']);

    // --- C2: un DNI no cuenta como licencia
    const driverResponse = await auth(
      request(baseUrl).post(`/api/v1/customers/${customerId}/additional-drivers`),
    ).send({ name: 'Conductor Reglas' });
    expect(driverResponse.status).toBe(201);
    const driverId: string = driverResponse.body.data.id;
    const validateLicense = () =>
      auth(
        request(baseUrl).post(
          `/api/v1/customers/${customerId}/additional-drivers/${driverId}/validate-license`,
        ),
      );

    const driverNationalIdResponse = await uploadIdentityDocument(farFutureExpiryDate(), {
      additionalDriverId: driverId,
    });
    expect(driverNationalIdResponse.status).toBe(201);
    expect((await verifyIdentityDocument(driverNationalIdResponse.body.data.id)).status).toBe(201);
    const validateWithNationalIdResponse = await validateLicense();
    expect(validateWithNationalIdResponse.status).toBe(422);
    expect(validateWithNationalIdResponse.body.code).toBe(
      'ADDITIONAL_DRIVER_MISSING_VALID_LICENSE',
    );

    const licenseResponse = await uploadIdentityDocument(farFutureExpiryDate(), {
      documentType: 'DriversLicense',
      additionalDriverId: driverId,
    });
    expect(licenseResponse.status).toBe(201);
    expect((await verifyIdentityDocument(licenseResponse.body.data.id)).status).toBe(201);
    expect((await validateLicense()).status).toBe(201);

    // --- C en vehiculos: renovacion y habilitacion con documento vigente
    const branchResponse = await auth(request(baseUrl).post('/api/v1/branches')).send({
      name: 'Sucursal reglas e2e',
      address: { line1: 'Av. Principal 123', city: 'Buenos Aires', country: 'AR' },
      operatingHours: [{ day: 'monday', open: '08:00', close: '18:00' }],
    });
    expect(branchResponse.status).toBe(201);
    const categoryResponse = await auth(request(baseUrl).post('/api/v1/vehicle-categories')).send({
      name: 'Economico reglas e2e',
    });
    expect(categoryResponse.status).toBe(201);
    const categoryId: string = categoryResponse.body.data.id;
    const rateResponse = await auth(
      request(baseUrl).post(`/api/v1/vehicle-categories/${categoryId}/rates`),
    ).send({
      amountMinorUnits: 50000,
      currency: 'USD',
      unit: 'Day',
      validFrom: '2026-01-01T00:00:00.000Z',
    });
    expect(rateResponse.status).toBe(201);
    const vehicleResponse = await auth(request(baseUrl).post('/api/v1/vehicles')).send({
      branchId: branchResponse.body.data.id,
      vehicleCategoryId: categoryId,
      licensePlate: 'RUL-0001',
      vin: '3HGCM82633A333444',
    });
    expect(vehicleResponse.status).toBe(201);
    const vehicleId: string = vehicleResponse.body.data.id;

    const uploadVehicleDocument = (expiryDate: string) =>
      auth(request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/documents`)).send({
        documentType: 'Insurance',
        fileId: 'file-e2e-insurance',
        expiryDate,
      });
    const verifyVehicleDocument = (documentId: string) =>
      auth(request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/documents/${documentId}/verify`));
    const enableVehicle = () => auth(request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/enable`));

    const expiredInsuranceResponse = await uploadVehicleDocument(utcDayFromNow(-1).toISOString());
    expect(expiredInsuranceResponse.status).toBe(201);
    const verifyExpiredInsuranceResponse = await verifyVehicleDocument(
      expiredInsuranceResponse.body.data.id,
    );
    expect(verifyExpiredInsuranceResponse.status).toBe(409);
    expect(verifyExpiredInsuranceResponse.body.code).toBe('VEHICLE_DOCUMENT_EXPIRED');

    const insuranceResponse = await uploadVehicleDocument(farFutureExpiryDate());
    expect(insuranceResponse.status).toBe(201);
    const insuranceId: string = insuranceResponse.body.data.id;
    const verifyReplacedInsuranceResponse = await verifyVehicleDocument(
      expiredInsuranceResponse.body.data.id,
    );
    expect(verifyReplacedInsuranceResponse.status).toBe(409);
    expect(verifyReplacedInsuranceResponse.body.code).toBe('VEHICLE_DOCUMENT_REPLACED');
    expect((await verifyVehicleDocument(insuranceId)).status).toBe(201);

    await dbClient.query(
      `UPDATE rental.vehicle_documents SET expiry_date = now() - interval '1 day' WHERE id = $1`,
      [insuranceId],
    );
    const enableWithExpiredResponse = await enableVehicle();
    expect(enableWithExpiredResponse.status).toBe(422);
    expect(enableWithExpiredResponse.body.code).toBe('VEHICLE_DOCUMENTATION_INCOMPLETE');

    const insuranceRenewalResponse = await uploadVehicleDocument(farFutureExpiryDate());
    expect(insuranceRenewalResponse.status).toBe(201);
    expect((await verifyVehicleDocument(insuranceRenewalResponse.body.data.id)).status).toBe(201);
    const vehicleDetailResponse = await auth(request(baseUrl).get(`/api/v1/vehicles/${vehicleId}`));
    expect(
      (vehicleDetailResponse.body.data.vehicleDocuments as { status: string }[]).map(
        (document) => document.status,
      ),
    ).toEqual(['Replaced', 'Replaced', 'Verified']);
    expect((await enableVehicle()).status).toBe(201);

    // --- D: bloquear con reserva confirmada se permite; el check-out revisa al cliente
    const reservationResponse = await auth(request(baseUrl).post('/api/v1/reservations')).send({
      customerId,
      vehicleId,
      ...futureRentalDates(),
      authorizedDriverIds: [driverId],
    });
    expect(reservationResponse.status).toBe(201);
    const reservationId: string = reservationResponse.body.data.id;
    expect(
      (await auth(request(baseUrl).post(`/api/v1/reservations/${reservationId}/confirm`))).status,
    ).toBe(201);

    const checkOut = () =>
      auth(request(baseUrl).post(`/api/v1/reservations/${reservationId}/check-out`)).send({
        odometer: 1000,
        fuelLevelPercentage: 100,
        photoFileIds: [],
      });

    const blockResponse = await auth(
      request(baseUrl).post(`/api/v1/customers/${customerId}/block`),
    ).send({ reason: 'e2e' });
    expect(blockResponse.status).toBe(201);
    const checkOutBlockedResponse = await checkOut();
    expect(checkOutBlockedResponse.status).toBe(422);
    expect(checkOutBlockedResponse.body.code).toBe('CUSTOMER_NOT_ELIGIBLE');
    const unblockResponse = await auth(
      request(baseUrl).post(`/api/v1/customers/${customerId}/unblock`),
    );
    expect(unblockResponse.status).toBe(201);

    await dbClient.query(
      `UPDATE rental.identity_documents SET expiry_date = now() - interval '1 day' WHERE id = $1`,
      [renewalId],
    );
    const checkOutExpiredResponse = await checkOut();
    expect(checkOutExpiredResponse.status).toBe(422);
    expect(checkOutExpiredResponse.body.code).toBe('CUSTOMER_NOT_ELIGIBLE');

    const reservationAfterResponse = await auth(
      request(baseUrl).get(`/api/v1/reservations/${reservationId}`),
    );
    expect(reservationAfterResponse.body.data.status).toBe('Confirmed');

    await dbClient.query(`UPDATE rental.identity_documents SET expiry_date = $2 WHERE id = $1`, [
      renewalId,
      farFutureExpiryDate(),
    ]);
    expect((await checkOut()).status).toBe(201);
  });
});
