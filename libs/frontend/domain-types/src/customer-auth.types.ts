// Verificado contra libs/products/rental/customers/infrastructure/src/http/dto/
// {request-customer-otp-request,verify-customer-otp-request}.dto.ts. AuthResponse
// (auth.types.ts) se reusa tal cual para el resultado de verify/refresh - misma forma
// exacta que CustomerAuthResponseDto en mobile (siempre trae refreshToken, X-Client-
// Platform: mobile).
export interface RequestCustomerOtpRequest {
  companyId: string;
  phone: string;
}

export interface VerifyCustomerOtpRequest {
  companyId: string;
  phone: string;
  code: string;
}
