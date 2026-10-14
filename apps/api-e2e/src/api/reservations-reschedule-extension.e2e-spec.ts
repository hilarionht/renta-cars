import request from 'supertest';

import { farFutureExpiryDate, futureRentalWindow } from '../support/dates';
import { seedAdminForCompany } from '../support/seed-identity';

// docs/persistence/10-DECISIONES.md #136: reprogramar y extender una reserva que ya ocupa su
// AvailabilitySlot. Antes ambos fallaban siempre con 409 si el rango nuevo se superponia al
// actual (la reserva chocaba consigo misma); una extension siempre se superpone. Verifica
// tambien que el choque con OTRA reserva sigue rechazandose y que la ocupacion se mueve de
// verdad (GET /availability), sin perder la vieja cuando el cambio se rechaza.
describe('Reservations: reprogramar y extender sobre una ocupacion existente', () => {
  let baseUrl: string;

  beforeAll(() => {
    baseUrl = process.env.API_E2E_BASE_URL as string;
  });

  it('mueve la ocupacion con rangos superpuestos y rechaza los choques con otras reservas', async () => {
    const taxId = `tax-reschedule-extension-e2e-${Date.now()}`;
    const registerCompanyResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company reschedule extension e2e ${taxId}`,
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
      name: 'Sucursal reschedule e2e',
      address: { line1: 'Av. Principal 123', city: 'CABA', country: 'AR' },
      operatingHours: [{ day: 'monday', open: '08:00', close: '18:00' }],
    });
    expect(branchResponse.status).toBe(201);
    const branchId: string = branchResponse.body.data.id;

    // Customer elegible: IdentityDocument verificado -> Active.
    const customerResponse = await auth(request(baseUrl).post('/api/v1/customers')).send({
      name: 'Cliente reschedule e2e',
      taxIdOrDocumentId: `doc-${taxId}`,
      contactEmail: 'cliente-reschedule@example.com',
      contactPhone: '+541100000099',
      customerType: 'Individual',
    });
    expect(customerResponse.status).toBe(201);
    const customerId: string = customerResponse.body.data.id;
    const identityDocResponse = await auth(
      request(baseUrl).post(`/api/v1/customers/${customerId}/identity-documents`),
    ).send({
      documentType: 'NationalId',
      fileId: 'file-e2e-identity-reschedule',
      expiryDate: farFutureExpiryDate(),
    });
    expect(identityDocResponse.status).toBe(201);
    await auth(
      request(baseUrl).post(
        `/api/v1/customers/${customerId}/identity-documents/${identityDocResponse.body.data.id as string}/verify`,
      ),
    );

    const categoryResponse = await auth(request(baseUrl).post('/api/v1/vehicle-categories')).send({
      name: 'Economico reschedule e2e',
    });
    expect(categoryResponse.status).toBe(201);
    const categoryId: string = categoryResponse.body.data.id;
    await auth(request(baseUrl).post(`/api/v1/vehicle-categories/${categoryId}/rates`)).send({
      amountMinorUnits: 50000,
      currency: 'USD',
      unit: 'Day',
      validFrom: '2026-01-01T00:00:00.000Z',
    });

    async function enabledVehicle(licensePlate: string, vin: string): Promise<string> {
      const vehicleResponse = await auth(request(baseUrl).post('/api/v1/vehicles')).send({
        branchId,
        vehicleCategoryId: categoryId,
        licensePlate,
        vin,
      });
      expect(vehicleResponse.status).toBe(201);
      const vehicleId: string = vehicleResponse.body.data.id;
      const documentResponse = await auth(
        request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/documents`),
      ).send({
        documentType: 'PropertyCard',
        fileId: `file-e2e-${licensePlate}`,
        expiryDate: farFutureExpiryDate(),
      });
      expect(documentResponse.status).toBe(201);
      await auth(
        request(baseUrl).post(
          `/api/v1/vehicles/${vehicleId}/documents/${documentResponse.body.data.id as string}/verify`,
        ),
      );
      const enableResponse = await auth(
        request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/enable`),
      );
      expect(enableResponse.status).toBe(201);
      return vehicleId;
    }

    async function confirmedReservation(
      vehicleId: string,
      window: { startDate: string; endDate: string },
    ): Promise<string> {
      const createResponse = await auth(request(baseUrl).post('/api/v1/reservations')).send({
        customerId,
        vehicleId,
        startDate: window.startDate,
        endDate: window.endDate,
      });
      expect(createResponse.status).toBe(201);
      const reservationId: string = createResponse.body.data.id;
      const confirmResponse = await auth(
        request(baseUrl).post(`/api/v1/reservations/${reservationId}/confirm`),
      );
      expect(confirmResponse.status).toBe(201);
      return reservationId;
    }

    async function isAvailable(vehicleId: string, startDate: string, endDate: string) {
      const response = await auth(
        request(baseUrl).get(
          `/api/v1/availability?resourceType=vehicle&resourceId=${vehicleId}&startDate=${startDate}&endDate=${endDate}`,
        ),
      );
      expect(response.status).toBe(200);
      return response.body.data.available as boolean;
    }

    const vehicleA = await enabledVehicle('RSE-0001', '3HGCM82633A555001');
    const vehicleB = await enabledVehicle('RSE-0002', '3HGCM82633A555002');

    // --- Reprogramar a un rango superpuesto al propio
    const first = futureRentalWindow(30, 3); // dias 30-33
    const firstId = await confirmedReservation(vehicleA, first);
    const shifted = futureRentalWindow(31, 3); // dias 31-34, se superpone con 30-33
    const rescheduleResponse = await auth(
      request(baseUrl).post(`/api/v1/reservations/${firstId}/reschedule`),
    ).send({ newStartDate: shifted.startDate, newEndDate: shifted.endDate });
    expect(rescheduleResponse.status).toBe(201);

    const afterReschedule = await auth(request(baseUrl).get(`/api/v1/reservations/${firstId}`));
    expect(afterReschedule.body.data.startDate).toBe(shifted.startDate);
    expect(afterReschedule.body.data.endDate).toBe(shifted.endDate);
    // La ocupacion se movio: el dia 30 quedo libre y el 33 ocupado.
    expect(await isAvailable(vehicleA, first.startDate, shifted.startDate)).toBe(true);
    expect(await isAvailable(vehicleA, first.endDate, shifted.endDate)).toBe(false);

    // --- Reprogramar encima de OTRA reserva del mismo vehiculo sigue rechazandose
    const second = futureRentalWindow(40, 3); // dias 40-43
    await confirmedReservation(vehicleA, second);
    const onTopOfSecond = futureRentalWindow(41, 3);
    const collidingReschedule = await auth(
      request(baseUrl).post(`/api/v1/reservations/${firstId}/reschedule`),
    ).send({ newStartDate: onTopOfSecond.startDate, newEndDate: onTopOfSecond.endDate });
    expect(collidingReschedule.status).toBe(409);
    expect(collidingReschedule.body.code).toBe('VEHICLE_NOT_AVAILABLE');
    // La reserva y su ocupacion quedaron como estaban.
    const unchanged = await auth(request(baseUrl).get(`/api/v1/reservations/${firstId}`));
    expect(unchanged.body.data.startDate).toBe(shifted.startDate);
    expect(await isAvailable(vehicleA, shifted.startDate, shifted.endDate)).toBe(false);

    // --- Extender una reserva en alquiler (siempre se superpone: mismo inicio)
    const rental = futureRentalWindow(50, 3); // dias 50-53
    const rentalId = await confirmedReservation(vehicleB, rental);
    const checkOutResponse = await auth(
      request(baseUrl).post(`/api/v1/reservations/${rentalId}/check-out`),
    ).send({
      odometer: 1000,
      fuelLevelPercentage: 100,
      photoFileIds: [],
      inspectedBy: admin.adminUserId,
    });
    expect(checkOutResponse.status).toBe(201);

    const extendedEnd = futureRentalWindow(50, 5).endDate; // dia 55
    const requestResponse = await auth(
      request(baseUrl).post(`/api/v1/reservations/${rentalId}/request-extension`),
    ).send({ requestedNewEndDate: extendedEnd });
    expect(requestResponse.status).toBe(201);
    const approveResponse = await auth(
      request(baseUrl).post(`/api/v1/reservations/${rentalId}/approve-extension`),
    ).send({ newEndDate: extendedEnd });
    expect(approveResponse.status).toBe(201);

    const extended = await auth(request(baseUrl).get(`/api/v1/reservations/${rentalId}`));
    expect(extended.body.data.endDate).toBe(extendedEnd);
    expect(extended.body.data.priceAdjustments).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'Extension' })]),
    );
    expect(await isAvailable(vehicleB, rental.endDate, extendedEnd)).toBe(false);

    // --- Extender encima de OTRA reserva del mismo vehiculo
    const next = futureRentalWindow(56, 2); // dias 56-58
    await confirmedReservation(vehicleB, next);
    const collidingExtension = await auth(
      request(baseUrl).post(`/api/v1/reservations/${rentalId}/approve-extension`),
    ).send({ newEndDate: futureRentalWindow(50, 7).endDate }); // dia 57
    expect(collidingExtension.status).toBe(409);
    expect(collidingExtension.body.code).toBe('EXTENSION_COLLIDES');
    const stillExtended = await auth(request(baseUrl).get(`/api/v1/reservations/${rentalId}`));
    expect(stillExtended.body.data.endDate).toBe(extendedEnd);
  });
});
