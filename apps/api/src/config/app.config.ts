import { registerAs } from '@nestjs/config';

// Namespace "app" - docs/engineering/07-CONFIGURATION.md SS1. CORS_ORIGINS se agrega en
// el paso 9 (Helmet+CORS ya tienen consumidor real: main.ts). Los toggles de SS5
// (SWAGGER_ENABLED, CACHE_INTERCEPTOR_ENABLED) siguen sin consumidor.
export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
}));
