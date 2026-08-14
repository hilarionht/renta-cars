import { IsOptional, IsString } from 'class-validator';

// Solo se usa para mobile (el refresh_token viaja en el body) - web lo manda en la cookie
// httpOnly, el body queda vacio (decision X-Client-Platform de esta tanda, ver plan).
export class RefreshRequestDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
