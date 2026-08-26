import { IsString, IsUUID, Length } from 'class-validator';

// companyId explicito, igual que LoginRequestDto - la ruta es @Public() (sin RequestContext
// poblado), y MfaLoginChallengeRepository.findById() necesita conocer el tenant ANTES de
// leer (ReadTransaction.run fija el GUC de RLS antes de la query, no despues) - mismo motivo
// que RefreshCustomerSessionHandler/CustomerRepository.findById(id, companyId?).
export class MfaVerifyRequestDto {
  @IsUUID()
  mfaChallengeId!: string;

  @IsUUID()
  companyId!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
