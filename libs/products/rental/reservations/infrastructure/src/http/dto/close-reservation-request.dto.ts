import { IsBoolean } from 'class-validator';

export class CloseReservationRequestDto {
  @IsBoolean()
  hasInvoiceIssued!: boolean;
}
