import request from 'supertest';

import { futureRentalDates } from '../support/dates';
import { seedAdminForCompany, seedBranchUserForCompany } from '../support/seed-identity';

// docs/persistence/10-DECISIONES.md #135 (web de administracion, incremento 2): lecturas que
// usa la pantalla de reservas - Branch.timeZone, GET /customers?q=, GET /reservations con
// expand y branchId (excepcion acotada a 01-REST-STANDARDS SS7: el branchId del token manda)
// y los filtros de GET /vehicles.
describe('Web admin: lecturas de reservas (timeZone, expand, branchId, q)', () => {
  let baseUrl: string;

  beforeAll(() => {
    baseUrl = process.env.API_E2E_BASE_URL as string;
  });

  it('recorre timeZone, busqueda de clientes, expand y filtro por sucursal', async () => {
    const taxId = `tax-web-admin-reads-e2e-${Date.now()}`;
    const registerCompanyResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company web admin reads e2e ${taxId}`,
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

    // --- Branch.timeZone: default y explicita
    const branchBody = {
      address: { line1: 'Av. Principal 123', city: 'CABA', country: 'AR' },
      operatingHours: [{ day: 'monday', open: '08:00', close: '18:00' }],
    };
    const branchA = await auth(request(baseUrl).post('/api/v1/branches')).send({
      name: 'Sucursal A',
      ...branchBody,
    });
    expect(branchA.status).toBe(201);
    const branchAId: string = branchA.body.data.id;
    const branchB = await auth(request(baseUrl).post('/api/v1/branches')).send({
      name: 'Sucursal B',
      timeZone: 'America/Mexico_City',
      ...branchBody,
    });
    expect(branchB.status).toBe(201);
    const branchBId: string = branchB.body.data.id;

    const getA = await auth(request(baseUrl).get(`/api/v1/branches/${branchAId}`));
    expect(getA.body.data.timeZone).toBe('America/Argentina/Buenos_Aires');
    const getB = await auth(request(baseUrl).get(`/api/v1/branches/${branchBId}`));
    expect(getB.body.data.timeZone).toBe('America/Mexico_City');

    const invalidTz = await auth(request(baseUrl).patch(`/api/v1/branches/${branchAId}`)).send({
      timeZone: 'Mars/Olympus_Mons',
    });
    expect(invalidTz.status).toBe(400);

    // --- Clientes: q (sin distinguir mayusculas, comodines literales) y cursor
    const customerIds: string[] = [];
    for (const [index, name] of ['Ana Gomez', 'Luis 100% Perez', 'Marta_Diaz'].entries()) {
      const response = await auth(request(baseUrl).post('/api/v1/customers')).send({
        name,
        taxIdOrDocumentId: `doc-${taxId}-${index}`,
        contactEmail: `cliente-${index}@example.com`,
        contactPhone: `+54110000000${index}`,
        customerType: 'Individual',
      });
      expect(response.status).toBe(201);
      customerIds.push(response.body.data.id as string);
    }

    const byName = await auth(request(baseUrl).get('/api/v1/customers?q=ana%20GO'));
    expect(byName.status).toBe(200);
    expect(byName.body.data.map((c: { name: string }) => c.name)).toEqual(['Ana Gomez']);

    const percent = await auth(request(baseUrl).get('/api/v1/customers?q=%25'));
    expect(percent.body.data.map((c: { name: string }) => c.name)).toEqual(['Luis 100% Perez']);
    const underscore = await auth(request(baseUrl).get('/api/v1/customers?q=_'));
    expect(underscore.body.data.map((c: { name: string }) => c.name)).toEqual(['Marta_Diaz']);

    const seen = new Set<string>();
    let cursor: string | undefined;
    let pages = 0;
    do {
      const query = cursor ? `?limit=2&cursor=${encodeURIComponent(cursor)}` : '?limit=2';
      const page = await auth(request(baseUrl).get(`/api/v1/customers${query}`));
      expect(page.status).toBe(200);
      expect(page.body.meta.limit).toBe(2);
      for (const item of page.body.data as { id: string }[]) {
        expect(seen.has(item.id)).toBe(false);
        seen.add(item.id);
      }
      cursor = page.body.meta.nextCursor ?? undefined;
      pages += 1;
      expect(pages).toBeLessThan(5);
    } while (cursor);
    expect([...seen].sort()).toEqual([...customerIds].sort());

    // --- Un vehiculo por sucursal y una reserva en cada uno
    const categoryResponse = await auth(request(baseUrl).post('/api/v1/vehicle-categories')).send({
      name: 'Economico web admin e2e',
    });
    const categoryId: string = categoryResponse.body.data.id;
    await auth(request(baseUrl).post(`/api/v1/vehicle-categories/${categoryId}/rates`)).send({
      amountMinorUnits: 50000,
      currency: 'USD',
      unit: 'Day',
      validFrom: '2026-01-01T00:00:00.000Z',
    });

    const vehicleIds: Record<string, string> = {};
    for (const [plate, branchId, vin] of [
      ['WEB-A001', branchAId, '3HGCM82633A444001'],
      ['WEB-B001', branchBId, '3HGCM82633A444002'],
    ]) {
      const response = await auth(request(baseUrl).post('/api/v1/vehicles')).send({
        branchId,
        vehicleCategoryId: categoryId,
        licensePlate: plate,
        vin,
      });
      expect(response.status).toBe(201);
      vehicleIds[plate] = response.body.data.id as string;
    }

    for (const plate of ['WEB-A001', 'WEB-B001']) {
      const response = await auth(request(baseUrl).post('/api/v1/reservations')).send({
        customerId: customerIds[0],
        vehicleId: vehicleIds[plate],
        ...futureRentalDates(),
      });
      expect(response.status).toBe(201);
    }

    // --- expand
    const expanded = await auth(
      request(baseUrl).get('/api/v1/reservations?expand=customer,vehicle'),
    );
    expect(expanded.status).toBe(200);
    expect(expanded.body.data).toHaveLength(2);
    for (const item of expanded.body.data as {
      customer: { name: string };
      vehicle: { licensePlate: string; branchId: string };
    }[]) {
      expect(item.customer).toEqual({ id: customerIds[0], name: 'Ana Gomez' });
      expect(['WEB-A001', 'WEB-B001']).toContain(item.vehicle.licensePlate);
    }
    const notExpanded = await auth(request(baseUrl).get('/api/v1/reservations'));
    expect(notExpanded.body.data[0]).not.toHaveProperty('customer');

    const invalidExpand = await auth(request(baseUrl).get('/api/v1/reservations?expand=invoices'));
    expect(invalidExpand.status).toBe(400);
    expect(invalidExpand.body.code).toBe('UNSUPPORTED_EXPAND');

    const reservationId: string = expanded.body.data[0].id;
    const detail = await auth(
      request(baseUrl).get(`/api/v1/reservations/${reservationId}?expand=vehicle`),
    );
    expect(detail.status).toBe(200);
    expect(detail.body.data.inspections).toEqual([]);
    expect(detail.body.data.vehicle.licensePlate).toMatch(/^WEB-/);

    // --- branchId para un usuario de alcance empresa
    const onlyA = await auth(
      request(baseUrl).get(`/api/v1/reservations?branchId=${branchAId}&expand=vehicle`),
    );
    expect(
      onlyA.body.data.map((r: { vehicle: { licensePlate: string } }) => r.vehicle.licensePlate),
    ).toEqual(['WEB-A001']);

    const vehiclesB = await auth(
      request(baseUrl).get(`/api/v1/vehicles?branchId=${branchBId}&status=Registered`),
    );
    expect(vehiclesB.status).toBe(200);
    expect(vehiclesB.body.data.map((v: { licensePlate: string }) => v.licensePlate)).toEqual([
      'WEB-B001',
    ]);
    const invalidStatus = await auth(request(baseUrl).get('/api/v1/vehicles?status=Rented'));
    expect(invalidStatus.status).toBe(400);

    // --- Usuario de sucursal A: el branchId del token manda, el del query se ignora
    const branchUser = await seedBranchUserForCompany(companyId, admin.systemRoleId, branchAId);
    const branchLogin = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({ companyId, email: branchUser.email, password: branchUser.password });
    expect(branchLogin.status).toBe(201);
    const asBranchUser = (req: request.Test) =>
      req.set('Authorization', `Bearer ${branchLogin.body.data.accessToken as string}`);

    const branchUserAskingB = await asBranchUser(
      request(baseUrl).get(`/api/v1/reservations?branchId=${branchBId}&expand=vehicle`),
    );
    expect(branchUserAskingB.status).toBe(200);
    expect(
      branchUserAskingB.body.data.map(
        (r: { vehicle: { licensePlate: string } }) => r.vehicle.licensePlate,
      ),
    ).toEqual(['WEB-A001']);

    const branchUserVehicles = await asBranchUser(
      request(baseUrl).get(`/api/v1/vehicles?branchId=${branchBId}`),
    );
    expect(
      branchUserVehicles.body.data.map((v: { licensePlate: string }) => v.licensePlate),
    ).toEqual(['WEB-A001']);
  });
});
