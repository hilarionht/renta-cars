import request from 'supertest';

// Unico golden path de este paso (docs/engineering/10-BOOTSTRAP-PLAN.md, paso 10) - el
// primer flujo de negocio real se agrega en Fase 0/1 (docs/10-TESTING.md SS5).
describe('GET /health/ready', () => {
  it('responde ok con Postgres y Redis reales', async () => {
    const baseUrl = process.env.API_E2E_BASE_URL;
    expect(baseUrl).toBeDefined();

    const response = await request(baseUrl as string).get('/health/ready');

    expect(response.status).toBe(200);
    // Envuelto en {data, meta} desde que ResponseEnvelopeInterceptor se volvio APP_INTERCEPTOR
    // global (Identity & Access, Fase 0) - antes health/* era el unico endpoint real y
    // ningun interceptor corria sobre el todavia.
    expect(response.body).toMatchObject({ data: { status: 'ok' } });
  });
});
