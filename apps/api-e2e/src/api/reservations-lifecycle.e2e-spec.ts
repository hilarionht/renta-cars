import request from 'supertest';

import { seedAdminForCompany } from '../support/seed-identity';

// Verifica de punta a punta el exit-criterion literal de Fase 1 (docs/01-ROADMAP.md SS3):
// "flujo completo reserva -> confirmacion -> check-out -> check-in". Registra company ->
// branch -> Customer elegible (IdentityDocument verificado) -> AdditionalDriver Validated ->
// VehicleCategory + Rate -> Vehicle habilitado -> POST /reservations (Draft) -> confirm()
// (ocupa el AvailabilitySlot, primer consumidor real de CalendarPort/CUSTOMER_LOOKUP_PORT/
// VEHICLE_CATEGORY_LOOKUP_PORT) -> check-out (con Inspection) -> check-in (con Inspection +
// DamageReport + PriceAdjustment) -> confirma liberacion del AvailabilitySlot via
// GET /availability -> GET /audit-log confirma los eventos esperados.
describe('Reservations: reserva -> confirmacion -> check-out -> check-in', () => {
  let baseUrl: string;

  beforeAll(() => {
    baseUrl = process.env.API_E2E_BASE_URL as string;
  });

  it('ciclo de vida completo de una Reservation', async () => {
    const taxId = `tax-reservations-e2e-${Date.now()}`;
    const registerCompanyResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company reservations e2e ${taxId}`,
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
      name: 'Sucursal reservations e2e',
      address: { line1: 'Av. Principal 123', city: 'CDMX', country: 'MX' },
      operatingHours: [{ day: 'monday', open: '08:00', close: '18:00' }],
    });
    expect(branchResponse.status).toBe(201);
    const branchId: string = branchResponse.body.data.id;

    // Customer elegible: IdentityDocument Verified -> status pasa a Active (efecto lateral).
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
    const verifyIdentityResponse = await auth(
      request(baseUrl).post(
        `/api/v1/customers/${customerId}/identity-documents/${identityDocumentId}/verify`,
      ),
    );
    expect(verifyIdentityResponse.status).toBe(201);

    // AdditionalDriver declarado y Validated - INV-105 en checkOut().
    const additionalDriverResponse = await auth(
      request(baseUrl).post(`/api/v1/customers/${customerId}/additional-drivers`),
    ).send({ name: 'Conductor Adicional e2e' });
    expect(additionalDriverResponse.status).toBe(201);
    const additionalDriverId: string = additionalDriverResponse.body.data.id;

    const driverLicenseResponse = await auth(
      request(baseUrl).post(`/api/v1/customers/${customerId}/identity-documents`),
    ).send({
      documentType: 'DriversLicense',
      fileId: 'file-e2e-license',
      expiryDate: '2030-01-01T00:00:00.000Z',
      additionalDriverId,
    });
    expect(driverLicenseResponse.status).toBe(201);
    const driverLicenseId: string = driverLicenseResponse.body.data.id;
    await auth(
      request(baseUrl).post(
        `/api/v1/customers/${customerId}/identity-documents/${driverLicenseId}/verify`,
      ),
    );
    const validateLicenseResponse = await auth(
      request(baseUrl).post(
        `/api/v1/customers/${customerId}/additional-drivers/${additionalDriverId}/validate-license`,
      ),
    );
    expect(validateLicenseResponse.status).toBe(201);

    const categoryResponse = await auth(request(baseUrl).post('/api/v1/vehicle-categories')).send({
      name: 'Economico reservations e2e',
    });
    expect(categoryResponse.status).toBe(201);
    const categoryId: string = categoryResponse.body.data.id;

    const addRateResponse = await auth(
      request(baseUrl).post(`/api/v1/vehicle-categories/${categoryId}/rates`),
    ).send({
      amountMinorUnits: 50000,
      currency: 'USD',
      unit: 'Day',
      validFrom: '2026-01-01T00:00:00.000Z',
    });
    expect(addRateResponse.status).toBe(201);

    const vehicleResponse = await auth(request(baseUrl).post('/api/v1/vehicles')).send({
      branchId,
      vehicleCategoryId: categoryId,
      licensePlate: 'RES-0001',
      vin: '3HGCM82633A111222',
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
    const enableVehicleResponse = await auth(
      request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/enable`),
    );
    expect(enableVehicleResponse.status).toBe(201);

    const startDate = '2026-09-01T10:00:00.000Z';
    const endDate = '2026-09-04T10:00:00.000Z';

    const availabilityBeforeResponse = await auth(
      request(baseUrl).get(
        `/api/v1/availability?resourceType=vehicle&resourceId=${vehicleId}&startDate=${startDate}&endDate=${endDate}`,
      ),
    );
    expect(availabilityBeforeResponse.body.data.available).toBe(true);

    // Draft
    const createReservationResponse = await auth(
      request(baseUrl).post('/api/v1/reservations'),
    ).send({
      customerId,
      vehicleId,
      startDate,
      endDate,
      authorizedDriverIds: [additionalDriverId],
    });
    expect(createReservationResponse.status).toBe(201);
    const reservationId: string = createReservationResponse.body.data.id;

    const getDraftResponse = await auth(
      request(baseUrl).get(`/api/v1/reservations/${reservationId}`),
    );
    expect(getDraftResponse.body.data.status).toBe('Draft');

    // Confirmed - ocupa el AvailabilitySlot
    const confirmResponse = await auth(
      request(baseUrl).post(`/api/v1/reservations/${reservationId}/confirm`),
    );
    expect(confirmResponse.status).toBe(201);

    const getConfirmedResponse = await auth(
      request(baseUrl).get(`/api/v1/reservations/${reservationId}`),
    );
    expect(getConfirmedResponse.body.data.status).toBe('Confirmed');
    expect(getConfirmedResponse.body.data.baseAmountMinorUnits).toBe(150000);

    const availabilityAfterConfirmResponse = await auth(
      request(baseUrl).get(
        `/api/v1/availability?resourceType=vehicle&resourceId=${vehicleId}&startDate=${startDate}&endDate=${endDate}`,
      ),
    );
    expect(availabilityAfterConfirmResponse.body.data.available).toBe(false);

    // CheckedOut
    const checkOutResponse = await auth(
      request(baseUrl).post(`/api/v1/reservations/${reservationId}/check-out`),
    ).send({
      odometer: 1000,
      fuelLevelPercentage: 100,
      photoFileIds: ['file-e2e-checkout'],
      inspectedBy: admin.adminUserId,
    });
    expect(checkOutResponse.status).toBe(201);

    const getCheckedOutResponse = await auth(
      request(baseUrl).get(`/api/v1/reservations/${reservationId}`),
    );
    expect(getCheckedOutResponse.body.data.status).toBe('CheckedOut');

    // CheckedIn - con dano detectado y penalidad
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

    const getCheckedInResponse = await auth(
      request(baseUrl).get(`/api/v1/reservations/${reservationId}`),
    );
    expect(getCheckedInResponse.body.data.status).toBe('CheckedIn');

    // checkIn() libera el AvailabilitySlot (Hallazgo #5)
    const availabilityAfterCheckInResponse = await auth(
      request(baseUrl).get(
        `/api/v1/availability?resourceType=vehicle&resourceId=${vehicleId}&startDate=${startDate}&endDate=${endDate}`,
      ),
    );
    expect(availabilityAfterCheckInResponse.body.data.available).toBe(true);

    const auditLogResponse = await auth(request(baseUrl).get('/api/v1/audit-log'));
    expect(auditLogResponse.status).toBe(200);
    const eventTypes: string[] = auditLogResponse.body.data.map(
      (entry: { action: string }) => entry.action,
    );
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        'ReservationCreated.v1',
        'ReservationConfirmed.v1',
        'ReservationCheckedOut.v1',
        'ReservationCheckedIn.v1',
      ]),
    );
  });
});
