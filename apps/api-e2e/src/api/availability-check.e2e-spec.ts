import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { Client } from 'pg';

import { seedAdminForCompany } from '../support/seed-identity';

// Verifica de punta a punta el tercer item de Fase 1 (Calendar, docs/01-ROADMAP.md §3):
// registrar company -> GET /availability sin slots (disponible) -> sembrar un AvailabilitySlot
// Active directo via SQL (sin endpoint publico de creacion - CalendarPort es DI-only, sin
// consumidor real todavia, mismo criterio que Branch antes de tener su propio endpoint en
// tandas previas) -> GET /availability en el rango solapado (no disponible) -> fuera del
// rango (disponible) -> recurso distinto (disponible).
describe('Availability: consulta de disponibilidad de solo lectura', () => {
  let baseUrl: string;

  beforeAll(() => {
    baseUrl = process.env.API_E2E_BASE_URL as string;
  });

  it('GET /availability refleja slots Active sembrados directamente', async () => {
    const taxId = `tax-availability-e2e-${Date.now()}`;
    const registerCompanyResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company availability e2e ${taxId}`,
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

    const resourceId = randomUUID();

    const beforeSeedResponse = await request(baseUrl)
      .get('/api/v1/availability')
      .query({
        resourceType: 'vehicle',
        resourceId,
        startDate: '2026-03-01T00:00:00.000Z',
        endDate: '2026-03-10T00:00:00.000Z',
      })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(beforeSeedResponse.status).toBe(200);
    expect(beforeSeedResponse.body.data.available).toBe(true);

    const client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await client.connect();
    try {
      await client.query(
        `INSERT INTO scheduling.availability_slots (id, company_id, resource_type, resource_id, start_date, end_date, slot_type, reason, status, updated_at, version)
         VALUES ($1, $2, 'vehicle', $3, '2026-03-05T00:00:00.000Z', '2026-03-15T00:00:00.000Z', 'Blackout', 'mantenimiento', 'Active', now(), 1)`,
        [randomUUID(), companyId, resourceId],
      );
    } finally {
      await client.end();
    }

    const overlappingResponse = await request(baseUrl)
      .get('/api/v1/availability')
      .query({
        resourceType: 'vehicle',
        resourceId,
        startDate: '2026-03-01T00:00:00.000Z',
        endDate: '2026-03-10T00:00:00.000Z',
      })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(overlappingResponse.status).toBe(200);
    expect(overlappingResponse.body.data.available).toBe(false);

    const outsideRangeResponse = await request(baseUrl)
      .get('/api/v1/availability')
      .query({
        resourceType: 'vehicle',
        resourceId,
        startDate: '2026-04-01T00:00:00.000Z',
        endDate: '2026-04-10T00:00:00.000Z',
      })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(outsideRangeResponse.status).toBe(200);
    expect(outsideRangeResponse.body.data.available).toBe(true);

    const differentResourceResponse = await request(baseUrl)
      .get('/api/v1/availability')
      .query({
        resourceType: 'vehicle',
        resourceId: randomUUID(),
        startDate: '2026-03-01T00:00:00.000Z',
        endDate: '2026-03-10T00:00:00.000Z',
      })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(differentResourceResponse.status).toBe(200);
    expect(differentResourceResponse.body.data.available).toBe(true);
  });

  it('rechaza query params faltantes con 400 VALIDATION_FAILED', async () => {
    const taxId = `tax-availability-e2e-invalid-${Date.now()}`;
    const registerCompanyResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company availability e2e invalid ${taxId}`,
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
      .get('/api/v1/availability')
      .query({ resourceType: 'vehicle', resourceId: randomUUID() })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_FAILED');
  });
});
