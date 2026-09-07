import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

const DOCUMENT_TYPES = ['NationalId', 'DriversLicense'] as const;

export class UploadIdentityDocumentRequestDto {
  @IsIn(DOCUMENT_TYPES)
  documentType!: string;

  // fileId ya confirmado por Files (POST /files/confirm-upload) - se confia tal cual, sin
  // verificar contra Files (docs/persistence/10-DECISIONES.md, gap aceptado).
  @IsString()
  fileId!: string;

  @IsDateString()
  expiryDate!: string;

  // Si se provee, el documento pertenece a ese AdditionalDriver (debe pertenecer a este
  // Customer); si se omite, pertenece al propio Customer.
  @IsOptional()
  @IsUUID()
  additionalDriverId?: string;

  // true si el operador uso POST .../identity-documents/extract (OCR) y confirmo/edito la
  // sugerencia antes de este upload. Omitido = false (captura 100% manual).
  @IsOptional()
  @IsBoolean()
  extractedByOcr?: boolean;
}
