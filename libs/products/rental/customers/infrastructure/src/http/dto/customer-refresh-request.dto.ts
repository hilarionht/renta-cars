import { IsOptional, IsString } from 'class-validator';

// Espejo de RefreshRequestDto (platform/identity/infrastructure) - solo se usa para mobile
// (el refresh_token viaja en el body), web lo manda en la cookie httpOnly.
export class CustomerRefreshRequestDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
