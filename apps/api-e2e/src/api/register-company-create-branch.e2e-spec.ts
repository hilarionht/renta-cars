import request from 'supertest';

import { seedAdminForCompany } from '../support/seed-identity';

// Criterio de salida de esta tanda (roadmap items 3-4, docs/01-ROADMAP.md SS2): registrar
// company -> crear branch. A diferencia del e2e de Identity, POST /companies SI es real via
// API (@Public(), autorregistro) - solo el primer usuario de la company nueva sigue
// necesitando SQL directo (seedAdminForCompany, gap aceptado en la tanda de Identity).
describe('POST /companies -> POST /branches', () => {
  let baseUrl: string;

  beforeAll(() => {
    baseUrl = process.env.API_E2E_BASE_URL as string;
  });

  async function registerCompany(taxId: string) {
    return request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company e2e ${taxId}`,
        taxId,
        billingContactEmail: 'billing@example.com',
      });
  }

  it('registra una company, crea una sucursal autenticado, y la lista de vuelta', async () => {
    const taxId = `tax-${Date.now()}-a`;
    const registerResponse = await registerCompany(taxId);
    expect(registerResponse.status).toBe(201);
    const companyId: string = registerResponse.body.data.id;

    const admin = await seedAdminForCompany(companyId);

    const loginResponse = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({ companyId, email: admin.adminEmail, password: admin.adminPassword });
    expect(loginResponse.status).toBe(201);
    const accessToken: string = loginResponse.body.data.accessToken;

    const createBranchResponse = await request(baseUrl)
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Sucursal Centro',
        address: { line1: 'Av. Siempre Viva 123', city: 'CABA', country: 'Argentina' },
        operatingHours: [{ day: 'monday', open: '09:00', close: '18:00' }],
      });
    expect(createBranchResponse.status).toBe(201);

    const listResponse = await request(baseUrl)
      .get('/api/v1/branches')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.data[0].name).toBe('Sucursal Centro');
  });

  it('rechaza un taxId duplicado con 409 DUPLICATE_TAX_ID', async () => {
    const taxId = `tax-${Date.now()}-dup`;
    const firstResponse = await registerCompany(taxId);
    expect(firstResponse.status).toBe(201);

    const secondResponse = await registerCompany(taxId);
    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.code).toBe('DUPLICATE_TAX_ID');
  });

  it('una company no ve las sucursales de otra company (RLS)', async () => {
    const registerA = await registerCompany(`tax-${Date.now()}-cross-a`);
    const companyAId: string = registerA.body.data.id;
    const adminA = await seedAdminForCompany(companyAId);
    const loginA = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({ companyId: companyAId, email: adminA.adminEmail, password: adminA.adminPassword });
    const tokenA: string = loginA.body.data.accessToken;

    await request(baseUrl)
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Sucursal de A',
        address: { line1: 'Calle A', city: 'Ciudad A', country: 'Pais A' },
        operatingHours: [],
      });

    const registerB = await registerCompany(`tax-${Date.now()}-cross-b`);
    const companyBId: string = registerB.body.data.id;
    const adminB = await seedAdminForCompany(companyBId);
    const loginB = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({ companyId: companyBId, email: adminB.adminEmail, password: adminB.adminPassword });
    const tokenB: string = loginB.body.data.accessToken;

    const listFromB = await request(baseUrl)
      .get('/api/v1/branches')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(listFromB.status).toBe(200);
    expect(listFromB.body.data).toHaveLength(0);
  });
});
