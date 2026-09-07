import request from 'supertest';

import { seedCompanyWithAdmin, type SeededCompany } from '../support/seed-identity';

// Criterio de salida literal de Fase 0 (docs/01-ROADMAP.md SS2, plan de implementacion):
// crear usuario -> asignar rol -> login. Solo el actor autenticado inicial (un admin
// sembrado directo en Postgres, ver seed-identity.ts) usa un atajo fuera de la API - el
// resto del flujo pasa integro por HTTP, contra apps/api real y Postgres real.
describe('POST /api/v1/users -> login como el usuario nuevo', () => {
  let seeded: SeededCompany;
  let baseUrl: string;
  let adminAccessToken: string;

  beforeAll(async () => {
    baseUrl = process.env.API_E2E_BASE_URL as string;
    seeded = await seedCompanyWithAdmin();

    const loginResponse = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({
        companyId: seeded.companyId,
        email: seeded.adminEmail,
        password: seeded.adminPassword,
      });
    adminAccessToken = loginResponse.body.data.accessToken;
  });

  it('crea un usuario con un rol asignado, y ese usuario puede loguearse con la contrasena dada', async () => {
    const newUserEmail = `nuevo-${Date.now()}@example.com`;
    const newUserPassword = 'OtraPass!456789';

    const createResponse = await request(baseUrl)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        email: newUserEmail,
        password: newUserPassword,
        name: 'Usuario Nuevo E2E',
        roles: [seeded.systemRoleId],
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.id).toEqual(expect.any(String));

    const loginAsNewUserResponse = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({ companyId: seeded.companyId, email: newUserEmail, password: newUserPassword });

    expect(loginAsNewUserResponse.status).toBe(201);
    expect(loginAsNewUserResponse.body.data.accessToken).toEqual(expect.any(String));
  });

  it('rechaza crear un usuario sin JWT (POST /api/v1/users no es @Public())', async () => {
    const response = await request(baseUrl)
      .post('/api/v1/users')
      .send({
        email: 'sin-auth@example.com',
        password: 'Sup3rSecret!123',
        name: 'Sin Auth',
        roles: [],
      });

    expect(response.status).toBe(401);
  });

  it('rechaza crear un usuario con un roleId que no existe ni es System (422 VALIDATION_FAILED)', async () => {
    const response = await request(baseUrl)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        email: `otro-${Date.now()}@example.com`,
        password: 'OtraPass!456789',
        name: 'Otro Usuario',
        roles: ['00000000-0000-0000-0000-000000000000'],
      });

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('VALIDATION_FAILED');
  });
});
