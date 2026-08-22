// Secuencia de bootstrap - docs/technical/03-BACKEND-ARCHITECTURE.md SS2. Pasos 2-3 (Helmet/
// CORS, ValidationPipe) agregados en el paso 9 de docs/engineering/10-BOOTSTRAP-PLAN.md.

// Primer import, sin excepcion (ver el comentario del propio archivo) - paso 12 de
// docs/engineering/10-BOOTSTRAP-PLAN.md.
import './instrumentation';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app/app.module';
import { validationExceptionFactory } from './app/errors/validation-exception-factory';

async function bootstrap(): Promise<void> {
  // rawBody:true - StripeWebhookController necesita el Buffer sin parsear de
  // POST /webhooks/v1/stripe para verificar la firma nativa del SDK
  // (stripe.webhooks.constructEvent, docs/contracts/06-WEBHOOKS.md) - Nest lo expone en
  // req.rawBody ademas del body ya parseado, sin desactivar el body-parser global.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.useLogger(app.get(Logger));

  // Necesario para leer la cookie httpOnly refresh_token en refresh/logout de clientes web
  // (docs/09-SEGURIDAD.md SS1, platform-identity-infrastructure/http/auth.controller.ts).
  app.use(cookieParser());

  const configService = app.get(ConfigService);
  const isProduction = configService.getOrThrow<string>('app.nodeEnv') === 'production';

  // docs/technical/07-SECURITY.md SS4: CSP explicita, HSTS activo salvo en desarrollo
  // local (esta API no sirve HTML/assets - CSP restrictiva por defecto es segura).
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // Default de helmet es SAMEORIGIN; docs/technical/07-SECURITY.md SS4 pide DENY.
      frameguard: { action: 'deny' },
      hsts: isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
    }),
  );

  // docs/technical/07-SECURITY.md SS4: lista explicita de origenes, nunca "*". Vacia hoy
  // (sin apps/web-admin todavia, paso 13) - bloquea todo cross-origin por defecto.
  const corsOrigins = configService.getOrThrow<string[]>('app.corsOrigins');
  app.enableCors({ origin: corsOrigins.length > 0 ? corsOrigins : false, credentials: true });

  // docs/technical/03-BACKEND-ARCHITECTURE.md SS5: whitelist + forbidNonWhitelisted
  // (rechaza campos no declarados, docs/contracts/03-REQUEST-RESPONSE-STANDARDS.md SS1.1)
  // + transform (coercion de tipos declarados).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );

  // docs/08-API-CONTRACTS.md SS1: recursos de negocio bajo /api/v1 - /health/* y
  // /webhooks/v1/* quedan fuera (docs/technical/03-BACKEND-ARCHITECTURE.md SS10,
  // docs/contracts/06-WEBHOOKS.md: rutas de webhook entrante, @Public(), nunca
  // Bearer-autenticadas, nunca bajo el namespace de recursos de tenant).
  app.setGlobalPrefix('api/v1', {
    exclude: ['health/live', 'health/ready', 'webhooks/v1/stripe', 'webhooks/v1/mercadopago'],
  });

  const port = configService.getOrThrow<number>('app.port');
  await app.listen(port);

  app.get(Logger).log(`apps/api escuchando en http://localhost:${port}`);
}

void bootstrap();
