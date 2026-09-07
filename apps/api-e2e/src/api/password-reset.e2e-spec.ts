import request from 'supertest';
import { Client } from 'pg';

import { seedAdminForCompany } from '../support/seed-identity';

// Recuperacion de contraseña (docs/persistence/10-DECISIONES.md #113). Un token de reset de
// 32 bytes es inadivinable (2^256, a diferencia del OTP de 6 digitos que
// customer-self-service.e2e-spec.ts fuerza-brutea) - el token en claro se recupera de
// support.fake_notification_sends, escrito por FakeNotificationSenderAdapter solo cuando
// NOTIFICATION_SENDER_PROVIDER=fake (default en e2e).
describe('Recuperacion de contraseña: forgot-password -> reset-password -> login', () => {
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

  async function recoverResetToken(email: string): Promise<string> {
    const result = await dbClient.query<{ token: string }>(
      `SELECT template_params->>'token' AS token FROM support.fake_notification_sends
       WHERE template_id = 'user-password-reset' AND recipient_email = $1
       ORDER BY created_at DESC LIMIT 1`,
      [email],
    );
    const token = result.rows[0]?.token;
    if (!token) {
      throw new Error(`No se encontro un fake_notification_send para "${email}".`);
    }
    return token;
  }

  it('ciclo completo: token real cambia la contraseña, la vieja deja de funcionar, el token no se puede reusar', async () => {
    const taxId = `tax-password-reset-e2e-${Date.now()}`;
    const registerCompanyResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company password reset e2e ${taxId}`,
        taxId,
        billingContactEmail: 'billing@example.com',
      });
    expect(registerCompanyResponse.status).toBe(201);
    const companyId: string = registerCompanyResponse.body.data.id;

    const admin = await seedAdminForCompany(companyId);

    const forgotResponse = await request(baseUrl)
      .post('/api/v1/auth/forgot-password')
      .send({ companyId, email: admin.adminEmail });
    expect(forgotResponse.status).toBe(201);

    const token = await recoverResetToken(admin.adminEmail);

    const resetResponse = await request(baseUrl)
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'BrandNewSecret!456' });
    expect(resetResponse.status).toBe(201);

    const loginOldResponse = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({ companyId, email: admin.adminEmail, password: admin.adminPassword });
    expect(loginOldResponse.status).toBe(401);

    const loginNewResponse = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({ companyId, email: admin.adminEmail, password: 'BrandNewSecret!456' });
    expect(loginNewResponse.status).toBe(201);

    // Replay del mismo token ya consumido - 401 limpio, nunca 409 (docs/persistence/
    // 10-DECISIONES.md #113, misma leccion que #111).
    const replayResponse = await request(baseUrl)
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'OtraClaveNueva!789' });
    expect(replayResponse.status).toBe(401);
    expect(replayResponse.body.code).toBe('PASSWORD_RESET_TOKEN_INVALID');
  });

  it('forgot-password con un email inexistente responde igual que uno real (anti-enumeracion)', async () => {
    const taxId = `tax-password-reset-unknown-e2e-${Date.now()}`;
    const registerCompanyResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company password reset unknown e2e ${taxId}`,
        taxId,
        billingContactEmail: 'billing@example.com',
      });
    expect(registerCompanyResponse.status).toBe(201);
    const companyId: string = registerCompanyResponse.body.data.id;

    const forgotResponse = await request(baseUrl)
      .post('/api/v1/auth/forgot-password')
      .send({ companyId, email: 'no-existe@example.com' });
    expect(forgotResponse.status).toBe(201);
  });

  it('reset-password con un token invalido/inexistente devuelve 401 limpio', async () => {
    const response = await request(baseUrl)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'token-que-nunca-existio', newPassword: 'OtraClaveNueva!789' });
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('PASSWORD_RESET_TOKEN_INVALID');
  });
});
