import { registerAs } from '@nestjs/config';

// Namespace "observability" - docs/engineering/07-CONFIGURATION.md §1. Sin secretos. Solo
// consumido por el logger (paso 12); la inicialización de OpenTelemetry (src/instrumentation.ts)
// corre antes de que ConfigModule exista y lee estas mismas variables directo de
// process.env - un único par de variables, dos lectores.
export default registerAs('observability', () => ({
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318',
  serviceName: process.env.OTEL_SERVICE_NAME ?? 'api',
}));
