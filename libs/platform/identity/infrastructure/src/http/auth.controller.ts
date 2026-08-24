import { Body, Controller, Headers, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, seconds } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { AUTH_THROTTLE_PROFILE, Public } from '@platform/persistence-kernel';
import {
  LoginHandler,
  RefreshSessionHandler,
  RevokeSessionHandler,
} from '@platform/identity/application';

import {
  CLIENT_PLATFORM_HEADER,
  REFRESH_TOKEN_COOKIE,
  resolveClientPlatform,
} from './client-platform';
import type { AuthResponseDto } from './dto/auth-response.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { RefreshRequestDto } from './dto/refresh-request.dto';

type RequestWithCookies = Request & { cookies?: Record<string, string> };

// docs/contracts/02-RESOURCE-CATALOG.md SS1: "auth" es una accion sin recurso raiz - login/
// refresh/logout orquestan Session, no son CRUD. login/refresh son @Public() (sin
// JwtAuthGuard, ver auth.module.ts de apps/api) - todavia no hay tenant en esos endpoints.
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginHandler: LoginHandler,
    private readonly refreshHandler: RefreshSessionHandler,
    private readonly revokeHandler: RevokeSessionHandler,
    private readonly configService: ConfigService,
  ) {}

  // Perfil AUTH (docs/09-SEGURIDAD.md SS6): mas estricto que el limite general - blanco
  // directo de fuerza bruta de credenciales.
  @Throttle({
    default: { limit: AUTH_THROTTLE_PROFILE.limit, ttl: seconds(AUTH_THROTTLE_PROFILE.ttlSeconds) },
  })
  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginRequestDto,
    @Headers(CLIENT_PLATFORM_HEADER) platformHeader: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.loginHandler.execute({
      companyId: dto.companyId,
      email: dto.email,
      password: dto.password,
    });

    return this.respondWithTokens(
      result.accessToken,
      result.refreshToken,
      platformHeader,
      response,
    );
  }

  // Perfil AUTH (docs/09-SEGURIDAD.md SS6): un refresh token robado es tan sensible como
  // una contrasena - mismo limite estricto que login, no el general.
  @Throttle({
    default: { limit: AUTH_THROTTLE_PROFILE.limit, ttl: seconds(AUTH_THROTTLE_PROFILE.ttlSeconds) },
  })
  @Public()
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshRequestDto,
    @Req() request: RequestWithCookies,
    @Headers(CLIENT_PLATFORM_HEADER) platformHeader: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
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
    @Body() dto: RefreshRequestDto,
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const refreshToken = this.extractRefreshToken(dto, request);
    await this.revokeHandler.execute({ refreshToken, reason: 'logout' });
    response.clearCookie(REFRESH_TOKEN_COOKIE);
  }

  // req.cookies lo puebla cookie-parser (apps/api/src/main.ts) - un refresh_token ausente
  // (ni body ni cookie) se manda tal cual al handler, que lo trata como token invalido
  // comun (InvalidRefreshTokenError) igual que cualquier otro valor desconocido.
  private extractRefreshToken(dto: RefreshRequestDto, request: RequestWithCookies): string {
    // @types/cookie-parser declara `Request.cookies` como `any` via augmentacion global de
    // Express - el cast explicito evita que ese `any` se propague (no-unsafe-member-access).
    const cookies = request.cookies as Record<string, string> | undefined;
    return dto.refreshToken ?? cookies?.[REFRESH_TOKEN_COOKIE] ?? '';
  }

  private respondWithTokens(
    accessToken: string,
    refreshToken: string,
    platformHeader: unknown,
    response: Response,
  ): AuthResponseDto {
    const platform = resolveClientPlatform(platformHeader);

    if (platform === 'web') {
      const isProduction = this.configService.getOrThrow<string>('app.nodeEnv') === 'production';
      response.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
      });
      return { accessToken };
    }

    return { accessToken, refreshToken };
  }
}
