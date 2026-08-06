# 04 — Testing Foundation

[10-TESTING.md](../10-TESTING.md) ya fija la pirámide y qué se prueba en cada capa; [technical/09-CODING-STANDARDS.md §6](../technical/09-CODING-STANDARDS.md) ya fija dónde viven los archivos de test. Este documento fija el **tooling** que hace eso ejecutable desde el primer día: configuración de Jest por tipo de proyecto, la librería compartida de Testcontainers, el patrón de Test Data Builders, la estrategia de fakes, y Playwright/Supertest para E2E.

## 1. Jest por tipo de proyecto

`@nx/jest` genera un `jest.config.ts` por proyecto, pero la configuración base es única en `tooling/eslint/../jest` (`tooling/jest/base.config.ts`), heredada vía `preset`:

| Tipo de proyecto (`type:`) | Transform | Particularidad |
|---|---|---|
| `domain`, `application` (unit) | `@swc/jest` (rápido, sin type-check en el propio test run — el type-check ya lo cubre `nx affected --target=typecheck` en CI) | `testEnvironment: node`; cero mocks de infraestructura permitidos (regla de proceso, reforzada en review, no mecánicamente bloqueable por Jest) |
| `infrastructure` (integration, sufijo `.integration.spec.ts`) | `@swc/jest` | `globalSetup`/`globalTeardown` apuntan a la librería compartida de Testcontainers (§2); `testTimeout` elevado (arranque de contenedor) |
| `frontend` (`ui-kit-*`, `data-access`) | `@swc/jest` + `@testing-library/react` (o `@testing-library/react-native` para `ui-kit-mobile`) | `testEnvironment: jsdom` (web) / entorno de React Native para mobile |
| `e2e` (`api-e2e`) | N/A (Jest + Supertest, no `@swc/jest` transform especial) | Levanta `apps/api` completo contra Testcontainers, ver §5 |

Cobertura (`collectCoverage`) activa por defecto en `domain`/`application`; opt-in en `infrastructure` (la cobertura de un adaptador contra Testcontainers es menos informativa que la de una regla de negocio, y más costosa de calcular). Umbral de gate (`coverageThreshold`) referenciado en §7 — no fijado en este documento (depende del umbral vigente por módulo, que evoluciona).

## 2. Testcontainers — librería compartida

`tooling/testing/testcontainers/` expone helpers reutilizados por todo proyecto `infrastructure`:

- `startPostgresContainer()`: imagen `postgres:<misma versión mayor que producción>`, aplica el historial de Prisma Migrate contra la base efímera antes de exponerla — ningún test de integración corre contra un schema desactualizado.
- `startRedisContainer()`: usado por tests de `ThrottlerGuard`, colas de BullMQ, y `CacheInterceptor`.
- Ambos exponen su `connectionString` para inyectarlo como `DATABASE_URL`/`REDIS_URL` de la instancia de `PrismaClient`/conexión de test — nunca apuntan a la base de datos de Docker Compose de desarrollo (§1 de [06-DOCKER.md](06-DOCKER.md)), que es un entorno persistente y compartido entre ejecuciones.
- Reutilización de contenedor entre archivos de test de un mismo `nx affected --target=test` run (vía `globalSetup` a nivel de proyecto, no de archivo) — evita pagar el costo de arranque de contenedor por cada `.integration.spec.ts`, que sería impracticable a la escala de ~50 proyectos de librería ([technical/02-PROYECTOS.md §6](../technical/02-PROYECTOS.md)).

Esta librería es lo único en `tooling/testing/` — no se construye un framework de test propio; es un conjunto de funciones puras sobre la API ya provista por `testcontainers` (npm).

## 3. Test Data Builders

Patrón obligatorio para construir agregados/entidades en tests (unitarios y de aplicación), evitando literales repetidos que rompen en cadena cuando cambia un campo obligatorio del dominio:

- Un Builder por agregado raíz, co-ubicado con el proyecto `domain` que lo define (`domain/testing/vehicle.builder.ts`), exportado desde un entry point de testing separado del `index.ts` público de producción — un Builder de test nunca es parte de la superficie pública consumida por otros módulos.
- API fluida con valores por defecto válidos (`aVehicle()` ya construye un `Vehicle` que satisface todos los invariantes), y métodos de override explícitos (`.withStatus(VehicleStatus.Maintenance)`) — un test que no le importa un campo no lo especifica, y sigue siendo válido cuando el dominio agrega un campo nuevo con default razonable.
- Builders de un módulo pueden reutilizarse desde el test de otro módulo únicamente si ese módulo ya es un colaborador permitido según la matriz de dependencias ([technical/01-MONOREPO.md §5](../technical/01-MONOREPO.md)) — un test no es una excusa para importar `domain` de un módulo no relacionado.

