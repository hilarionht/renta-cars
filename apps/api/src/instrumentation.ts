// DEBE ser el primer import de main.ts (antes de cualquier modulo que toque http/pg/redis) -
// el SDK de OpenTelemetry parchea el require() de Node para instrumentar automaticamente, y
// necesita registrar esos hooks antes de que esos modulos se carguen por primera vez.
// dist/apps/api/main.js no bundlea dependencias externas (`generatePackageJson: true` del
// webpack de apps/api, docs/engineering/06-DOCKER.md §1) - http/ioredis/pg se siguen
// cargando via require() real de Node en runtime, asi que el parcheo de OTel funciona igual
// que en una app sin bundler.
//
// Corre antes de que exista ConfigModule (AppModule ni siquiera se importo todavia) - lee
// las mismas variables de entorno directo de process.env que apps/api/src/config/
// observability.config.ts, con el mismo default.

import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import { config as loadEnv } from 'dotenv';

loadEnv();

const serviceName = process.env.OTEL_SERVICE_NAME ?? 'api';

// Sin `url` explicito: cada exportador OTLP lee `OTEL_EXPORTER_OTLP_ENDPOINT` del entorno y
// agrega el sufijo de su propia señal (/v1/traces, /v1/metrics) - mismo mecanismo estandar
// que docs/engineering/08-OBSERVABILITY-BOOTSTRAP.md §1 describe para apps/api.
const sdk = new NodeSDK({
  resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: serviceName }),
  // Sin auto-deteccion de recursos (envDetector/processDetector/hostDetector, default de
  // NodeSDK): hostDetector hace una resolucion DNS reversa que en esta red agrega ~30s al
  // arranque en frio (verificado en el bootstrap del paso 12, comparando con/sin este flag) -
  // costo no aceptable para el ciclo de desarrollo diario por un atributo que no se usa hoy.
  autoDetectResources: false,
  traceExporter: new OTLPTraceExporter(),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(),
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Sin colas todavia (BullMQ) hasta el primer Processor de negocio -
      // docs/engineering/10-BOOTSTRAP-PLAN.md paso 12.
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
    // Spans a nivel de Prisma Client (planificacion de query, motor) - complementa, no
    // reemplaza, la instrumentacion de `pg` ya cubierta por getNodeAutoInstrumentations
    // (el adapter de Prisma 7 delega en el driver `pg` real, docs/technical/04-PERSISTENCE.md).
    new PrismaInstrumentation(),
  ],
});

sdk.start();

// Apagado ordenado (docs/technical/08-DEVOPS.md §6) - se conecta con el hook de cierre de
// Nest cuando exista `enableShutdownHooks` (paso posterior); SIGTERM alcanza para este
// bootstrap, exportadores no bloqueantes por diseño de la libreria.
process.on('SIGTERM', () => {
  void sdk.shutdown();
});
