import { IsEmail, IsUUID } from 'class-validator';

// companyId requerido - mismo motivo que LoginRequestDto: email es unico POR company
// (INV-014), no globalmente.
export class ForgotPasswordRequestDto {
  @IsUUID()
  companyId!: string;

  @IsEmail()
  email!: string;
}
