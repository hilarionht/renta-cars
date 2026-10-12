// refreshToken solo presente para mobile - web lo recibe unicamente via cookie httpOnly,
// nunca en este body (decision X-Client-Platform de esta tanda, ver plan).
export class AuthResponseDto {
  accessToken!: string;
  refreshToken?: string;
}
