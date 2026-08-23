import request from 'supertest';

import { seedAdminForCompany } from '../support/seed-identity';

interface RevenueByBranchItem {
  branchId: string;
  currency: string;
  billedRevenueMinorUnits: number;
}

interface FleetUtilizationItem {
  vehicleId: string;
  branchId: string;
  occupiedDays: number;
  totalDays: number;
  utilizationPercentage: number;
}

interface ReservationFunnelItem {
  status: string;
  count: number;
}

interface CustomerActivityItem {
  customerId: string;
  customerName: string;
  reservationCount: number;
  spend: { currency: string; amountMinorUnits: number }[];
}

// Verifica de punta a punta los 4 reportes de Fase 4 item 1 (docs/01-ROADMAP.md SS6) contra
// un escenario real de 2 branches/2 vehicles/2 customers, cada uno con una Reservation
// confirmada -> check-out -> check-in (sin dano ni deficit de combustible, RentalFee unico)
// -> InvoiceIssued.v1 -> Reservation Closed automatico. Mismo patron de setup que
// invoices-lifecycle.e2e-spec.ts, duplicado para tener 2 branches/customers distintos.
describe('Reports (Fase 4 item 1)', () => {
  let baseUrl: string;

  beforeAll(() => {
    baseUrl = process.env.API_E2E_BASE_URL as string;
  });

  it('revenue-by-branch, fleet-utilization, reservation-funnel y customer-activity devuelven numeros correctos', async () => {
    const taxId = `tax-reports-e2e-${Date.now()}`;
    const registerCompanyResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company reports e2e ${taxId}`,
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

    const categoryResponse = await auth(request(baseUrl).post('/api/v1/vehicle-categories')).send({
      name: 'Economico reports e2e',
    });
    const categoryId: string = categoryResponse.body.data.id;
    await auth(request(baseUrl).post(`/api/v1/vehicle-categories/${categoryId}/rates`)).send({
      amountMinorUnits: 50000,
      currency: 'USD',
      unit: 'Day',
      validFrom: '2026-01-01T00:00:00.000Z',
    });

    const rentalStart = '2026-11-10T10:00:00.000Z';
    const rentalEnd = '2026-11-13T10:00:00.000Z';

    async function setupBranchVehicleCustomer(suffix: string) {
      const branchResponse = await auth(request(baseUrl).post('/api/v1/branches')).send({
        name: `Sucursal reports e2e ${suffix}`,
        address: { line1: `Av. Reports ${suffix} 1`, city: 'CDMX', country: 'MX' },
        operatingHours: [{ day: 'monday', open: '08:00', close: '18:00' }],
      });
      const branchId: string = branchResponse.body.data.id;

      const customerEmail = `cliente-reports-${suffix}-${Date.now()}@example.com`;
      const customerResponse = await auth(request(baseUrl).post('/api/v1/customers')).send({
        name: `Cliente Reports E2E ${suffix}`,
        taxIdOrDocumentId: `doc-${taxId}-${suffix}`,
        contactEmail: customerEmail,
        contactPhone: '+525500000002',
        customerType: 'Individual',
      });
      const customerId: string = customerResponse.body.data.id;
      const identityDocResponse = await auth(
        request(baseUrl).post(`/api/v1/customers/${customerId}/identity-documents`),
      ).send({
        documentType: 'NationalId',
        fileId: `file-e2e-identity-reports-${suffix}`,
        expiryDate: '2030-01-01T00:00:00.000Z',
      });
      const identityDocumentId: string = identityDocResponse.body.data.id;
      await auth(
        request(baseUrl).post(
          `/api/v1/customers/${customerId}/identity-documents/${identityDocumentId}/verify`,
        ),
      );

      const vehicleResponse = await auth(request(baseUrl).post('/api/v1/vehicles')).send({
        branchId,
        vehicleCategoryId: categoryId,
        licensePlate: `RPT-${suffix}`,
        vin: `3HGCM82633A44470${suffix}`,
      });
      const vehicleId: string = vehicleResponse.body.data.id;
      const vehicleDocResponse = await auth(
        request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/documents`),
      ).send({
        documentType: 'PropertyCard',
        fileId: `file-e2e-vehicle-reports-${suffix}`,
        expiryDate: '2030-01-01T00:00:00.000Z',
      });
      const vehicleDocumentId: string = vehicleDocResponse.body.data.id;
      await auth(
        request(baseUrl).post(
          `/api/v1/vehicles/${vehicleId}/documents/${vehicleDocumentId}/verify`,
        ),
      );
      await auth(request(baseUrl).post(`/api/v1/vehicles/${vehicleId}/enable`));

      const createReservationResponse = await auth(
        request(baseUrl).post('/api/v1/reservations'),
      ).send({ customerId, vehicleId, startDate: rentalStart, endDate: rentalEnd });
      const reservationId: string = createReservationResponse.body.data.id;

      await auth(request(baseUrl).post(`/api/v1/reservations/${reservationId}/confirm`));
      await auth(request(baseUrl).post(`/api/v1/reservations/${reservationId}/check-out`)).send({
        odometer: 1000,
        fuelLevelPercentage: 100,
        photoFileIds: [`file-e2e-checkout-reports-${suffix}`],
        inspectedBy: admin.adminUserId,
      });
      const checkInResponse = await auth(
        request(baseUrl).post(`/api/v1/reservations/${reservationId}/check-in`),
      ).send({
        odometer: 1300,
        fuelLevelPercentage: 100,
        photoFileIds: [`file-e2e-checkin-reports-${suffix}`],
        inspectedBy: admin.adminUserId,
        damages: [],
      });
      expect(checkInResponse.status).toBe(201);

      return { branchId, customerId, vehicleId, reservationId };
    }

    const branchA = await setupBranchVehicleCustomer('A');
    const branchB = await setupBranchVehicleCustomer('B');

    // InvoiceIssuedFromCheckInListener/InvoiceIssuedListener son fire-and-forget - se espera
    // a que ambas invoices existan antes de consultar los reportes.
    const deadline = Date.now() + 5000;
    let invoicesReady = false;
    while (Date.now() < deadline && !invoicesReady) {
      const invoicesA = await auth(
        request(baseUrl).get(`/api/v1/invoices?reservationId=${branchA.reservationId}`),
      );
      const invoicesB = await auth(
        request(baseUrl).get(`/api/v1/invoices?reservationId=${branchB.reservationId}`),
      );
      invoicesReady = invoicesA.body.data.length > 0 && invoicesB.body.data.length > 0;
      if (!invoicesReady) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    expect(invoicesReady).toBe(true);

    // createdAt de Reservation/Invoice es "ahora" (momento del POST), no rentalStart/
    // rentalEnd - rango amplio para no depender del reloj exacto de la corrida.
    const createdRangeQuery = 'from=2020-01-01T00:00:00.000Z&to=2030-01-01T00:00:00.000Z';

    const revenueResponse = await auth(
      request(baseUrl).get(`/api/v1/reports/revenue-by-branch?${createdRangeQuery}`),
    );
    expect(revenueResponse.status).toBe(200);
    const revenueItems: RevenueByBranchItem[] = revenueResponse.body.data.items;
    expect(revenueItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          branchId: branchA.branchId,
          currency: 'USD',
          billedRevenueMinorUnits: 150000,
        }),
        expect.objectContaining({
          branchId: branchB.branchId,
          currency: 'USD',
          billedRevenueMinorUnits: 150000,
        }),
      ]),
    );

    const fleetResponse = await auth(
      request(baseUrl).get(
        '/api/v1/reports/fleet-utilization?from=2026-11-01T00:00:00.000Z&to=2026-11-11T00:00:00.000Z',
      ),
    );
    expect(fleetResponse.status).toBe(200);
    const fleetItems: FleetUtilizationItem[] = fleetResponse.body.data.items;
    const vehicleAUtilization = fleetItems.find((item) => item.vehicleId === branchA.vehicleId);
    // Rango de consulta: 10 dias (01 al 11 nov); reserva ocupa 1 dia dentro de ese rango
    // (10 nov 10:00 al 11 nov 00:00, el resto de la reserva cae fuera del rango consultado).
    expect(vehicleAUtilization).toMatchObject({ branchId: branchA.branchId, totalDays: 10 });
    expect(vehicleAUtilization?.occupiedDays).toBeCloseTo(0.5833, 3);
    expect(fleetResponse.body.data.fleetAverageUtilizationPercentage).toBeGreaterThan(0);

    const funnelResponse = await auth(
      request(baseUrl).get(`/api/v1/reports/reservation-funnel?${createdRangeQuery}`),
    );
    expect(funnelResponse.status).toBe(200);
    const funnelItems: ReservationFunnelItem[] = funnelResponse.body.data.items;
    expect(funnelItems).toEqual([{ status: 'Closed', count: 2 }]);

    const customerActivityResponse = await auth(
      request(baseUrl).get(`/api/v1/reports/customer-activity?${createdRangeQuery}`),
    );
    expect(customerActivityResponse.status).toBe(200);
    const customerItems: CustomerActivityItem[] = customerActivityResponse.body.data.items;
    expect(customerItems).toHaveLength(2);
    for (const branch of [branchA, branchB]) {
      const item = customerItems.find((entry) => entry.customerId === branch.customerId);
      expect(item).toMatchObject({
        reservationCount: 1,
        spend: [{ currency: 'USD', amountMinorUnits: 150000 }],
      });
    }
  });

  it('rechaza from > to con 422 INVALID_REPORT_RANGE', async () => {
    const taxId = `tax-reports-range-e2e-${Date.now()}`;
    const registerCompanyResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company reports range e2e ${taxId}`,
        taxId,
        billingContactEmail: 'billing@example.com',
      });
    const companyId: string = registerCompanyResponse.body.data.id;
    const admin = await seedAdminForCompany(companyId);
    const loginResponse = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({ companyId, email: admin.adminEmail, password: admin.adminPassword });
    const accessToken: string = loginResponse.body.data.accessToken;

    const response = await request(baseUrl)
      .get(
        '/api/v1/reports/reservation-funnel?from=2026-01-10T00:00:00.000Z&to=2026-01-01T00:00:00.000Z',
      )
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('INVALID_REPORT_RANGE');
  });
});
