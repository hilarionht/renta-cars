import request from 'supertest';

import { seedAdminForCompany } from '../support/seed-identity';

// Verifica de punta a punta el ultimo item pendiente de Fase 0 (Settings/#8, alcance
// acotado a EnabledProductModules + PaymentMethodsEnabled - docs/persistence/
// 10-DECISIONES.md): CompanySettings se crea junto con Company (sin ningun paso adicional),
// GET la devuelve con los defaults de Plataforma, PATCH actualiza cada politica y queda
// auditada.
describe('Settings: defaults automaticos, PATCH y auditoria', () => {
  let baseUrl: string;

  beforeAll(() => {
    baseUrl = process.env.API_E2E_BASE_URL as string;
  });

  it('CompanySettings se crea con defaults al registrar la company, PATCH actualiza y queda en el audit log', async () => {
    const taxId = `tax-settings-e2e-${Date.now()}`;
    const registerResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company settings e2e ${taxId}`,
        taxId,
        billingContactEmail: 'billing@example.com',
      });
    expect(registerResponse.status).toBe(201);
    const companyId: string = registerResponse.body.data.id;

    const admin = await seedAdminForCompany(companyId);
    const loginResponse = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({ companyId, email: admin.adminEmail, password: admin.adminPassword });
    expect(loginResponse.status).toBe(201);
    const accessToken: string = loginResponse.body.data.accessToken;

    // Creado automaticamente en la misma transaccion que Company - sin ningun paso extra.
    const getDefaults = await request(baseUrl)
      .get('/api/v1/company-settings')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getDefaults.status).toBe(200);
    expect(getDefaults.body.data).toMatchObject({
      companyId,
      enabledProductModules: ['Rental'],
    });
    expect(getDefaults.body.data.paymentMethodsEnabled.sort()).toEqual(
      ['Card', 'Cash', 'DigitalWallet', 'Transfer'].sort(),
    );

    const patchResponse = await request(baseUrl)
      .patch('/api/v1/company-settings/payment-methods-enabled')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ paymentMethodsEnabled: ['Card', 'Transfer'] });
    expect(patchResponse.status).toBe(200);

    const getAfterPatch = await request(baseUrl)
      .get('/api/v1/company-settings')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getAfterPatch.body.data.paymentMethodsEnabled).toEqual(['Card', 'Transfer']);

    const emptyPatchResponse = await request(baseUrl)
      .patch('/api/v1/company-settings/payment-methods-enabled')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ paymentMethodsEnabled: [] });
    expect(emptyPatchResponse.status).toBe(422);
    expect(emptyPatchResponse.body.code).toBe('PAYMENT_METHODS_EMPTY');

    const auditLogResponse = await request(baseUrl)
      .get('/api/v1/audit-log')
      .set('Authorization', `Bearer ${accessToken}`);
    const updatedEntry = (
      auditLogResponse.body.data as Array<{
        action: string;
        subjectType: string;
        payload: { policyName?: string; newValueSummary?: string };
      }>
    ).find((entry) => entry.action === 'CompanySettingsUpdated.v1');
    expect(updatedEntry).toMatchObject({
      subjectType: 'CompanySettings',
      payload: {
        policyName: 'payment-methods-enabled',
        newValueSummary: JSON.stringify(['Card', 'Transfer']),
      },
    });
  });
});
