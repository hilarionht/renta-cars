import request from 'supertest';

import { seedCompanyWithAdmin, type SeededCompany } from '../support/seed-identity';

interface NotificationSummary {
  id: string;
  kind: string;
  status: string;
  recipientEmail?: string;
  templateId: string;
  channel?: string;
}

interface AuditLogEntrySummary {
  action: string;
  subjectType: string;
  subjectId: string;
}

// Verifica de punta a punta el motor de Notifications (Fase 3 item 1): POST /api/v1/users ->
// User.create() emite UserCreated.v1 -> UserWelcomeNotificationListener (@OnEvent) ->
// SendNotificationHandler (adaptador fake, NOTIFICATION_SENDER_PROVIDER=fake por defecto) ->
// Notification Pending -> Sent (canal preferido default de CompanySettings, Email) ->
// GET /api/v1/notifications. Mismo criterio de polling que audit-log.e2e-spec.ts: el listener
// corre fire-and-forget (OutboxWriter.emit(), nunca emitAsync()), asi que la lectura es
// consistente-eventual respecto del POST que la origino.
async function pollNotifications(
  baseUrl: string,
  accessToken: string,
  predicate: (items: NotificationSummary[]) => boolean,
  { timeoutMs = 5000, intervalMs = 100 } = {},
): Promise<NotificationSummary[]> {
  const deadline = Date.now() + timeoutMs;
  let items: NotificationSummary[] = [];
  do {
    const response = await request(baseUrl)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${accessToken}`);
    items = response.body.data;
    if (predicate(items)) return items;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (Date.now() < deadline);
  return items;
}

async function pollAuditLog(
  baseUrl: string,
  accessToken: string,
  predicate: (entries: AuditLogEntrySummary[]) => boolean,
  { timeoutMs = 5000, intervalMs = 100 } = {},
): Promise<AuditLogEntrySummary[]> {
  const deadline = Date.now() + timeoutMs;
  let entries: AuditLogEntrySummary[] = [];
  do {
    const response = await request(baseUrl)
      .get('/api/v1/audit-log')
      .set('Authorization', `Bearer ${accessToken}`);
    entries = response.body.data;
    if (predicate(entries)) return entries;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (Date.now() < deadline);
  return entries;
}

describe('UserCreated.v1 -> notificacion de bienvenida (Fase 3 item 1)', () => {
  let seeded: SeededCompany;
  let baseUrl: string;
  let adminAccessToken: string;

  beforeAll(async () => {
    baseUrl = process.env.API_E2E_BASE_URL as string;
    seeded = await seedCompanyWithAdmin();

    const loginResponse = await request(baseUrl).post('/api/v1/auth/login').send({
      companyId: seeded.companyId,
      email: seeded.adminEmail,
      password: seeded.adminPassword,
    });
    adminAccessToken = loginResponse.body.data.accessToken;
  });

  it('crea un Notification Sent/Alert/Email para el usuario nuevo, y NotificationSent.v1 queda en el audit log', async () => {
    const newUserEmail = `bienvenida-${Date.now()}@example.com`;

    const createResponse = await request(baseUrl)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        email: newUserEmail,
        password: 'OtraPass!456789',
        name: 'Usuario Bienvenida E2E',
        roles: [seeded.systemRoleId],
      });
    expect(createResponse.status).toBe(201);

    const notifications = await pollNotifications(baseUrl, adminAccessToken, (items) =>
      items.some((item) => item.recipientEmail === newUserEmail && item.status === 'Sent'),
    );

    const welcome = notifications.find((item) => item.recipientEmail === newUserEmail);
    expect(welcome).toMatchObject({
      kind: 'Alert',
      status: 'Sent',
      templateId: 'user-welcome',
      channel: 'Email',
    });

    const auditEntries = await pollAuditLog(baseUrl, adminAccessToken, (entries) =>
      entries.some(
        (entry) => entry.action === 'NotificationSent.v1' && entry.subjectId === welcome?.id,
      ),
    );
    expect(
      auditEntries.some(
        (entry) =>
          entry.action === 'NotificationSent.v1' &&
          entry.subjectType === 'Notification' &&
          entry.subjectId === welcome?.id,
      ),
    ).toBe(true);
  });

  it('GET /notifications/:id devuelve el detalle completo', async () => {
    const newUserEmail = `bienvenida-detalle-${Date.now()}@example.com`;

    await request(baseUrl)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        email: newUserEmail,
        password: 'OtraPass!456789',
        name: 'Usuario Bienvenida Detalle E2E',
        roles: [seeded.systemRoleId],
      });

    const notifications = await pollNotifications(baseUrl, adminAccessToken, (items) =>
      items.some((item) => item.recipientEmail === newUserEmail && item.status === 'Sent'),
    );
    const welcome = notifications.find((item) => item.recipientEmail === newUserEmail);

    const detailResponse = await request(baseUrl)
      .get(`/api/v1/notifications/${welcome?.id}`)
      .set('Authorization', `Bearer ${adminAccessToken}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data).toMatchObject({
      id: welcome?.id,
      kind: 'Alert',
      status: 'Sent',
      recipientEmail: newUserEmail,
      templateId: 'user-welcome',
      channel: 'Email',
    });
  });
});
