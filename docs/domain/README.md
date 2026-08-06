# Domain Discovery — Alquiler de Vehículos

Este directorio documenta el **dominio de negocio** del primer producto construido sobre la Plataforma: la gestión de alquiler de vehículos. Es el resultado de una fase de descubrimiento (Event Storming, definición de lenguaje ubicuo, mapeo de procesos y reglas) previa al modelado táctico de DDD.

**Relación con `docs/`**: esta carpeta no modifica ni sustituye la arquitectura ya definida en el directorio padre. [03-DOMINIO.md](../03-DOMINIO.md) sigue siendo la referencia oficial de bounded contexts, agregados, value objects y eventos formalizados como contrato técnico. Esta carpeta es su capa previa de negocio — el "por qué" detrás de esas decisiones tácticas, y el terreno de descubrimiento para la Fase 2 (Domain Modeling), donde recién se definirán entidades, agregados y value objects definitivos.

## Índice

| Doc | Contenido |
|---|---|
| [01-ACTORES.md](01-ACTORES.md) | Quién participa en el negocio y qué responsabilidad tiene cada uno |
| [02-LENGUAJE-UBICUO.md](02-LENGUAJE-UBICUO.md) | Diccionario oficial de términos del negocio, con sinónimos prohibidos |
| [03-PROCESOS.md](03-PROCESOS.md) | Flujos de negocio de punta a punta (alta de vehículo, reserva, entrega, devolución, pago, mantenimiento, etc.) |
| [04-EVENT-STORMING.md](04-EVENT-STORMING.md) | Comandos, eventos y políticas del negocio, incluyendo hotspots identificados |
| [05-REGLAS-NEGOCIO.md](05-REGLAS-NEGOCIO.md) | Reglas de negocio clasificadas por criticidad y por alcance (universal/configurable/dependiente de país) |
| [06-CASOS-USO.md](06-CASOS-USO.md) | Capacidades de negocio requeridas por cada actor |
| [07-EXCEPCIONES.md](07-EXCEPCIONES.md) | Situaciones excepcionales de la operación real y cómo las resuelve el negocio |
| [08-BOUNDARY.md](08-BOUNDARY.md) | Qué pertenece al dominio Rental y qué a la Plataforma, y por qué |
| [09-FUTURAS-CAPACIDADES.md](09-FUTURAS-CAPACIDADES.md) | Funcionalidades futuras identificadas pero deliberadamente no implementadas |

## Cómo leer esta documentación

1. Empieza por [01-ACTORES.md](01-ACTORES.md) y [02-LENGUAJE-UBICUO.md](02-LENGUAJE-UBICUO.md) — sin el vocabulario común, el resto de los documentos es ambiguo.
2. [03-PROCESOS.md](03-PROCESOS.md) y [04-EVENT-STORMING.md](04-EVENT-STORMING.md) describen el mismo negocio desde dos ángulos (flujo end-to-end vs. comandos/eventos/políticas) — se complementan, no se repiten.
3. [05-REGLAS-NEGOCIO.md](05-REGLAS-NEGOCIO.md) y [07-EXCEPCIONES.md](07-EXCEPCIONES.md) son la referencia obligatoria antes de modelar cualquier invariante técnico en la Fase 2.
4. [08-BOUNDARY.md](08-BOUNDARY.md) es lectura obligatoria antes de diseñar el segundo producto sobre la Plataforma.

## Alcance de esta fase

- No se diseñan entidades, agregados ni value objects definitivos (eso es Fase 2, Domain Modeling).
- No se diseña base de datos, APIs ni frontend.
- No se modifica ninguna decisión de [docs/](../README.md) — esta documentación respeta esa arquitectura como dato fijo.
- El objetivo de salida es que cualquier persona entienda cómo funciona una empresa de alquiler de vehículos sin leer una sola línea de código.
