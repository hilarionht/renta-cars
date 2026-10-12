import { Body, Controller, Headers, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, seconds } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { AUTH_THROTTLE_PROFILE, Public } from '@platform/persistence-kernel';
import {
  RefreshCustomerSessionHandler,
  RequestCustomerOtpHandler,
  RevokeCustomerSessionHandler,
  VerifyCustomerOtpHandler,
} from '@rental/customers/application';

import {
  CLIENT_PLATFORM_HEADER,
  CUSTOMER_REFRESH_TOKEN_COOKIE,
  resolveClientPlatform,
} from './customer-client-platform';
import type { CustomerAuthResponseDto } from './dto/customer-auth-response.dto';
import { CustomerRefreshRequestDto } from './dto/customer-refresh-request.dto';
import { RequestCustomerOtpRequestDto } from './dto/request-customer-otp-request.dto';
import { VerifyCustomerOtpRequestDto } from './dto/verify-customer-otp-request.dto';

type RequestWithCookies = Request & { cookies?: Record<string, string> };

// docs/persistence/10-DECISIONES.md #109 - espejo de AuthController (platform/identity/
// infrastructure), mismo criterio de @Public() en las 4 rutas: request/verify-otp no tienen
// JWT todavia, refresh/logout solo necesitan el refresh token, no un access_token valido.
// CustomerActorGuard NUNCA se aplica aca (ninguna de estas rutas lo necesita) - solo en
// me-reservations.controller.ts (commit 5), donde SI hay un access_token que verificar.
@Controller('customers/auth')
export class CustomerAuthController {
  constructor(
    private readonly requestOtpHandler: RequestCustomerOtpHandler,
    private readonly verifyOtpHandler: VerifyCustomerOtpHandler,
    private readonly refreshHandler: RefreshCustomerSessionHandler,
    private readonly revokeHandler: RevokeCustomerSessionHandler,
    private readonly configService: ConfigService,
  ) {}

  // Mismo perfil AUTH que /auth/login (docs/09-SEGURIDAD.md SS6) - blanco directo de
  // fuerza bruta, tanto de enumeracion de telefonos como de spam de WhatsApp.
  @Throttle({
    default: { limit: AUTH_THROTTLE_PROFILE.limit, ttl: seconds(AUTH_THROTTLE_PROFILE.ttlSeconds) },
  })
  @Public()
  @Post('otp/request')
  async requestOtp(@Body() dto: RequestCustomerOtpRequestDto): Promise<void> {
    await this.requestOtpHandler.execute({ companyId: dto.companyId, phone: dto.phone });
  }

  @Throttle({
    default: { limit: AUTH_THROTTLE_PROFILE.limit, ttl: seconds(AUTH_THROTTLE_PROFILE.ttlSeconds) },
  })
  @Public()
  @Post('otp/verify')
  async verifyOtp(
    @Body() dto: VerifyCustomerOtpRequestDto,
    @Headers(CLIENT_PLATFORM_HEADER) platformHeader: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CustomerAuthResponseDto> {
    const result = await this.verifyOtpHandler.execute({
      companyId: dto.companyId,
      phone: dto.phone,
      code: dto.code,
    });

    return this.respondWithTokens(
      result.accessToken,
      result.refreshToken,
      platformHeader,
      response,
    );
  }

  @Throttle({
    default: { limit: AUTH_THROTTLE_PROFILE.limit, ttl: seconds(AUTH_THROTTLE_PROFILE.ttlSeconds) },
  })
  @Public()
  @Post('refresh')
  async refresh(
    @Body() dto: CustomerRefreshRequestDto,
    @Req() request: RequestWithCookies,
    @Headers(CLIENT_PLATFORM_HEADER) platformHeader: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CustomerAuthResponseDto> {
    const refreshToken = this.extractRefreshToken(dto, request);
    const result = await this.refreshHandler.execute({ refreshToken });

    return this.respondWithTokens(
      result.accessToken,
      result.refreshToken,
      platformHeader,
      response,
    );
  }

  @Public()
  @Post('logout')
  async logout(
    @Body() dto: CustomerRefreshRequestDto,
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const refreshToken = this.extractRefreshToken(dto, request);
    await this.revokeHandler.execute({ refreshToken, reason: 'logout' });
    response.clearCookie(CUSTOMER_REFRESH_TOKEN_COOKIE);
  }

  private extractRefreshToken(dto: CustomerRefreshRequestDto, request: RequestWithCookies): string {
    const cookies = request.cookies as Record<string, string> | undefined;
    return dto.refreshToken ?? cookies?.[CUSTOMER_REFRESH_TOKEN_COOKIE] ?? '';
  }

  private respondWithTokens(
    accessToken: string,
    refreshToken: string,
    platformHeader: unknown,
    response: Response,
  ): CustomerAuthResponseDto {
    const platform = resolveClientPlatform(platformHeader);

    if (platform === 'web') {
      const isProduction = this.configService.getOrThrow<string>('app.nodeEnv') === 'production';
      response.cookie(CUSTOMER_REFRESH_TOKEN_COOKIE, refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
      });
      return { accessToken };
    }

    return { accessToken, refreshToken };
  }
}
