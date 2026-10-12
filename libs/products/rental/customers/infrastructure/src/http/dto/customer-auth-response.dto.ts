// Espejo de AuthResponseDto (platform/identity/infrastructure) - refreshToken solo presente
// para mobile, web lo recibe unicamente via cookie httpOnly.
export class CustomerAuthResponseDto {
  accessToken!: string;
  refreshToken?: string;
}
