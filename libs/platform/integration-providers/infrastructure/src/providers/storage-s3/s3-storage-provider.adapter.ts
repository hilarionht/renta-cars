import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type {
  DeleteObjectInput,
  GetSignedUrlInput,
  GetSignedUrlResult,
  RequestUploadUrlInput,
  RequestUploadUrlResult,
  StorageProviderPort,
  VerifyUploadedObjectInput,
  VerifyUploadedObjectResult,
} from '@platform/files/application';

interface StorageConfig {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
}

// docs/11-INTEGRACIONES.md SS11 / docs/ADR/0010: unico adaptador para MinIO local y
// cualquier proveedor S3-compatible real de produccion - forcePathStyle:true es lo que lo
// hace funcionar contra ambos sin cambiar codigo, solo variables de entorno.
const UPLOAD_URL_TTL_SECONDS = 300;
const READ_URL_TTL_SECONDS = 300;

@Injectable()
export class S3StorageProviderAdapter implements StorageProviderPort {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(configService: ConfigService) {
    const storage = configService.getOrThrow<StorageConfig>('storage');
    this.bucket = storage.bucket;
    this.client = new S3Client({
      endpoint: storage.endpoint,
      region: storage.region,
      forcePathStyle: true,
      credentials: { accessKeyId: storage.accessKey, secretAccessKey: storage.secretKey },
    });
  }

  async getUploadUrl(input: RequestUploadUrlInput): Promise<RequestUploadUrlResult> {
    // Opaco, namespaced por tenant - nunca interpretado, solo comparado por igualdad.
    const storageRef = `${input.companyId}/${randomUUID()}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageRef,
      ContentType: input.contentType,
    });
    // ContentType se pasa al comando para que quede como metadata del objeto subido (asi
    // verifyUploadedObject puede reportarlo despues), pero NO queda firmado: el
    // S3RequestPresigner de AWS SDK v3 agrega "content-type" a unsignableHeaders de forma
    // incondicional (verificado en node_modules/@aws-sdk/s3-request-presigner, no solo
    // supuesto) - un PUT con un Content-Type distinto al declarado aca NO es rechazado por
    // storage. El enforcement real es post-hoc, en ConfirmUploadHandler, comparando contra
    // lo que verifyUploadedObject mide de verdad - ver docs/persistence/10-DECISIONES.md.
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
    });
    return {
      storageRef,
      uploadUrl,
      expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000),
    };
  }

  async verifyUploadedObject(
    input: VerifyUploadedObjectInput,
  ): Promise<VerifyUploadedObjectResult> {
    try {
      const head = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: input.storageRef }),
      );
      return { exists: true, sizeBytes: head.ContentLength, contentType: head.ContentType };
    } catch (error) {
      if (error instanceof NotFound) {
        return { exists: false };
      }
      throw error;
    }
  }

  async getSignedUrl(input: GetSignedUrlInput): Promise<GetSignedUrlResult> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: input.storageRef });
    const url = await getSignedUrl(this.client, command, { expiresIn: READ_URL_TTL_SECONDS });
    return { url, expiresAt: new Date(Date.now() + READ_URL_TTL_SECONDS * 1000) };
  }

  async deleteObject(input: DeleteObjectInput): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: input.storageRef }));
  }
}