## 4. Fakes, no mocks (aplicación)

Ejecuta mecánicamente la regla ya fijada en [10-TESTING.md §3](../10-TESTING.md): `tooling/testing/fakes/` (o co-ubicado por módulo cuando el fake es específico de un puerto de ese módulo) provee implementaciones in-memory de los puertos más reutilizados transversalmente (`UnitOfWork` fake que ejecuta el callback sin transacción real, `DomainEventPublisher` fake que colecciona eventos publicados para aserciones). Un puerto específico de un módulo (`VehicleRepository`) tiene su fake in-memory co-ubicado en ese mismo proyecto `application`, no en `tooling/` — evita que `tooling/testing/` se vuelva un segundo lugar no gobernado por las reglas de boundaries de [01-WORKSPACE.md §6](01-WORKSPACE.md).

## 5. E2E

- **`apps/api-e2e`**: Jest + Supertest contra una instancia real de `apps/api` levantada en proceso de test, con Testcontainers (§2) como backing de Postgres/Redis — nunca contra staging. Cubre exclusivamente los flujos críticos ya listados en [10-TESTING.md §5](../10-TESTING.md) (reserva→confirmación→check-out→check-in→factura; login→refresh→acceso protegido) — un flujo nuevo se agrega a este proyecto solo si es un "golden path" de negocio, no por cada endpoint.
- **`apps/web-admin-e2e`**: Playwright, ejecutado contra un build de `web-admin` servido localmente (`next start`) apuntando a una instancia de `apps/api` de test — mismo criterio de alcance mínimo (golden paths de UI, no cada estado de componente).
- Trazas y capturas de pantalla de Playwright se retienen únicamente en el fallo (`retain-on-failure`) y se publican como artefacto de CI (§ ver [05-CI-CD.md](05-CI-CD.md)) — no se versionan en el repositorio.

## 6. Mobile

`apps/mobile` no tiene un proyecto E2E dedicado en v1.0 (Detox u otro runner de E2E nativo es una decisión diferida — el mismo criterio de "no construir sin necesidad presente" de [00-VISION.md §3](../00-VISION.md), dado que el alcance de mobile en Fase 5 aún no está cerrado en [01-ROADMAP.md §7](../01-ROADMAP.md)). Mientras tanto, `apps/mobile` se cubre por: tests unitarios de sus propias features (Jest + `@testing-library/react-native`) y por los E2E de `api-e2e` (mismo backend, mismos flujos de negocio) — cobertura de UI nativa específica queda como riesgo aceptado y documentado, no como omisión silenciosa.

## 7. Cobertura como gate de CI

- El umbral no es un número fijo en este documento (evoluciona por fase y por módulo) — es un mecanismo: `nx affected --target=test -- --coverage`, comparado contra el umbral vigente declarado en `jest.config.ts` de cada proyecto `domain`/`application` (referencia orientativa ya fijada en [10-TESTING.md §2](../10-TESTING.md): 90%+ en dominio).
- Un PR que reduce la cobertura de un proyecto tocado por debajo de su propio umbral vigente no es mergeable (`nx affected --target=test` falla) — mismo criterio ya fijado en [10-TESTING.md §8](../10-TESTING.md), aquí conectado al mecanismo de Jest que lo hace cumplir.
- La cobertura se mide **por proyecto**, no como agregado de todo el workspace — un proyecto nuevo con 100% no compensa uno viejo con 60%, y viceversa; esto evita que la métrica agregada oculte un módulo de negocio crítico con cobertura pobre.

## 8. Qué se decide en otro documento

- Qué se prueba en cada capa y por qué (la pirámide en sí) → [10-TESTING.md](../10-TESTING.md) (sin cambios).
- Ubicación física y sufijo de archivo de cada tipo de test → [technical/09-CODING-STANDARDS.md §6](../technical/09-CODING-STANDARDS.md) (sin cambios).
- En qué job de CI corre cada categoría de test → [05-CI-CD.md](05-CI-CD.md).
