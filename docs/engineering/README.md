# Engineering Foundation

Este directorio contiene la **fundación de ingeniería**: el plano que convierte todo lo ya aprobado en `docs/`, `docs/ADR/`, `docs/domain/`, `docs/model/`, `docs/persistence/`, `docs/technical/` y `docs/contracts/` en un workspace real, clonable y arrancable. Nada aquí redefine una decisión de diseño o de construcción ya fijada en esos directorios — este directorio cierra exclusivamente las decisiones de **tooling y experiencia de desarrollo** que faltaban para que un equipo pueda escribir el primer módulo de dominio sin tomar ninguna decisión de infraestructura adicional.

No se implementa ningún módulo de negocio en esta fase. No hay Login, no hay entidades, no hay controladores, no hay `schema.prisma` con modelos — eso empieza en la Fase 0 de [01-ROADMAP.md](../01-ROADMAP.md), después de completar [10-BOOTSTRAP-PLAN.md](10-BOOTSTRAP-PLAN.md).

## Índice

| Doc | Contenido |
|---|---|
| [01-WORKSPACE.md](01-WORKSPACE.md) | Estructura Nx completa: árbol de carpetas, plugins, `nx.json`, alias, generadores, boundaries ejecutables |
| [02-DEVELOPER-EXPERIENCE.md](02-DEVELOPER-EXPERIENCE.md) | Bootstrap local, scripts, VS Code, Dev Containers, debug, hot reload |
| [03-CODE-QUALITY.md](03-CODE-QUALITY.md) | ESLint, Prettier, Commitlint, Husky, lint-staged, gates de calidad |
| [04-TESTING-FOUNDATION.md](04-TESTING-FOUNDATION.md) | Jest por tipo de proyecto, Testcontainers, Test Data Builders, fakes, Playwright |
| [05-CI-CD.md](05-CI-CD.md) | Workflows de GitHub Actions, cache remoto de Nx, versionado (Changesets), artefactos |
| [06-DOCKER.md](06-DOCKER.md) | Dockerfiles multi-stage, Docker Compose de desarrollo, paridad con producción |
| [07-CONFIGURATION.md](07-CONFIGURATION.md) | Catálogo de variables de entorno, secretos, jerarquía de fuentes, validación, feature flags |
| [08-OBSERVABILITY-BOOTSTRAP.md](08-OBSERVABILITY-BOOTSTRAP.md) | Perfil local de OpenTelemetry/Prometheus/Grafana/Loki/Tempo, dashboards iniciales |
| [09-CONTRIBUTING.md](09-CONTRIBUTING.md) | Flujo de Git, Pull Requests, revisión, Definition of Done, flujo de ADR |
| [10-BOOTSTRAP-PLAN.md](10-BOOTSTRAP-PLAN.md) | Plan de construcción paso a paso, cada paso depende solo de los anteriores |

## Cómo leer esta documentación

1. Empieza por [01-WORKSPACE.md](01-WORKSPACE.md) — fija el mapa físico sobre el que se apoya todo lo demás, igual que [technical/01-MONOREPO.md](../technical/01-MONOREPO.md) lo hace para la fase anterior.
2. [10-BOOTSTRAP-PLAN.md](10-BOOTSTRAP-PLAN.md) es el documento operativo: referencia a los otros nueve en el orden exacto de ejecución. Es el punto de entrada para construir el repositorio desde cero.
3. Los demás documentos (02-09) se consultan como referencia al ejecutar el paso correspondiente de [10-BOOTSTRAP-PLAN.md](10-BOOTSTRAP-PLAN.md), no necesariamente en orden secuencial de lectura.

## Alcance de esta fase

- No se modifica ninguna decisión de `docs/`, `docs/ADR/`, `docs/domain/`, `docs/model/`, `docs/persistence/`, `docs/technical/` ni `docs/contracts/` — se heredan como dato fijo.
- No se calibran umbrales que dependen de datos de producción reales (rate limiting, `argon2id`, alertas) — mismo criterio ya usado en [technical/README.md](../technical/README.md) y heredado sin excepción aquí.
- El objetivo de salida es que cualquier desarrollador clone el repositorio y tenga un entorno homogéneo, reproducible y preparado para comenzar la implementación de negocio sin improvisar ninguna decisión técnica.

## Regla de consistencia

Cualquier cambio a estos documentos que afecte a más de un flujo de desarrollo (tooling compartido, CI, Docker Compose) sigue la misma disciplina ya fijada en [technical/README.md](../technical/README.md) y [docs/ADR/README.md](../ADR/README.md): una entrada nueva y justificada (ver el flujo de ADR de [09-CONTRIBUTING.md §6](09-CONTRIBUTING.md)), nunca una edición silenciosa.
