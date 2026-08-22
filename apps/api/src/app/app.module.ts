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
import { CalendarModule, CALENDAR_DOMAIN_ERROR_ENTRIES } from '@platform/calendar/infrastructure';
import { SettingsModule, SETTINGS_DOMAIN_ERROR_ENTRIES } from '@platform/settings/infrastructure';
import { CustomersModule, CUSTOMERS_DOMAIN_ERROR_ENTRIES } from '@rental/customers/infrastructure';
import { VehiclesModule, VEHICLES_DOMAIN_ERROR_ENTRIES } from '@rental/vehicles/infrastructure';
import {
  ReservationsModule,
  RESERVATIONS_DOMAIN_ERROR_ENTRIES,
} from '@rental/reservations/infrastructure';
import { PaymentsModule, PAYMENTS_DOMAIN_ERROR_ENTRIES } from '@platform/payments/infrastructure';

import appConfig from '../config/app.config';
import databaseConfig from '../config/database.config';
import { validate } from '../config/env.validation';
import jwtConfig from '../config/jwt.config';
import observabilityConfig from '../config/observability.config';
import paymentsConfig from '../config/payments.config';
import redisConfig from '../config/redis.config';
import securityConfig from '../config/security.config';
import storageConfig from '../config/storage.config';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { CompanyStatusGuard } from './context/company-status.guard';
import { TenantContextGuard } from './context/tenant-context.guard';
import { TenantModuleEnabledGuard } from './context/tenant-module-enabled.guard';
import { AllExceptionsFilter } from './errors/all-exceptions.filter';
import { DomainExceptionFilter } from './errors/domain-exception.filter';
import { domainErrorRegistryProvider } from './errors/domain-error-registry';
import { HealthModule } from './health/health.module';
import { CorrelationIdInterceptor } from './interceptors/correlation-id.interceptor';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { ResponseEnvelopeInterceptor } from './interceptors/response-envelope.interceptor';
import { TimeoutInterceptor } from './interceptors/timeout.interceptor';
import { PrismaModule } from './persistence/prisma.module';

// Composicion completa de Fase 0 (docs/01-ROADMAP.md SS2 - los 9 items) + Fase 1 completa
// (docs/01-ROADMAP.md SS3: Customers, Vehicles, Calendar, Reservations) + Fase 2 item 1
// (Payments). Orden de import: RolesPermissions -> Users -> Identity -> Settings ->
// Companies -> Branches -> Audit -> Files -> Calendar -> Customers -> Vehicles ->
// Reservations -> Payments, mismo orden de dependencia real y de composicion documentada
// (docs/technical/03-BACKEND-ARCHITECTURE.md SS1) - cada uno depende del anterior via su
// puerto publico (ROLE_LOOKUP_PORT, USER_LOOKUP_PORT; Settings no depende de ningun otro
// modulo de negocio, pero Companies SI depende de Settings ahora - ver CompaniesModule - asi
// que Settings se importa antes; Audit no depende de ninguno - escucha eventos de todos via
// EventEmitter2, nunca importa su codigo; Files tampoco depende de ningun otro modulo de
// negocio, solo de IntegrationProvidersModule, importado dentro de FilesModule mismo -
// apps/api nunca ve STORAGE_PROVIDER_PORT; Calendar tampoco depende de ningun otro modulo;
// Vehicles SI depende de Branches - BranchesModule se importa dentro de VehiclesModule
// mismo, apps/api no lo ve directo, mismo patron que Files. Reservations es el primer
// consumidor real de los 5 puertos forward-looking de Customers/Vehicles/Calendar/Branches
// mas Settings extendido - importa esos 5 modulos dentro de ReservationsModule mismo, no
// visibles aca directamente (mismo patron que Vehicles->Branches). Payments, ultimo, NO
// depende de Reservations directamente (Commerce es 100% event-driven respecto de Rental
// Operations, docs/model/09-DEPENDENCIES.md SS2/SS3 - la coordinacion es via
// EventEmitter2/@OnEvent, nunca un import de modulo) - solo importa SettingsModule +
// IntegrationProvidersModule dentro de PaymentsModule mismo.
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
        paymentsConfig,
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
    SettingsModule,
    CompaniesModule,
    BranchesModule,
    AuditModule,
    FilesModule,
    CalendarModule,
    CustomersModule,
    VehiclesModule,
    ReservationsModule,
    PaymentsModule,
  ],
  providers: [
    domainErrorRegistryProvider(
      ROLES_PERMISSIONS_DOMAIN_ERROR_ENTRIES,
      USERS_DOMAIN_ERROR_ENTRIES,
      IDENTITY_DOMAIN_ERROR_ENTRIES,
      SETTINGS_DOMAIN_ERROR_ENTRIES,
      COMPANIES_DOMAIN_ERROR_ENTRIES,
      BRANCHES_DOMAIN_ERROR_ENTRIES,
      AUDIT_DOMAIN_ERROR_ENTRIES,
      FILES_DOMAIN_ERROR_ENTRIES,
      CALENDAR_DOMAIN_ERROR_ENTRIES,
      CUSTOMERS_DOMAIN_ERROR_ENTRIES,
      VEHICLES_DOMAIN_ERROR_ENTRIES,
      RESERVATIONS_DOMAIN_ERROR_ENTRIES,
      PAYMENTS_DOMAIN_ERROR_ENTRIES,
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
    // CompanyStatusGuard -> TenantModuleEnabledGuard (opt-in via @RequiresProductModule(),
    // pasa siempre en rutas sin el decorator - ninguna ruta de Fase 0 lo usa, el primer
    // consumidor real llega con Fase 1/libs/products/rental) -> PermissionGuard (ya
    // disponible via @UseGuards() puntual, no global - nada puebla permissions[] todavia asi
    // que aplicarlo global bloquearia todo) -> ThrottlerGuard.
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantContextGuard },
    { provide: APP_GUARD, useClass: CompanyStatusGuard },
    { provide: APP_GUARD, useClass: TenantModuleEnabledGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
