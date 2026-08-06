import { registerAs } from '@nestjs/config';

// Namespace "app" - docs/engineering/07-CONFIGURATION.md SS1. Solo PORT/NODE_ENV/LOG_LEVEL
// tienen consumidor real en este paso (main.ts, logger de nestjs-pino); CORS_ORIGINS
// (paso 9) y los toggles de SS5 (SWAGGER_ENABLED, CACHE_INTERCEPTOR_ENABLED) se agregan
// cuando exista el codigo que los consuma.
export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  logLevel: process.env.LOG_LEVEL ?? 'info',
}));
