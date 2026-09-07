import { Controller, Delete, Get, Header, Param, ParseUUIDPipe, Post, Body } from '@nestjs/common';

import { RequestContext, RequirePermission } from '@platform/persistence-kernel';
import {
  ConfirmUploadHandler,
  DeleteFileHandler,
  GetSignedUrlHandler,
  RequestUploadUrlHandler,
} from '@platform/files/application';

import { ConfirmUploadRequestDto } from './dto/confirm-upload-request.dto';
import type { RequestUploadUrlResponseDto } from './dto/request-upload-url-response.dto';
import { RequestUploadUrlRequestDto } from './dto/request-upload-url-request.dto';
import type { SignedUrlResponseDto } from './dto/signed-url-response.dto';

// docs/contracts/02-RESOURCE-CATALOG.md SS6: "files" siempre escopeado por la company del
// token. upload-url/confirm-upload son acciones de coleccion (POST /files/upload-url, no
// POST /files/{id}/...) - no existe ningun File todavia en el momento de pedir la URL o
// confirmar, asi que no hay {id} del cual colgar la accion (excepcion documentada a la
// convencion habitual de {id}/accion).
@Controller('files')
export class FilesController {
  constructor(
    private readonly requestUploadUrl: RequestUploadUrlHandler,
    private readonly confirmUpload: ConfirmUploadHandler,
    private readonly getSignedUrl: GetSignedUrlHandler,
    private readonly deleteFile: DeleteFileHandler,
    private readonly requestContext: RequestContext,
  ) {}

  @Post('upload-url')
  @RequirePermission('files:upload')
  async requestUpload(
    @Body() dto: RequestUploadUrlRequestDto,
  ): Promise<RequestUploadUrlResponseDto> {
    const { companyId, userId } = this.requestContext.get();
    const result = await this.requestUploadUrl.execute({
      companyId,
      uploadedBy: userId,
      contentType: dto.contentType,
    });
    return {
      storageRef: result.storageRef,
      uploadUrl: result.uploadUrl,
      expiresAt: result.expiresAt.toISOString(),
    };
  }

  @Post('confirm-upload')
  @RequirePermission('files:upload')
  async confirm(@Body() dto: ConfirmUploadRequestDto): Promise<{ id: string }> {
    const { companyId, userId } = this.requestContext.get();
    const id = await this.confirmUpload.execute({
      companyId,
      uploadedBy: userId,
      storageRef: dto.storageRef,
      contentType: dto.contentType,
    });
    return { id: id.toString() };
  }

  // no-store deliberado: la URL es una credencial efimera de un solo uso, no una
  // representacion estable del recurso.
  @Header('Cache-Control', 'no-store')
  @Get(':id/signed-url')
  async signedUrl(@Param('id', ParseUUIDPipe) id: string): Promise<SignedUrlResponseDto> {
    const { companyId } = this.requestContext.get();
    const result = await this.getSignedUrl.execute({ fileId: id, companyId });
    return { url: result.url, expiresAt: result.expiresAt.toISOString() };
  }

  @Delete(':id')
  @RequirePermission('files:delete')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.deleteFile.execute({ fileId: id, companyId });
  }
}
