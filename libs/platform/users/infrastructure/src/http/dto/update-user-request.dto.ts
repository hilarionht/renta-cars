import { IsOptional, IsString, IsUUID, Length, ValidateIf } from 'class-validator';

// docs/persistence/10-DECISIONES.md #140: PATCH /users/:id. El email no se edita (es el login).
// branchId null quita la sucursal (usuario de toda la company).
export class UpdateUserRequestDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsUUID('7')
  branchId?: string | null;
}
