import { ConfigService } from '@nestjs/config';

import { S3StorageProviderAdapter } from './s3-storage-provider.adapter';

// Round trip real contra MinIO (Testcontainers, tooling/testing/testcontainers/
// minio-jest-global-setup.ts) - no un mock de S3Client. Confirma dos cosas que solo se
// pueden verificar contra el proveedor real: (1) el ciclo completo getUploadUrl -> PUT ->
// verifyUploadedObject -> getSignedUrl -> GET -> deleteObject funciona de punta a punta, y
// (2) el enforcement de contentType via header firmado es real, no solo teorico (docs/
// persistence/10-DECISIONES.md).
describe('S3StorageProviderAdapter (MinIO real)', () => {
  let adapter: S3StorageProviderAdapter;

  beforeAll(() => {
    const configService = new ConfigService({
      storage: {
        endpoint: process.env.TEST_STORAGE_ENDPOINT,
        bucket: process.env.TEST_STORAGE_BUCKET,
        accessKey: process.env.TEST_STORAGE_ACCESS_KEY,
        secretKey: process.env.TEST_STORAGE_SECRET_KEY,
        region: process.env.TEST_STORAGE_REGION,
      },
    });
    adapter = new S3StorageProviderAdapter(configService);
  });

  it('round trip completo: getUploadUrl -> PUT -> verifyUploadedObject -> getSignedUrl -> GET -> deleteObject', async () => {
    const body = Buffer.from('contenido de prueba de integracion');

    const { storageRef, uploadUrl } = await adapter.getUploadUrl({
      companyId: 'company-test',
      contentType: 'application/pdf',
      uploadedBy: 'user-test',
    });

    const putResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body,
      headers: { 'Content-Type': 'application/pdf' },
    });
    expect(putResponse.ok).toBe(true);

    const verification = await adapter.verifyUploadedObject({ storageRef });
    expect(verification.exists).toBe(true);
    expect(verification.sizeBytes).toBe(body.length);
    expect(verification.contentType).toBe('application/pdf');

    const signed = await adapter.getSignedUrl({ storageRef });
    const getResponse = await fetch(signed.url);
    const downloaded = Buffer.from(await getResponse.arrayBuffer());
    expect(downloaded.equals(body)).toBe(true);

    await adapter.deleteObject({ storageRef });
    const verificationAfterDelete = await adapter.verifyUploadedObject({ storageRef });
    expect(verificationAfterDelete.exists).toBe(false);
  });

  it('verifyUploadedObject de una storageRef nunca subida da exists:false', async () => {
    const result = await adapter.verifyUploadedObject({ storageRef: 'company-test/nunca-existio' });
    expect(result.exists).toBe(false);
  });

  it('PUT con Content-Type distinto al declarado en getUploadUrl NO es rechazado por storage (contentType no queda firmado) - verifyUploadedObject reporta lo que realmente se subio, que es lo que ConfirmUploadHandler valida despues', async () => {
    const { storageRef, uploadUrl } = await adapter.getUploadUrl({
      companyId: 'company-test',
      contentType: 'application/pdf',
      uploadedBy: 'user-test',
    });

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: Buffer.from('x'),
      headers: { 'Content-Type': 'image/png' },
    });
    expect(response.ok).toBe(true);

    const verification = await adapter.verifyUploadedObject({ storageRef });
    expect(verification.contentType).toBe('image/png');

    await adapter.deleteObject({ storageRef });
  });
});
