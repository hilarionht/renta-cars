# 10 — Decisiones Técnicas de esta Fase

Registro de las decisiones de **construcción** tomadas en `docs/technical/`, con el mismo rigor que [docs/ADR/](../ADR/README.md): contexto, alternativas consideradas, decisión y consecuencias. Ninguna de estas decisiones reabre un ADR ya aceptado — cada una construye sobre uno o más ADR existentes, y así se indica explícitamente en cada entrada. Numeradas para poder referenciarse desde el resto de `docs/technical/`.

## 1. Cada capa de cada módulo es una librería Nx independiente

**Contexto**: [ADR-0006](../ADR/0006-monorepo-nx.md) fija tags `type:domain`/`type:application`/`type:infrastructure`, lo que implica que Nx debe poder aplicar `enforce-module-boundaries` a ese nivel de granularidad.

**Alternativas**: (a) un único proyecto Nx por módulo con las tres capas como carpetas internas, disciplina impuesta solo por ESLint interno al proyecto; (b) tres proyectos Nx por módulo (elegida).

**Decisión**: cada capa (`domain`, `application`, `infrastructure`) es su propio proyecto Nx, con su propio `index.ts` como única superficie pública.

**Consecuencias**: la regla "el dominio no importa infraestructura" pasa de ser una convención de ESLint dentro de un proyecto a una imposibilidad estructural verificada por el grafo de dependencias de Nx — un import inválido no compila. Costo aceptado: más archivos `project.json` por módulo (mitigado por el generador de [01-MONOREPO.md §7](01-MONOREPO.md)).

## 2. Outbox transaccional + relay como implementación de `DomainEventPublisher`

**Contexto**: [ADR-0005](../ADR/0005-comunicacion-modulos.md) acepta explícitamente que el bus in-process "no sobrevive a un reinicio del proceso a mitad de una cadena de eventos".

**Alternativas**: (a) mantener el `EventEmitter` puro sin persistencia, aceptando el riesgo tal como está documentado; (b) Outbox transaccional con relay (elegida); (c) introducir un broker externo ya en v1.0.

**Decisión**: (b). El Outbox usa el mismo schema-por-Bounded-Context ya existente, no introduce infraestructura nueva, y cierra el riesgo concreto que ADR-0005 documentó como aceptado — sin introducir la complejidad operativa de un broker externo que ese mismo ADR descartó para v1.0.

**Consecuencias**: una tabla de outbox adicional por Bounded Context; un `Processor` de relay en BullMQ; a cambio, entrega *at-least-once* que sobrevive a un reinicio de proceso. No reabre ADR-0005 — la opción (c) sigue descartada por las mismas razones ya documentadas ahí.

## 3. RS256 (asimétrico) para la firma del `access_token`

**Contexto**: [ADR-0008](../ADR/0008-autenticacion-jwt-refresh.md) fija JWT corto + refresh rotativo, sin especificar el algoritmo de firma.

**Alternativas**: (a) HS256 (simétrico, una única clave compartida para firmar y verificar); (b) RS256 (asimétrico, clave privada firma, clave pública verifica) — elegida.

**Decisión**: RS256. Permite que un futuro servicio extraído (ruta de evolución ya prevista en [ADR-0001](../ADR/0001-modular-monolith.md)) verifique tokens con la clave pública sin necesitar la clave privada de firma — imposible con HS256 sin comprometer la capacidad de firmar en cualquier lugar que verifique.

**Consecuencias**: gestión de par de claves (en vez de un único secreto compartido) y rotación con `kid` (§1 de [07-SECURITY.md](07-SECURITY.md)); costo de implementación marginal frente al beneficio de extensibilidad futura sin comprometer seguridad.

## 4. `pino`/`nestjs-pino` para logging estructurado

**Contexto**: el stack fija OpenTelemetry/Prometheus/Grafana/Loki, pero no una librería concreta de logging para NestJS.

**Alternativas**: (a) `winston`; (b) `pino` vía `nestjs-pino` (elegida).

**Decisión**: `pino`. Serialización JSON nativa de alto rendimiento (menor overhead por request que alternativas basadas en transformación de string), con integración directa a Loki sin *parsing* adicional.

