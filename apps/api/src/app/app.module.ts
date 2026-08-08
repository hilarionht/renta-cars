import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import appConfig from '../config/app.config';
import databaseConfig from '../config/database.config';
import { validate } from '../config/env.validation';
import jwtConfig from '../config/jwt.config';
import observabilityConfig from '../config/observability.config';
import redisConfig from '../config/redis.config';
import storageConfig from '../config/storage.config';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './errors/all-exceptions.filter';
import { DomainExceptionFilter } from './errors/domain-exception.filter';
import { emptyDomainErrorRegistryProvider } from './errors/domain-error-registry';
import { HealthModule } from './health/health.module';

// AppModule vacio salvo ConfigModule global (paso 7 de docs/engineering/10-BOOTSTRAP-PLAN.md)
// - ningun modulo de negocio todavia. HealthModule no es un modulo de negocio, es
// composicion transversal ya exigida por ese mismo paso. Namespaces validados
// (docs/engineering/07-CONFIGURATION.md SS1/SS4) agregados en el paso 8; Filters con
// registro de errores de dominio vacio en el paso 9.
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      load: [appConfig, databaseConfig, redisConfig, storageConfig, jwtConfig, observabilityConfig],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.getOrThrow<string>('app.nodeEnv') === 'production';
        // pino-opentelemetry-transport lee OTEL_EXPORTER_OTLP_ENDPOINT/OTEL_SERVICE_NAME
        // directo del entorno (mismos valores que src/instrumentation.ts) - envía logs JSON
        // al mismo otel-collector que recibe trazas/métricas (docs/engineering/
        // 08-OBSERVABILITY-BOOTSTRAP.md §1), no bloqueante si el collector no está arriba.
        // pino-pretty solo en desarrollo, para legibilidad de consola - ninguno de los dos
        // reemplaza al otro, `targets` hace fan-out a ambos.
        const otlpTarget = { target: 'pino-opentelemetry-transport', options: {}, level: 'debug' };
        return {
          pinoHttp: {
            level: configService.getOrThrow<string>('app.logLevel'),
            transport: {
              targets: isProduction
                ? [otlpTarget]
                : [otlpTarget, { target: 'pino-pretty', options: {}, level: 'debug' }],
            },
          },
        };
      },
    }),
    AuthModule,
    HealthModule,
  ],
  providers: [
    emptyDomainErrorRegistryProvider,
    // Orden importa, e Nest lo evalua al REVES del orden de registro (el ultimo
    // registrado se prueba primero) - verificado a mano lanzando un DomainError real y
    // confirmando cual filtro lo capturaba antes de fijar este orden. AllExceptionsFilter
    // (@Catch() sin argumento, atrapa todo) va primero para que DomainExceptionFilter
    // (mas especifico) sea el que Nest prueba antes en tiempo de ejecucion.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class AppModule {}
