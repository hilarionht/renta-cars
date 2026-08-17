import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ClsModule } from 'nestjs-cls';

import {
  RolesPermissionsModule,
  ROLES_PERMISSIONS_DOMAIN_ERROR_ENTRIES,
} from '@platform/roles-permissions/infrastructure';
import { UsersModule, USERS_DOMAIN_ERROR_ENTRIES } from '@platform/users/infrastructure';
import { IdentityModule, IDENTITY_DOMAIN_ERROR_ENTRIES } from '@platform/identity/infrastructure';
import {
  CompaniesModule,
  COMPANIES_DOMAIN_ERROR_ENTRIES,
} from '@platform/companies/infrastructure';
import { BranchesModule, BRANCHES_DOMAIN_ERROR_ENTRIES } from '@platform/branches/infrastructure';
import { AuditModule, AUDIT_DOMAIN_ERROR_ENTRIES } from '@platform/audit/infrastructure';
import { FilesModule, FILES_DOMAIN_ERROR_ENTRIES } from '@platform/files/infrastructure';

import appConfig from '../config/app.config';
import databaseConfig from '../config/database.config';
import { validate } from '../config/env.validation';
import jwtConfig from '../config/jwt.config';
import observabilityConfig from '../config/observability.config';
import redisConfig from '../config/redis.config';
import securityConfig from '../config/security.config';
import storageConfig from '../config/storage.config';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { CompanyStatusGuard } from './context/company-status.guard';
import { TenantContextGuard } from './context/tenant-context.guard';
import { AllExceptionsFilter } from './errors/all-exceptions.filter';
import { DomainExceptionFilter } from './errors/domain-exception.filter';
import { domainErrorRegistryProvider } from './errors/domain-error-registry';
import { HealthModule } from './health/health.module';
import { CorrelationIdInterceptor } from './interceptors/correlation-id.interceptor';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { ResponseEnvelopeInterceptor } from './interceptors/response-envelope.interceptor';
import { TimeoutInterceptor } from './interceptors/timeout.interceptor';
import { PrismaModule } from './persistence/prisma.module';

// Composicion de Identity & Access + Organization + Audit + Files (Fase 0 -
// docs/01-ROADMAP.md SS2, ultimo item pendiente - Settings/#8 sigue diferido). Orden de
// import: RolesPermissions -> Users -> Identity -> Companies -> Branches -> Audit -> Files,
// mismo orden de dependencia real y de composicion documentada
// (docs/technical/03-BACKEND-ARCHITECTURE.md SS1) - cada uno depende del anterior via su
// puerto publico (ROLE_LOOKUP_PORT, USER_LOOKUP_PORT; Companies/Branches no dependen de
// ningun otro modulo de negocio; Audit no depende de ninguno - escucha eventos de todos via
// EventEmitter2, nunca importa su codigo; Files tampoco depende de ningun otro modulo de
// negocio, solo de IntegrationProvidersModule, importado dentro de FilesModule mismo -
// apps/api nunca ve STORAGE_PROVIDER_PORT).
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        storageConfig,
        jwtConfig,
        securityConfig,
        observabilityConfig,
      ],
    }),
    // ClsModule (AsyncLocalStorage) antes que PrismaModule - RequestContext (poblado por
    // TenantContextGuard, leido por el Prisma Client Extension de tenant-scope) depende de
    // ClsService (libs/platform/persistence-kernel/src/request-context.ts).
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    // wildcard:true - Audit (platform-audit-infrastructure) escucha con @OnEvent('**'), el
    // doble comodin necesario para capturar eventType de dos segmentos ("Nombre.v1") bajo el
    // delimitador por defecto ('.'). Global automaticamente (EventEmitterModule.forRoot() no
    // necesita { global: true } explicito) - OutboxWriter (dentro de PrismaModule) inyecta
    // EventEmitter2 sin que este modulo lo exporte a mano.
    EventEmitterModule.forRoot({ wildcard: true }),
    PrismaModule,
    // docs/technical/03-BACKEND-ARCHITECTURE.md SS7 (ThrottlerGuard, ultimo guard de la
    // cadena) - limite unico global, ver security.config.ts sobre por que no se separo un
    // perfil "auth" mas estricto en esta tanda. Storage en memoria por proceso, no Redis
    // todavia - correcto para una unica instancia; una segunda instancia de apps/api
    // necesitaria storage compartido (paquete de terceros aparte de @nestjs/throttler, no
    // agregado sin discutirlo) para que el limite sea real entre instancias - gap
    // conocido, no silencioso.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const security = configService.getOrThrow<{
          throttle: { limit: number; ttlSeconds: number };
        }>('security');
        return [{ ttl: security.throttle.ttlSeconds * 1000, limit: security.throttle.limit }];
      },
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
    RolesPermissionsModule,
    UsersModule,
    IdentityModule,
    CompaniesModule,
    BranchesModule,
    AuditModule,
    FilesModule,
  ],
  providers: [
    domainErrorRegistryProvider(
      ROLES_PERMISSIONS_DOMAIN_ERROR_ENTRIES,
      USERS_DOMAIN_ERROR_ENTRIES,
      IDENTITY_DOMAIN_ERROR_ENTRIES,
      COMPANIES_DOMAIN_ERROR_ENTRIES,
      BRANCHES_DOMAIN_ERROR_ENTRIES,
      AUDIT_DOMAIN_ERROR_ENTRIES,
      FILES_DOMAIN_ERROR_ENTRIES,
    ),
    // Orden importa, e Nest lo evalua al REVES del orden de registro (el ultimo
    // registrado se prueba primero) - verificado a mano lanzando un DomainError real y
    // confirmando cual filtro lo capturaba antes de fijar este orden. AllExceptionsFilter
    // (@Catch() sin argumento, atrapa todo) va primero para que DomainExceptionFilter
    // (mas especifico) sea el que Nest prueba antes en tiempo de ejecucion.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
    // docs/technical/03-BACKEND-ARCHITECTURE.md SS8, orden de ejecucion.
    { provide: APP_INTERCEPTOR, useClass: CorrelationIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    // docs/technical/03-BACKEND-ARCHITECTURE.md SS7: JwtAuthGuard -> TenantContextGuard ->
    // CompanyStatusGuard -> [TenantModuleEnabledGuard, no existe todavia - necesita
    // CompanySettings.EnabledProductModules, Fase 0 item 8, deliberadamente fuera de esta
    // tanda - ver plan de implementacion] -> PermissionGuard (ya disponible via
    // @UseGuards() puntual, no global - nada puebla permissions[] todavia asi que aplicarlo
    // global bloquearia todo) -> ThrottlerGuard.
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantContextGuard },
    { provide: APP_GUARD, useClass: CompanyStatusGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
