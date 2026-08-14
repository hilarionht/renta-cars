import { IsEmail, IsString, IsUUID, Length } from 'class-validator';

// companyId requerido: email es unico POR company (INV-014), no globalmente - sin este
// campo el login no puede saber contra que company verificar credenciales si el mismo
// email existe en mas de una (gap real no resuelto por ningun doc, ver reporte final).
export class LoginRequestDto {
  @IsUUID()
  companyId!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Length(1, 200)
  password!: string;
}
