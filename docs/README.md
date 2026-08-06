# Documentación de Arquitectura — Plataforma Empresarial

Este directorio es la referencia oficial de arquitectura de la Plataforma. Su premisa central: **no estamos construyendo un sistema de alquiler de vehículos, estamos construyendo una plataforma empresarial modular de la que el alquiler de vehículos es el primer producto.** Ver [00-VISION.md](00-VISION.md).

## Índice

| Doc | Contenido |
|---|---|
| [00-VISION.md](00-VISION.md) | Visión, objetivos, filosofía, principios, alcance, no objetivos |
| [01-ROADMAP.md](01-ROADMAP.md) | Roadmap de Fase 0 a v1.0, orden de construcción de módulos |
| [02-ARQUITECTURA.md](02-ARQUITECTURA.md) | Monolito Modular, Clean Architecture, DDD, flujo de dependencias, comunicación entre módulos |
| [03-DOMINIO.md](03-DOMINIO.md) | Bounded contexts, agregados, value objects, servicios y eventos de dominio |
| [04-MODELO-DATOS.md](04-MODELO-DATOS.md) | Reglas para PostgreSQL/Prisma (sin esquema físico) |
| [05-CONVENCIONES-BACKEND.md](05-CONVENCIONES-BACKEND.md) | Guía de construcción de módulos NestJS |
| [06-CONVENCIONES-FRONTEND.md](06-CONVENCIONES-FRONTEND.md) | Estándares React, Next.js, React Native, Expo |
| [07-DESIGN-SYSTEM.md](07-DESIGN-SYSTEM.md) | Filosofía y reglas del sistema de diseño |
| [08-API-CONTRACTS.md](08-API-CONTRACTS.md) | Estándares REST, versionado, errores, paginación |
| [09-SEGURIDAD.md](09-SEGURIDAD.md) | Autenticación, autorización, auditoría, OWASP |
| [10-TESTING.md](10-TESTING.md) | Estrategia de testing por capa |
| [11-INTEGRACIONES.md](11-INTEGRACIONES.md) | Arquitectura de integraciones externas (Provider Pattern) |
| [ADR/](ADR/README.md) | Registro de decisiones arquitectónicas |
| [domain/](domain/README.md) | Descubrimiento del dominio de negocio de Rental: actores, lenguaje ubicuo, procesos, reglas y eventos (previo al modelado táctico de [03-DOMINIO.md](03-DOMINIO.md)) |
| [model/](model/README.md) | Modelado táctico definitivo: bounded contexts, agregados, entidades, value objects, servicios y eventos de dominio, invariantes, máquinas de estado |
| [persistence/](persistence/README.md) | Diseño físico de PostgreSQL: schemas, tablas, relaciones, columnas, índices/constraints, RLS |
| [technical/](technical/README.md) | Diseño técnico de construcción: monorepo, backend host, persistencia, eventing, observabilidad, seguridad, DevOps |
| [contracts/](contracts/README.md) | Contratos oficiales de comunicación: REST, recursos, eventos, integraciones, webhooks, errores, versionado |
| [engineering/](engineering/README.md) | Fundación de ingeniería: workspace Nx, DX, calidad de código, testing, CI/CD, Docker, configuración, observabilidad bootstrap, contribución, plan de bootstrap |

## Cómo leer esta documentación

1. Empieza por [00-VISION.md](00-VISION.md) — sin entender la distinción Plataforma/Producto, el resto de los documentos parece sobreingeniería.
2. [02-ARQUITECTURA.md](02-ARQUITECTURA.md) es el documento técnico central; casi todos los demás lo referencian.
3. Los [ADR](ADR/README.md) explican el **por qué** detrás de cada decisión importante — consúltalos antes de proponer cambiar una decisión ya tomada.

## Regla de consistencia

Cualquier cambio a estas reglas que afecte a más de un módulo requiere un ADR nuevo, no una edición silenciosa de un documento existente. Los documentos numerados (00-11) describen el estado vigente; los ADR describen la historia de cómo se llegó ahí.
