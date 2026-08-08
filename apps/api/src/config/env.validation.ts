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
