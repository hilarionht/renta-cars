// Secuencia de bootstrap - docs/technical/03-BACKEND-ARCHITECTURE.md SS2. En este paso
// (7 de docs/engineering/10-BOOTSTRAP-PLAN.md) solo los pasos que no dependen de modulos
// de negocio ni de seguridad transversal (Helmet/CORS/ValidationPipe/Filters llegan en el
// paso 9): crear la app con el logger estructurado ya configurado, y escuchar.

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app/app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // docs/08-API-CONTRACTS.md SS1: recursos de negocio bajo /api/v1 - /health/* queda fuera
  // (docs/technical/03-BACKEND-ARCHITECTURE.md SS10, rutas exactas sin prefijo).
  app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  app.get(Logger).log(`apps/api escuchando en http://localhost:${port}`);
}

void bootstrap();
