import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

// Esquema de validacion fail-fast - docs/engineering/07-CONFIGURATION.md SS4. Misma
// libreria que los DTOs de entrada HTTP (docs/08-API-CONTRACTS.md SS2, class-validator),
// por consistencia de herramientas. Solo las variables que ya tienen consumidor en este
// paso (docs/engineering/10-BOOTSTRAP-PLAN.md, paso 8): app/database/redis/storage.

const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;
const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

class EnvironmentVariables {
  // --- app (docs/engineering/07-CONFIGURATION.md SS1) ---
  @IsOptional()
  @IsIn(NODE_ENVIRONMENTS)
  NODE_ENV?: (typeof NODE_ENVIRONMENTS)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsOptional()
  @IsIn(LOG_LEVELS)
  LOG_LEVEL?: (typeof LOG_LEVELS)[number];

  // Lista separada por comas, nunca "*" (docs/technical/07-SECURITY.md SS4). Opcional: sin
  // valor, CORS no permite ningun origen cross-site (default mas estricto, no mas laxo).
  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  // --- database ---
  @IsString()
  DATABASE_URL!: string;

  // Rol de runtime de la app, sujeto a RLS - docs/persistence/06-RLS.md §3. DATABASE_URL
  // (rol dueño de las tablas) sigue siendo el que usan las migraciones (prisma.config.ts,
  // tooling/scripts/db/migrate.ts), nunca la app.
  @IsString()
  APP_DATABASE_URL!: string;

  // Rol BYPASSRLS, usado exclusivamente por PlatformAdminPrismaService - docs/persistence/
  // 06-RLS.md §5 / 10-DECISIONES.md #121. Nunca el pool normal de apps/api.
  @IsString()
  PLATFORM_ADMIN_DATABASE_URL!: string;

  // --- redis ---
  @IsString()
  REDIS_URL!: string;

  // --- storage ---
  @IsString()
  STORAGE_ENDPOINT!: string;

  @IsString()
  STORAGE_BUCKET!: string;

  @IsString()
  STORAGE_ACCESS_KEY!: string;

  @IsString()
  STORAGE_SECRET_KEY!: string;

  @IsString()
  STORAGE_REGION!: string;

  // Opcional: tiene default en codigo (storage.config.ts) - mismo criterio que
  // JWT_ACCESS_TTL/JWT_REFRESH_TTL.
  @IsOptional()
  @IsInt()
  @Min(1)
  STORAGE_MAX_UPLOAD_BYTES?: number;

  // --- jwt (docs/technical/07-SECURITY.md SS1, generadas con
  // tooling/scripts/security/generate-jwt-keys.ts) ---
  @IsString()
  JWT_PRIVATE_KEY!: string;

  @IsString()
  JWT_PUBLIC_KEY!: string;

  @IsString()
  JWT_ACTIVE_KID!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  JWT_ACCESS_TTL?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  JWT_REFRESH_TTL?: number;

  // --- mfa (MfaSecretCipher, docs/persistence/10-DECISIONES.md #111) --- Opcional a nivel
  // de schema (MFA es opt-in por User, no un feature-wide toggle obligatorio al boot como
  // JWT) - Aes256GcmMfaSecretCipher valida el formato real (32 bytes hex) en su propio
  // constructor y falla ahi si falta/es invalida. Generar con: openssl rand -hex 32.
  @IsOptional()
  @IsString()
  MFA_SECRET_ENCRYPTION_KEY?: string;

  // --- payments (PaymentGatewayPort, docs/11-INTEGRACIONES.md SS6) ---
  // Todas opcionales: "fake" (default en payments.config.ts) no requiere credenciales -
  // Stripe/MercadoPago sin credenciales reales en este entorno de desarrollo.
  @IsOptional()
  @IsIn(['fake', 'stripe', 'mercadopago'])
  PAYMENT_GATEWAY_PROVIDER?: 'fake' | 'stripe' | 'mercadopago';

  @IsOptional()
  @IsString()
  STRIPE_SECRET_KEY?: string;

  @IsOptional()
  @IsString()
  STRIPE_WEBHOOK_SECRET?: string;

  @IsOptional()
  @IsString()
  MERCADOPAGO_ACCESS_TOKEN?: string;

  @IsOptional()
  @IsString()
  MERCADOPAGO_WEBHOOK_SECRET?: string;

  // --- notifications (NOTIFICATION_SENDER_PORT/PUSH_NOTIFICATION_SENDER_PORT,
  // docs/11-INTEGRACIONES.md SS3-5) --- Todas opcionales: "fake" (default en
  // notifications.config.ts) no requiere credenciales - WhatsApp/SendGrid/Twilio/Expo sin
  // credenciales reales en este entorno de desarrollo.
  @IsOptional()
  @IsIn(['fake', 'real'])
  NOTIFICATION_SENDER_PROVIDER?: 'fake' | 'real';

  @IsOptional()
  @IsString()
  WHATSAPP_API_TOKEN?: string;

  @IsOptional()
  @IsString()
  WHATSAPP_PHONE_NUMBER_ID?: string;

  @IsOptional()
  @IsString()
  WHATSAPP_WEBHOOK_VERIFY_TOKEN?: string;

  @IsOptional()
  @IsString()
  WHATSAPP_WEBHOOK_SECRET?: string;

  @IsOptional()
  @IsString()
  SENDGRID_API_KEY?: string;

  @IsOptional()
  @IsString()
  SENDGRID_FROM_EMAIL?: string;

  @IsOptional()
  @IsString()
  TWILIO_ACCOUNT_SID?: string;

  @IsOptional()
  @IsString()
  TWILIO_AUTH_TOKEN?: string;

  @IsOptional()
  @IsString()
  TWILIO_FROM_NUMBER?: string;

  @IsOptional()
  @IsString()
  EXPO_PUSH_ACCESS_TOKEN?: string;

  // --- observability (docs/engineering/08-OBSERVABILITY-BOOTSTRAP.md §1) ---
  // Ambas con default seguro (namespace observability.config.ts) - el SDK de OpenTelemetry
  // no bloquea el arranque si el collector no esta disponible, por diseño de la libreria.
  @IsOptional()
  @IsString()
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  OTEL_SERVICE_NAME?: string;
}

// Usado por ConfigModule.forRoot({ validate }) - corre una unica vez al arrancar; si falta
// una variable requerida o tiene formato invalido, el proceso no arranca (fail-fast).
export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Configuracion invalida:\n${errors.toString()}`);
  }

  return validated;
}