**Consecuencias**: dependencia adicional específica; beneficio de rendimiento medible en el camino caliente de cada request (todo el volumen de tráfico pasa por el `LoggingInterceptor`, [03-BACKEND-ARCHITECTURE.md §8](03-BACKEND-ARCHITECTURE.md)).

## 5. Grafana Tempo como backend de trazas

**Contexto**: el stack fija OpenTelemetry (instrumentación/exportación) y Grafana (visualización), sin un backend de trazas explícito.

**Alternativas**: (a) Jaeger; (b) Grafana Tempo (elegida); (c) diferir la decisión.

**Decisión**: Tempo, por consistencia de ecosistema con Grafana/Loki/Prometheus ya elegidos (integración nativa "LGTM" en un único panel de Grafana) — evita operar un componente de visualización adicional (Jaeger UI) redundante con Grafana.

**Consecuencias**: decisión de implementación reversible sin impacto en productores/consumidores de trazas (ambos hablan OTLP, agnóstico de backend) — bajo riesgo si se reevalúa más adelante.

## 6. BullMQ como cola de jobs, distinta del bus de eventos de dominio

**Contexto**: el stack fija BullMQ; era necesario decidir su frontera exacta frente al bus de eventos de [ADR-0005](../ADR/0005-comunicacion-modulos.md), que podrían confundirse.

**Decisión**: BullMQ ejecuta trabajo de I/O potencialmente lento o con reintento (enviar notificación, generar PDF, llamar a un proveedor externo); el bus de eventos (`EventEmitter2` + Outbox) comunica hechos de dominio entre módulos. Un Listener de dominio típicamente encola un job; no son el mismo mecanismo con dos nombres.

**Consecuencias**: dos piezas de infraestructura con responsabilidades no solapadas, cada una con las garantías apropiadas a su propósito (backoff/dead-letter en BullMQ; *at-least-once* de hechos de dominio en el bus) — ver [05-EVENTING.md §1](05-EVENTING.md).

## 7. GitHub Actions con `nx affected` como estrategia de CI

**Contexto**: el stack fija GitHub Actions; era necesario decidir si el pipeline evalúa el grafo completo o solo lo afectado por un cambio.

**Decisión**: `nx affected` en todo target de CI (lint, test, build) — un PR que toca un único módulo no paga el costo de recompilar/retestear los ~50 proyectos del workspace ([02-PROYECTOS.md §6](02-PROYECTOS.md)).

**Consecuencias**: requiere que el repositorio remoto tenga suficiente historia (`fetch-depth` adecuado) para que Nx calcule el diff contra la rama base correctamente — detalle de configuración de workflow, no arquitectónico.

## 8. Soft delete vía Prisma Client Extension opt-in por modelo

**Contexto**: [04-MODELO-DATOS.md §5](../04-MODELO-DATOS.md) ya fija que el soft delete es excepción, no regla general, limitado a `reservations`/`invoices`.

**Alternativas**: (a) middleware global de Prisma que intercepta todo modelo y decide en runtime si aplica soft-delete según una lista; (b) extensión opt-in, aplicada solo a los modelos explícitamente marcados (elegida).

**Decisión**: (b). Hace visible en el propio schema/extensión qué modelos tienen soft-delete, en vez de una lista de excepciones escondida dentro de un middleware genérico — reduce el riesgo de que un desarrollador nuevo asuma incorrectamente que un modelo tiene soft-delete (o que no lo tiene) sin revisar la extensión.

**Consecuencias**: ligeramente más configuración explícita por modelo; a cambio, cero ambigüedad sobre qué modelo se comporta de qué forma.

## 9. Minimalismo estructural: sin `shared/` de primer nivel; `packages/` reservado sin construir

**Contexto**: el enunciado de esta fase pide definir `shared/` y proyectos de SDK/CLI; [00-VISION.md §3](../00-VISION.md) exige evitar sobreingeniería.

**Decisión**: no se crea una carpeta `shared/` adicional — el concepto ya existe como `libs/platform/shared-kernel` (dominio) y `libs/frontend/domain-types` (frontend), fijados en [02-ARQUITECTURA.md §8](../02-ARQUITECTURA.md). `packages/sdk` y `packages/cli` se reservan como ubicación convenida, pero no se construyen hasta que exista un consumidor externo real (post-v1.0, [01-ROADMAP.md §10](../01-ROADMAP.md)).

