import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { HealthModule } from './health/health.module';

// AppModule vacio salvo ConfigModule global (paso 7 de docs/engineering/10-BOOTSTRAP-PLAN.md)
// - ningun modulo de negocio todavia. HealthModule no es un modulo de negocio, es
// composicion transversal ya exigida por este mismo paso.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
      },
    }),
    HealthModule,
  ],
})
export class AppModule {}
