import request from 'supertest';

import { seedCompanyWithAdmin, type SeededCompany } from '../support/seed-identity';

// Flujo completo de docs/model/08-STATE_MACHINES.md SS6.2 (Session): login -> refresh
// (rotacion) -> reuso de un refresh_token ya rotado dispara deteccion de robo (revoca TODAS
// las sesiones activas, INV-015) -> logout idempotente. Contra apps/api real (caja negra
// HTTP) y Postgres real (Testcontainers) - no en memoria.
describe('POST /api/v1/auth/login, /refresh, /logout', () => {
  let seeded: SeededCompany;
  let baseUrl: string;

  beforeAll(async () => {
    baseUrl = process.env.API_E2E_BASE_URL as string;
    seeded = await seedCompanyWithAdmin();
  });

  function login() {
    return request(baseUrl)
      .post('/api/v1/auth/login')
      .send({
        companyId: seeded.companyId,
        email: seeded.adminEmail,
        password: seeded.adminPassword,
      });
  }

  it('login con credenciales validas devuelve un access_token y setea la cookie refresh_token (X-Client-Platform ausente = web)', async () => {
    const response = await login();

    expect(response.status).toBe(201);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).toBeUndefined();
    // @types/superagent tipa `set-cookie` como `string` a secas, pero Node siempre lo entrega
    // como string[] cuando el header aparece (uno por cada Set-Cookie de la response).
    const setCookie = response.headers['set-cookie'] as unknown as string[];
    expect(setCookie.join(';')).toContain('refresh_token=');
    expect(setCookie.join(';')).toContain('HttpOnly');
  });

  it('login con password incorrecto devuelve 401 INVALID_CREDENTIALS', async () => {
    const response = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({ companyId: seeded.companyId, email: seeded.adminEmail, password: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('X-Client-Platform: mobile devuelve el refresh_token en el body, sin cookie', async () => {
    const response = await request(baseUrl)
      .post('/api/v1/auth/login')
      .set('X-Client-Platform', 'mobile')
      .send({
        companyId: seeded.companyId,
        email: seeded.adminEmail,
        password: seeded.adminPassword,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.refreshToken).toEqual(expect.any(String));
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('refresh rota el token; reusar el token viejo dispara deteccion de robo y revoca la sesion nueva tambien', async () => {
    const loginResponse = await login();
    const refreshTokenV1 = extractRefreshTokenCookie(loginResponse);

    const refreshResponse = await request(baseUrl)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${refreshTokenV1}`)
      .send({});
    expect(refreshResponse.status).toBe(201);
    const refreshTokenV2 = extractRefreshTokenCookie(refreshResponse);
    expect(refreshTokenV2).not.toBe(refreshTokenV1);

    // Reusar refreshTokenV1 (ya Rotated) - dispara robo: TOKEN_INVALID, y revoca la V2 tambien.
    const reuseResponse = await request(baseUrl)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${refreshTokenV1}`)
      .send({});
    expect(reuseResponse.status).toBe(401);
    expect(reuseResponse.body.code).toBe('TOKEN_INVALID');

    const v2NowRevokedResponse = await request(baseUrl)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${refreshTokenV2}`)
      .send({});
    expect(v2NowRevokedResponse.status).toBe(401);
    expect(v2NowRevokedResponse.body.code).toBe('TOKEN_INVALID');
  });

  it('logout es idempotente y un refresh posterior con el mismo token falla como token invalido', async () => {
    const loginResponse = await login();
    const refreshToken = extractRefreshTokenCookie(loginResponse);

    const logoutResponse = await request(baseUrl)
      .post('/api/v1/auth/logout')
      .set('Cookie', `refresh_token=${refreshToken}`)
      .send({});
    expect(logoutResponse.status).toBe(201);

    const secondLogoutResponse = await request(baseUrl)
      .post('/api/v1/auth/logout')
      .set('Cookie', `refresh_token=${refreshToken}`)
      .send({});
    expect(secondLogoutResponse.status).toBe(201);

    const refreshAfterLogoutResponse = await request(baseUrl)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${refreshToken}`)
      .send({});
    expect(refreshAfterLogoutResponse.status).toBe(401);
    expect(refreshAfterLogoutResponse.body.code).toBe('TOKEN_INVALID');
  });
});

function extractRefreshTokenCookie(response: request.Response): string {
  const setCookie = response.headers['set-cookie'] as unknown as string[];
  const cookie = setCookie.find((entry) => entry.startsWith('refresh_token='));
  if (!cookie) {
    throw new Error('Respuesta sin cookie refresh_token');
  }
  return cookie.split(';')[0].split('=')[1];
}
