import { IsDateString, IsIn, IsString } from 'class-validator';

const DOCUMENT_TYPES = ['PropertyCard', 'Insurance', 'CirculationPermit'] as const;

export class UploadVehicleDocumentRequestDto {
  @IsIn(DOCUMENT_TYPES)
  documentType!: string;

  // fileId ya confirmado por Files (POST /files/confirm-upload) - se confia tal cual, sin
  // verificar contra Files (mismo gap aceptado que Customers).
  @IsString()
  fileId!: string;

  @IsDateString()
  expiryDate!: string;
}
