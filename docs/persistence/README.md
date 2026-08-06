# Persistence — Modelo Físico Definitivo

Este directorio contiene el **modelo físico de persistencia** de la Plataforma: la fase que traduce el modelo de dominio ya aprobado ([docs/model/](../model/README.md)) y las reglas de datos ya fijadas ([04-MODELO-DATOS.md](../04-MODELO-DATOS.md), [ADR-0003](../ADR/0003-postgresql-prisma.md), [ADR-0004](../ADR/0004-multitenancy.md)) en un diseño de base de datos completo y sin ambigüedad — pero **sin implementarlo**.

**Relación con el resto de `docs/`**: nada en este directorio redefine una decisión ya tomada en `docs/`, `docs/ADR/`, `docs/domain/`, `docs/model/` o `docs/technical/`. Este directorio construye exclusivamente sobre ellas, al nivel de detalle en el que un desarrollador puede escribir `schema.prisma` y sus migraciones sin tomar una sola decisión de modelado adicional. Donde una decisión de esta fase parece nueva (p. ej. denormalización de `company_id` en tablas internas, `version` para concurrencia optimista, tabla única de outbox), es una decisión de **diseño físico** derivada mecánicamente de una regla ya fijada — nunca la contradice, y cada una está justificada en [10-DECISIONES.md](10-DECISIONES.md).

**Regla explícita de esta fase**: estos documentos no contienen SQL, no contienen `schema.prisma`, no contienen migraciones, no implementan repositorios. Contienen inventario (tablas, columnas conceptuales, relaciones), reglas (convenciones, políticas de RLS, estrategia de migración) y trazabilidad (de agregado a tabla) — el "qué existe y por qué", nunca el "cómo se escribe en DDL".

## Índice

| Doc | Contenido |
|---|---|
| [01-SCHEMAS.md](01-SCHEMAS.md) | Los seis schemas de PostgreSQL, su justificación, mapeo a Bounded Contexts y reglas de aislamiento |
| [02-TABLAS.md](02-TABLAS.md) | Todas las tablas derivadas de los 17 agregados: propósito, agregado propietario, responsabilidad, ciclo de vida, relaciones conceptuales |
| [03-RELACIONES.md](03-RELACIONES.md) | Todas las relaciones, clasificadas (intra-schema, inter-schema, FK, referencia lógica, evento) y cuándo NO usar FK |
| [04-COLUMNAS-CONCEPTUALES.md](04-COLUMNAS-CONCEPTUALES.md) | Identificador, claves naturales, timestamps, versionado, auditoría, tenant, soft delete y ownership por tabla |
| [05-INDICES-Y-CONSTRAINTS.md](05-INDICES-Y-CONSTRAINTS.md) | Índices, unicidad, checks, exclusion constraints y restricciones de negocio, con su justificación |
| [06-RLS.md](06-RLS.md) | Estrategia completa de Row-Level Security: aislamiento por tenant, `SET LOCAL`, políticas, casos especiales, bypass administrativo |
| [07-MIGRACIONES.md](07-MIGRACIONES.md) | Estrategia de migraciones: versionado, rollback, datos iniciales, seeds, compatibilidad |
| [08-PRISMA-CONVENTIONS.md](08-PRISMA-CONVENTIONS.md) | Estándares de Prisma: naming, separación por archivos, relaciones, enums, composite types |
| [09-TRAZABILIDAD.md](09-TRAZABILIDAD.md) | Matriz de trazabilidad completa: de cada Aggregate Root a sus tablas, relaciones, eventos y mecanismo de persistencia |
| [10-DECISIONES.md](10-DECISIONES.md) | Registro de las decisiones nuevas de esta fase, con alternativas y justificación |

## Cómo leer esta documentación

1. Empieza por [01-SCHEMAS.md](01-SCHEMAS.md) y [02-TABLAS.md](02-TABLAS.md) — fijan el mapa físico sobre el que se apoya todo lo demás.
2. [03-RELACIONES.md](03-RELACIONES.md) y [04-COLUMNAS-CONCEPTUALES.md](04-COLUMNAS-CONCEPTUALES.md) son los documentos centrales de esta fase; casi todos los demás los referencian.
3. [05-INDICES-Y-CONSTRAINTS.md](05-INDICES-Y-CONSTRAINTS.md) y [06-RLS.md](06-RLS.md) se leen juntos — ambos son mecanismos de defensa en profundidad sobre el mismo modelo de tablas.
4. [09-TRAZABILIDAD.md](09-TRAZABILIDAD.md) es la referencia de verificación final: permite confirmar que ningún agregado del modelo de dominio quedó sin representación física.
5. [10-DECISIONES.md](10-DECISIONES.md) es el equivalente, para esta fase, de [docs/ADR/](../ADR/README.md) y de [docs/technical/10-DECISIONES.md](../technical/10-DECISIONES.md): documenta el *por qué* de cada decisión nueva de modelado físico.

## Alcance de esta fase

- No se escribe SQL, `schema.prisma`, migraciones, ni se implementan repositorios — eso corresponde a la fase de implementación, que debe seguir estos documentos como referencia oficial y no debería necesitar tomar ninguna decisión de modelado adicional.
- No se modifica ninguna decisión de `docs/`, `docs/ADR/`, `docs/domain/`, `docs/model/` ni `docs/technical/` — este modelo físico las hereda como dato fijo.
- No se reinterpreta el dominio: toda tabla, columna conceptual, relación e índice de este directorio es consecuencia directa de un agregado, entidad, value object, invariante o evento ya fijado en [docs/model/](../model/README.md). Donde una decisión física no se deriva mecánicamente de una regla existente (p. ej. la denormalización de `company_id`, el uso de `version` para concurrencia optimista), se documenta explícitamente como tal en [10-DECISIONES.md](10-DECISIONES.md), nunca como una regla de negocio nueva.
- El objetivo de salida es que un desarrollador pueda escribir el `schema.prisma` completo y sus migraciones siguiendo únicamente estos documentos, sin volver a discutir el modelado de datos.

## Regla de consistencia

Cualquier cambio a estos documentos que afecte a más de una tabla o schema requiere una entrada nueva en [10-DECISIONES.md](10-DECISIONES.md), no una edición silenciosa — misma disciplina que ya rige [docs/ADR/](../ADR/README.md) y [docs/technical/10-DECISIONES.md](../technical/10-DECISIONES.md). Si un cambio contradice una decisión ya fijada en `docs/model/` o `docs/technical/`, corresponde revisar primero esa decisión (fuera de este directorio), no forzar el modelo físico a rodearla.
