import request from 'supertest';

import { seedAdminForCompany } from '../support/seed-identity';

// Verifica de punta a punta el flujo completo de Files (Fase 0 item #9, ultimo pendiente del
// roadmap): POST /files/upload-url (URL firmada de subida) -> PUT real del binario directo a
// MinIO (nunca via apps/api) -> POST /files/confirm-upload (crea el File, emite
// FileUploaded.v1) -> GET /files/:id/signed-url -> descarga y compara bytes -> DELETE
// /files/:id (emite FileDeleted.v1) -> reintento de signed-url da 409 FILE_ALREADY_DELETED.
// Corre contra el MinIO real de Testcontainers (global-setup.ts), no el de docker-compose
// local - el e2e queda autocontenido.
describe('Files: upload-url -> confirm -> signed-url -> delete', () => {
  let baseUrl: string;

  beforeAll(() => {
    baseUrl = process.env.API_E2E_BASE_URL as string;
  });

  it('sube un archivo, lo confirma, lo descarga via signed-url, lo elimina, y confirma FILE_ALREADY_DELETED en el reintento', async () => {
    const taxId = `tax-files-e2e-${Date.now()}`;
    const registerResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company files e2e ${taxId}`,
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

    const uploadUrlResponse = await request(baseUrl)
      .post('/api/v1/files/upload-url')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ contentType: 'application/pdf' });
    expect(uploadUrlResponse.status).toBe(201);
    const { storageRef, uploadUrl } = uploadUrlResponse.body.data;

    const fileBytes = Buffer.from('contenido de prueba del e2e de Files');
    const putResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: fileBytes,
      headers: { 'Content-Type': 'application/pdf' },
    });
    expect(putResponse.ok).toBe(true);

    const confirmResponse = await request(baseUrl)
      .post('/api/v1/files/confirm-upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ storageRef, contentType: 'application/pdf' });
    expect(confirmResponse.status).toBe(201);
    const fileId: string = confirmResponse.body.data.id;

    const signedUrlResponse = await request(baseUrl)
      .get(`/api/v1/files/${fileId}/signed-url`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(signedUrlResponse.status).toBe(200);

    const downloadResponse = await fetch(signedUrlResponse.body.data.url);
    const downloaded = Buffer.from(await downloadResponse.arrayBuffer());
    expect(downloaded.equals(fileBytes)).toBe(true);

    const deleteResponse = await request(baseUrl)
      .delete(`/api/v1/files/${fileId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(deleteResponse.status).toBe(200);

    const retryResponse = await request(baseUrl)
      .get(`/api/v1/files/${fileId}/signed-url`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(retryResponse.status).toBe(409);
    expect(retryResponse.body.code).toBe('FILE_ALREADY_DELETED');
  });

  it('rechaza un contentType fuera del allowlist con 422 UNSUPPORTED_CONTENT_TYPE', async () => {
    const taxId = `tax-files-e2e-reject-${Date.now()}`;
    const registerResponse = await request(baseUrl)
      .post('/api/v1/companies')
      .send({
        legalName: `Company files e2e reject ${taxId}`,
        taxId,
        billingContactEmail: 'billing@example.com',
      });
    const companyId: string = registerResponse.body.data.id;

    const admin = await seedAdminForCompany(companyId);
    const loginResponse = await request(baseUrl)
      .post('/api/v1/auth/login')
      .send({ companyId, email: admin.adminEmail, password: admin.adminPassword });
    const accessToken: string = loginResponse.body.data.accessToken;

    const uploadUrlResponse = await request(baseUrl)
      .post('/api/v1/files/upload-url')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ contentType: 'application/x-msdownload' });

    expect(uploadUrlResponse.status).toBe(422);
    expect(uploadUrlResponse.body.code).toBe('UNSUPPORTED_CONTENT_TYPE');
  });
});
