# Domain Model — Modelo de Dominio Definitivo

Este directorio contiene el modelo de dominio definitivo de la Plataforma: la fase de **Domain Modeling** que sigue al descubrimiento de negocio ([docs/domain/](../domain/README.md)) y que respeta, sin modificarla, la arquitectura ya aprobada en [docs/](../README.md) y los [ADR](../ADR/README.md).

**Relación con el resto de `docs/`**: [docs/domain/](../domain/README.md) describe el **qué y el por qué** del negocio (actores, procesos, reglas, excepciones) en lenguaje natural, previo a cualquier decisión de modelado. [03-DOMINIO.md](../03-DOMINIO.md) fijó una primera versión táctica (bounded contexts, agregados principales, eventos de contrato). Este directorio es su desarrollo **completo y definitivo**: todo agregado, entidad, value object, servicio de dominio, evento, invariante, máquina de estados y dependencia entre agregados que el sistema necesitará, al nivel de detalle suficiente para implementar sin volver a discutir el dominio.

Ninguna decisión arquitectónica, de datos, de API, de seguridad o de testing se redefine aquí — este directorio construye estrictamente sobre ellas.

## Índice

| Doc | Contenido |
|---|---|
| [01-BOUNDED_CONTEXTS.md](01-BOUNDED_CONTEXTS.md) | Los seis Bounded Contexts, sus responsabilidades, relaciones, Anti-Corruption Layers y la distinción Bounded Context vs. módulo físico |
| [02-AGGREGATES.md](02-AGGREGATES.md) | Los 17 agregados del modelo: objetivo, root, entidades internas, value objects, eventos, invariantes, transacciones, lifecycle, límites y justificación de cada decisión |
| [03-ENTITIES.md](03-ENTITIES.md) | Todas las entidades del dominio (raíces y entidades internas): identidad, ciclo de vida, relaciones, propiedades conceptuales |
| [04-VALUE_OBJECTS.md](04-VALUE_OBJECTS.md) | Todos los Value Objects: por qué son VO, igualdad, inmutabilidad, validaciones, reutilización |
| [05-DOMAIN_SERVICES.md](05-DOMAIN_SERVICES.md) | Los tres Domain Services del modelo y los candidatos evaluados y descartados, con justificación |
| [06-DOMAIN_EVENTS.md](06-DOMAIN_EVENTS.md) | Catálogo oficial completo de eventos de dominio: payload, publicador, consumidores, garantías de entrega, compatibilidad futura |
| [07-INVARIANTS.md](07-INVARIANTS.md) | Todas las invariantes, clasificadas por alcance (Aggregate/Cross-Aggregate), dominio (Platform/Rental) y criticidad |
| [08-STATE_MACHINES.md](08-STATE_MACHINES.md) | Todas las máquinas de estado del modelo, con foco en Reservation, Vehicle, Payment, Invoice y Maintenance |
| [09-DEPENDENCIES.md](09-DEPENDENCIES.md) | Cómo interactúan los agregados: llamadas válidas, llamadas prohibidas, y qué evento reemplaza cada dependencia directa evitada |

## Cómo leer esta documentación

1. Empieza por [01-BOUNDED_CONTEXTS.md](01-BOUNDED_CONTEXTS.md) — fija el mapa de contextos sobre el que se apoya todo lo demás.
2. [02-AGGREGATES.md](02-AGGREGATES.md) es el documento central de esta carpeta; [03-ENTITIES.md](03-ENTITIES.md) y [04-VALUE_OBJECTS.md](04-VALUE_OBJECTS.md) lo detallan desde el ángulo de cada elemento interno.
3. [06-DOMAIN_EVENTS.md](06-DOMAIN_EVENTS.md), [07-INVARIANTS.md](07-INVARIANTS.md) y [09-DEPENDENCIES.md](09-DEPENDENCIES.md) se leen juntos antes de implementar cualquier caso de uso que cruce más de un agregado — son, en conjunto, la referencia de "qué puedo y qué no puedo hacer" entre módulos.
4. [08-STATE_MACHINES.md](08-STATE_MACHINES.md) es la referencia obligatoria antes de implementar cualquier Command Handler que transicione el estado de `Reservation`, `Vehicle`, `Payment`, `Invoice` o `MaintenanceRecord`.

## Alcance de esta fase

- No se diseña base de datos física, APIs REST, ni frontend — eso corresponde a fases de implementación posteriores, que deben seguir estos documentos como referencia oficial.
- No se modifica ninguna decisión de [docs/](../README.md), [docs/ADR/](../ADR/README.md) ni [docs/domain/](../domain/README.md) — este modelo las hereda como dato fijo y las desarrolla al nivel táctico completo.
- El objetivo de salida es que el sistema completo pueda implementarse (PostgreSQL, Prisma, NestJS, React) siguiendo únicamente estos documentos, sin volver a discutir el dominio, y que el dominio permanezca estable aunque cambie la tecnología de implementación.

## Regla de consistencia

Cualquier cambio a este modelo que afecte a más de un agregado o Bounded Context debe justificarse con el mismo rigor que un ADR (contexto, alternativas consideradas, consecuencias) — no una edición silenciosa. Si el cambio contradice una decisión ya fijada en `docs/` o `docs/ADR/`, corresponde revisar primero esa decisión (fuera de este directorio), no forzar el modelo de dominio a rodearla.
