import request from 'supertest';

import { seedAdminForCompany } from '../support/seed-identity';

// RBAC completo (Fase 4 item 2, docs/persistence/10-DECISIONES.md #103+). El admin sembrado
// por seedAdminForCompany() tiene el catalogo completo de permisos (bootstrap de test
// omniscente) - este e2e es el unico que ejercita un rol curado con permisos limitados,
// creado via la API real (POST /roles), para probar PermissionGuard de punta a punta: 403
// en una ruta sin el permiso, 201 en una con el permiso, y que PATCH /roles/:id/permissions
// invalida el cache sin necesitar re-login (mismo JWT, mismo roles[] - solo permissions[]
// cambia server-side).
describe('RBAC: PermissionGuard, rol curado, e invalidacion de cache', () => {
  let baseUrl: string;

  beforeAll(() => {
    baseUrl = process.env.API_E2E_BASE_URL as string;
  });

  it('403 sin el permiso, 201 con el permiso, y la invalidacion de cache aplica sin re-login', async () => {
    const taxId = `tax-permissions-e2e-${Date.now()}`;
    const registerCompanyResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company permissions e2e ${taxId}`,
        taxId,
        billingContactEmail: 'billing@example.com',
      });
    expect(registerCompanyResponse.status).toBe(201);
    const companyId: string = registerCompanyResponse.body.data.id;

    const admin = await seedAdminForCompany(companyId);
    const adminLoginResponse = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({ companyId, email: admin.adminEmail, password: admin.adminPassword });
    expect(adminLoginResponse.status).toBe(201);
    const adminAccessToken: string = adminLoginResponse.body.data.accessToken;

    // Rol curado: solo customers:create - branches:create se agrega mas adelante.
    const createRoleResponse = await request(baseUrl)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ roleName: 'Agente de Reservas E2E', permissions: ['customers:create'] });
    expect(createRoleResponse.status).toBe(201);
    const curatedRoleId: string = createRoleResponse.body.data.id;

    const curatedEmail = `curado-${Date.now()}@example.com`;
    const curatedPassword = 'CuradoPass!789012';
    const createUserResponse = await request(baseUrl)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        email: curatedEmail,
        password: curatedPassword,
        name: 'Usuario Curado E2E',
        roles: [curatedRoleId],
      });
    expect(createUserResponse.status).toBe(201);

    const curatedLoginResponse = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({ companyId, email: curatedEmail, password: curatedPassword });
    expect(curatedLoginResponse.status).toBe(201);
    const curatedAccessToken: string = curatedLoginResponse.body.data.accessToken;

    // Sin branches:create -> 403 FORBIDDEN.
    const forbiddenResponse = await request(baseUrl)
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${curatedAccessToken}`)
      .send({
        name: 'Sucursal sin permiso',
        address: { line1: 'Calle Falsa 123', city: 'CABA', country: 'Argentina' },
        operatingHours: [],
      });
    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenResponse.body.code).toBe('FORBIDDEN');

    // Con customers:create -> 201.
    const allowedResponse = await request(baseUrl)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${curatedAccessToken}`)
      .send({
        name: 'Cliente E2E',
        taxIdOrDocumentId: `doc-${Date.now()}`,
        contactEmail: 'cliente@example.com',
        contactPhone: '+541100000000',
        customerType: 'Individual',
      });
    expect(allowedResponse.status).toBe(201);

    // El admin agrega branches:create al rol curado.
    const editPermissionsResponse = await request(baseUrl)
      .patch(`/api/v1/roles/${curatedRoleId}/permissions`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ permissions: ['customers:create', 'branches:create'] });
    expect(editPermissionsResponse.status).toBe(200);

    // Mismo JWT, sin re-login - la invalidacion de RolePermissionsChanged.v1 debe aplicar de
    // inmediato (CachedRoleLookupAdapter.onPermissionsChanged).
    const retryResponse = await request(baseUrl)
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${curatedAccessToken}`)
      .send({
        name: 'Sucursal con permiso',
        address: { line1: 'Calle Falsa 123', city: 'CABA', country: 'Argentina' },
        operatingHours: [],
      });
    expect(retryResponse.status).toBe(201);
  });
});