**Consecuencias**: evita duplicar un concepto ya resuelto y evita construir un SDK/CLI sin consumidor — directamente alineado con el principio rector #5 de [00-VISION.md §5](../00-VISION.md) ("¿estamos resolviendo un problema real, o uno hipotético?").

## 10. Arquitectura de gestión de secretos: inyección en runtime, nunca en imagen

**Contexto**: [09-SEGURIDAD.md §7](../09-SEGURIDAD.md) y [11-INTEGRACIONES.md §12](../11-INTEGRACIONES.md) ya prohíben secretos en código o en `settings` en texto plano; faltaba fijar el mecanismo de construcción.

**Decisión**: todo secreto se inyecta como variable de entorno al contenedor en el momento del despliegue, leído exclusivamente a través de `ConfigModule` ([03-BACKEND-ARCHITECTURE.md §3](03-BACKEND-ARCHITECTURE.md)) — nunca embebido en la imagen Docker, lo que además es un requisito para que la misma imagen sea promovible entre entornos (§4 de [08-DEVOPS.md](08-DEVOPS.md)).

**Consecuencias**: una imagen Docker sin secretos puede auditarse, escanearse y promoverse libremente; el costo es la disciplina operativa de mantener el almacén de secretos del entorno sincronizado, fuera del alcance de este documento de arquitectura.

## 11. Sin Kubernetes ni orquestación, tampoco en desarrollo local

**Contexto**: [ADR-0001](../ADR/0001-modular-monolith.md) ya descarta microservicios/orquestación en producción; era necesario fijar si el entorno de desarrollo local debía, aun así, simular Kubernetes (`kind`/`minikube`) para paridad.

**Decisión**: no. Docker Compose es suficiente y consistente con un monolito modular de un único desplegable — introducir Kubernetes local sin usarlo en producción añadiría curva de aprendizaje y complejidad de tooling sin beneficio real, contradiciendo la misma lógica de ADR-0001 aplicada al entorno de desarrollo.

**Consecuencias**: onboarding de un desarrollador nuevo más simple (`docker compose up`); si en el futuro ADR-0001 se reabre (ver su cláusula de revisión), este documento se reabre en consecuencia, no antes.

## 12. `SecurityDeposit` empaquetado junto a `Payment`, sin librería propia

**Contexto**: [model/02-AGGREGATES.md §12](../model/02-AGGREGATES.md) modela `SecurityDeposit` como agregado propio del Bounded Context Commerce, pero el árbol físico ya fijado en [02-ARQUITECTURA.md §8](../02-ARQUITECTURA.md) solo nombra `payments` como módulo de plataforma, sin una entrada separada para depósitos de garantía.

**Alternativas**: (a) crear `libs/platform/security-deposits` como módulo físico propio; (b) empaquetar `SecurityDeposit` dentro de `libs/platform/payments` (elegida).

**Decisión**: (b), siguiendo el mismo criterio pragmático de empaquetado ya usado en el modelo de dominio para `Invoice`/Commerce ([model/01-BOUNDED_CONTEXTS.md §3.5](../model/01-BOUNDED_CONTEXTS.md)): ambos agregados son mecanismos financieros genéricos de bajo volumen relativo de código, sin necesidad de escalar o desplegarse por separado; separar prematuramente sería sobreingeniería.

**Consecuencias**: si en el futuro el volumen o la necesidad de un segundo producto lo justifica, extraer `SecurityDeposit` a su propia librería es mecánico (mover código, no rediseñar el agregado) — exactamente el mismo argumento de evolución ya aceptado para `Invoice`.

## Cómo se agregan nuevas decisiones a este documento

Cuando una decisión de construcción nueva (a) es costosa de revertir, (b) afecta a más de un módulo o proyecto, o (c) alguien podría razonablemente preguntar "¿por qué no se hizo de otra forma?" — mismo criterio ya fijado en [docs/ADR/README.md](../ADR/README.md), aplicado aquí al nivel de construcción en vez de al nivel de diseño de plataforma.
