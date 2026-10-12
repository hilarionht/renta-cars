import { IsString, MinLength } from 'class-validator';

export class VoidInvoiceRequestDto {
  @IsString()
  @MinLength(1)
  reason!: string;
}
