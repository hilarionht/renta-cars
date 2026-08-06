import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import appConfig from '../config/app.config';
import databaseConfig from '../config/database.config';
import { validate } from '../config/env.validation';
import redisConfig from '../config/redis.config';
import storageConfig from '../config/storage.config';
import { HealthModule } from './health/health.module';

// AppModule vacio salvo ConfigModule global (paso 7 de docs/engineering/10-BOOTSTRAP-PLAN.md)
// - ningun modulo de negocio todavia. HealthModule no es un modulo de negocio, es
// composicion transversal ya exigida por ese mismo paso. Namespaces validados
// (docs/engineering/07-CONFIGURATION.md SS1/SS4) agregados en el paso 8.
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      load: [appConfig, databaseConfig, redisConfig, storageConfig],
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
    HealthModule,
  ],
})
export class AppModule {}
