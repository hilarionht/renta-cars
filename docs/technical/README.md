# Technical Architecture — Plano Técnico Definitivo

Este directorio contiene la **arquitectura técnica completa** de la Plataforma: el plano que traduce el modelo de dominio ya aprobado ([docs/model/](../model/README.md)) y la arquitectura de plataforma ya aprobada ([docs/](../README.md), [docs/ADR/](../ADR/README.md)) en decisiones de construcción concretas — monorepo, proyectos, NestJS, persistencia, eventos, observabilidad, seguridad de implementación, DevOps y estándares de código.

**Relación con el resto de `docs/`**: nada en este directorio redefine una decisión ya tomada en `docs/`, `docs/ADR/`, `docs/domain/` o `docs/model/`. Este directorio construye exclusivamente sobre ellas, al nivel de detalle en el que un equipo puede empezar a implementar sin tomar ninguna decisión arquitectónica adicional. Donde una decisión de esta fase parece nueva (p. ej. Outbox transaccional, tags de Nx, RS256), es una decisión de **construcción** derivada de una decisión de **diseño** ya fijada — nunca la contradice, y cada una está justificada en [10-DECISIONES.md](10-DECISIONES.md).

**Regla explícita de esta fase**: estos documentos no contienen código. No hay clases NestJS, componentes React, `schema.prisma` ni SQL. Contienen estructura (árboles de carpetas, tablas de proyectos), reglas (tablas de convención, matrices de dependencia) y diagramas (Mermaid) — el "cómo se construye", no el código que lo construye.

## Índice

| Doc | Contenido |
|---|---|
| [01-MONOREPO.md](01-MONOREPO.md) | Estructura del monorepo Nx: `apps/`, `libs/`, `packages/`, `tooling/`, sistema de tags y reglas de frontera impuestas en CI |
| [02-PROYECTOS.md](02-PROYECTOS.md) | Inventario completo de todos los proyectos Nx del workspace (backend, web, mobile, shared, design system, SDK, CLI) |
| [03-BACKEND-ARCHITECTURE.md](03-BACKEND-ARCHITECTURE.md) | Arquitectura técnica de NestJS: bootstrap, configuración, DI, módulos dinámicos, interceptors, guards, pipes, filters, jobs |
| [04-PERSISTENCE.md](04-PERSISTENCE.md) | Persistencia completa: Prisma multi-schema, Repository Pattern, Unit of Work, transacciones, Outbox, soft delete, auditoría, migraciones |
| [05-EVENTING.md](05-EVENTING.md) | Eventos internos, Outbox Pattern, Event Bus, mensajería (BullMQ), idempotencia, versionado |
| [06-OBSERVABILITY.md](06-OBSERVABILITY.md) | Logging, tracing, métricas, correlation id, health checks, OpenTelemetry |
| [07-SECURITY.md](07-SECURITY.md) | Arquitectura de implementación de JWT, refresh token, rotación, secretos, rate limiting, OWASP, CORS, CSP |
| [08-DEVOPS.md](08-DEVOPS.md) | Docker, CI/CD, versionado, entornos, secretos, deploy, rollback |
| [09-CODING-STANDARDS.md](09-CODING-STANDARDS.md) | Reglas técnicas: naming, imports, errores, convenciones, estructura, testing |
| [10-DECISIONES.md](10-DECISIONES.md) | Registro de las decisiones técnicas de esta fase, con alternativas y justificación |

## Cómo leer esta documentación

1. Empieza por [01-MONOREPO.md](01-MONOREPO.md) y [02-PROYECTOS.md](02-PROYECTOS.md) — fijan el mapa físico sobre el que se apoya todo lo demás.
2. [03-BACKEND-ARCHITECTURE.md](03-BACKEND-ARCHITECTURE.md) y [04-PERSISTENCE.md](04-PERSISTENCE.md) son los documentos centrales de esta fase; casi todos los demás los referencian.
3. [05-EVENTING.md](05-EVENTING.md) depende de [04-PERSISTENCE.md](04-PERSISTENCE.md) (el Outbox vive en persistencia; el bus y los listeners son de eventing) — se leen en ese orden.
4. [10-DECISIONES.md](10-DECISIONES.md) es el equivalente, para esta fase, de [docs/ADR/](../ADR/README.md): documenta el *por qué* de cada decisión nueva de construcción.

## Alcance de esta fase

- No se implementa código — este directorio es el plano que guía la implementación posterior, igual que `docs/` lo es para la arquitectura de plataforma.
- No se modifica ninguna decisión de `docs/`, `docs/ADR/`, `docs/domain/` ni `docs/model/` — se heredan como dato fijo y se desarrollan al nivel de detalle de construcción.
- No se fijan valores de calibración que dependen de datos de producción reales (umbrales de rate limiting, parámetros de `argon2id`, SLOs numéricos) — se define el mecanismo; el valor se calibra en Fase 6 de [01-ROADMAP.md](../01-ROADMAP.md), exactamente el mismo criterio ya usado en [09-SEGURIDAD.md §9](../09-SEGURIDAD.md).
- El objetivo de salida es que un equipo pueda comenzar a implementar (Nx, NestJS, Prisma, React, Docker, GitHub Actions) siguiendo únicamente estos documentos, sin tomar una sola decisión arquitectónica adicional.

## Regla de consistencia

Cualquier cambio a estos documentos que afecte a más de un módulo o proyecto requiere una entrada nueva en [10-DECISIONES.md](10-DECISIONES.md), no una edición silenciosa — misma disciplina que ya rige [docs/ADR/](../ADR/README.md).
