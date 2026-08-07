import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import appConfig from '../config/app.config';
import databaseConfig from '../config/database.config';
import { validate } from '../config/env.validation';
import jwtConfig from '../config/jwt.config';
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
      load: [appConfig, databaseConfig, redisConfig, storageConfig, jwtConfig],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          level: configService.getOrThrow<string>('app.logLevel'),
          transport:
            configService.getOrThrow<string>('app.nodeEnv') === 'production'
              ? undefined
              : { target: 'pino-pretty' },
        },
      }),
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
