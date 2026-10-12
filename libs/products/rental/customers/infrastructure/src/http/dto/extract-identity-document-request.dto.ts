import { IsString } from 'class-validator';

export class ExtractIdentityDocumentRequestDto {
  // fileId ya confirmado por Files (POST /files/confirm-upload) - mismo criterio que
  // UploadIdentityDocumentRequestDto: se confia tal cual, sin verificar contra Files.
  @IsString()
  fileId!: string;
}
