# 01 — Schemas de PostgreSQL

Este documento fija los schemas físicos definitivos de PostgreSQL. No redefine la decisión raíz — un schema por Bounded Context, en una única base de datos física — ya tomada en [04-MODELO-DATOS.md §2](../04-MODELO-DATOS.md) y [ADR-0004](../ADR/0004-multitenancy.md); la desarrolla al nivel de detalle de qué agregado vive en cuál, y por qué dos excepciones de empaquetado físico (ya anticipadas en el modelo de dominio) no rompen esa regla.

## 1. Los seis schemas

| Schema | Bounded Context | Agregados que aloja |
|---|---|---|
| `identity` | Identity & Access | `User`, `Role`, `Session` |
| `organization` | Organization | `Company`, `Branch`, `CompanySettings` |
| `scheduling` | Scheduling | `AvailabilitySlot` |
| `rental` | Rental Operations **+** Commerce (empaquetado físico, ver §3) | `Customer`, `Vehicle`, `VehicleCategory`, `Reservation`, **`Invoice`** |
| `commerce` | Commerce (empaquetado físico, ver §3) | `Payment`, `SecurityDeposit` |
| `support` | Support | `File`, `Notification`, `AuditLogEntry`, `outbox_event` (mecanismo transversal, ver §5) |

Este mapeo es una consecuencia mecánica de [model/01-BOUNDED_CONTEXTS.md §1](../model/01-BOUNDED_CONTEXTS.md) y de la tabla de proyectos ya fijada en [technical/02-PROYECTOS.md §2-3](../technical/02-PROYECTOS.md) — ningún agregado de este documento aparece en un schema no anticipado por esas dos fuentes.

## 2. Por qué existe cada schema

| Schema | Pregunta que responde | Por qué no se funde con otro |
|---|---|---|
| `identity` | "¿Quién es este actor y qué puede hacer técnicamente?" | Autenticación y RBAC cambian por actores y a una cadencia (rotación de sesión, cada pocos minutos) completamente distinta de cualquier dato de negocio; fusionar el schema acoplaría físicamente dos ciclos de vida sin relación transaccional real |
| `organization` | "¿Qué empresa es esta, qué sucursales tiene, qué política eligió?" | Es la raíz de identidad de tenant — toda tabla de los demás schemas la referencia por `company_id`, nunca al revés; mantenerla separada es lo que permite razonar sobre "qué pertenece a esta empresa" sin cruzar ningún otro schema |
| `scheduling` | "¿Está libre este recurso en este rango de tiempo?" | Deliberadamente ciega a qué es un `Vehicle` (ver ACL en [model/01-BOUNDED_CONTEXTS.md §4.2](../model/01-BOUNDED_CONTEXTS.md)); si sus tablas convivieran en `rental`, un `JOIN` directo entre `availability_slots` y `vehicles` se volvería trivial de escribir por accidente, exactamente la contaminación que la ACL existe para impedir a nivel de código — separarla en su propio schema hace ese acoplamiento visible e incómodo también a nivel de base de datos |
| `rental` | "¿Qué compromiso de alquiler existe entre un cliente y un vehículo, y qué se le facturó?" | Núcleo transaccional del producto v1.0; aloja además `Invoice`/`Charge` por la razón de empaquetado físico de §3 |
| `commerce` | "¿Cuánto se retiene o se cobra, con independencia de qué lo originó?" | `Payment` y `SecurityDeposit` son mecanismos genuinamente genéricos ("cobrar/retener un monto por un medio de pago") reutilizables sin cambios por un segundo producto futuro — mantenerlos en su propio schema es lo que permite, el día que se extraigan a un servicio propio, migrar un schema completo sin desentrañar tablas mezcladas con `rental` |
| `support` | "¿Qué pasó, quién debe enterarse, y dónde vive el archivo?" | Servicios de infraestructura de negocio transversal sin reglas propias de alquiler, cobro o identidad — todo Bounded Context los consume, ninguno los posee |

## 3. Dos excepciones de empaquetado físico (ya fijadas en el modelo de dominio, no reabiertas aquí)

### 3.1 `Invoice`/`Charge` viven en `rental`, no en `commerce`

El Bounded Context Commerce, como lenguaje ubicuo y frontera de reglas, es único ([model/01-BOUNDED_CONTEXTS.md §3.5](../model/01-BOUNDED_CONTEXTS.md)). Su empaquetado físico, sin embargo, ya se decidió dividido: `payments` vive en `platform/` desde el día uno (genéricamente reutilizable), mientras que `invoices` vive hoy en `products/rental/` porque su motor de emisión fiscal (numeración, impuestos dependientes de país) no se ha extraído todavía a Plataforma — no existe aún un segundo producto que lo demande, y extraerlo prematuramente sería la sobreingeniería que [00-VISION.md §3](../00-VISION.md) prohíbe. Este documento **hereda esa decisión sin reabrirla**: `invoices` y `charges` son tablas del schema `rental`, no de `commerce`.

**Consecuencia física directa**: `invoices` puede tener FK normal hacia `reservations` y `customers` (mismo schema, ver [03-RELACIONES.md §2](03-RELACIONES.md)), mientras que `payments` (schema `commerce`) solo puede referenciar `invoices` por columna de ID opaca, nunca por FK — es una relación inter-schema aunque ambos formen parte del mismo Bounded Context de reglas.

### 3.2 `Payment` y `SecurityDeposit` comparten el schema `commerce`

Ambos son, por diseño ya fijado en [technical/02-PROYECTOS.md §2.4](../technical/02-PROYECTOS.md), mecanismos genéricos de "retener/cobrar un monto" que no justifican módulos físicos separados. Comparten schema por la misma razón que comparten librería física — no hay una frontera de Bounded Context distinta entre ellos, solo dos agregados del mismo contexto de reglas.

## 4. Reglas de aislamiento entre schemas

1. **Ningún schema de `platform`** (`identity`, `organization`, `scheduling`, `commerce`, `support`) **contiene una FK hacia una tabla de `rental`** — refuerzo físico exacto de INV-P03 (`platform/* nunca depende de products/*`, [model/07-INVARIANTS.md §3](../model/07-INVARIANTS.md)). Esto es verificable con una sola consulta al catálogo de constraints de PostgreSQL (`information_schema.referential_constraints`), lo que permite un chequeo de CI automatizado, no solo una convención de code review.
2. **Ninguna FK cruza la frontera de dos schemas**, sin excepción — detalle completo y catálogo exhaustivo de qué se referencia por ID opaco en lugar de FK en [03-RELACIONES.md §3](03-RELACIONES.md).
3. **Toda tabla con datos de un tenant, en cualquier schema, lleva su propia columna `company_id`** — incluidas las tablas de `scheduling`, cuyo lenguaje de dominio es deliberadamente ciego a `Company` como concepto de negocio. Esta aparente tensión se resuelve así: `company_id` en `scheduling.availability_slots` es una columna exigida por la invariante transversal de plataforma INV-P01 (aislamiento multi-tenant, [model/07-INVARIANTS.md §3](../model/07-INVARIANTS.md)), nunca un campo que el `domain/` de `Scheduling` lea o interprete — es infraestructura de seguridad (RLS), no lenguaje ubicuo. La ACL de [model/01-BOUNDED_CONTEXTS.md §4.2](../model/01-BOUNDED_CONTEXTS.md) sigue intacta: el dominio de `AvailabilitySlot` nunca gana un campo de negocio como `licensePlate`; `company_id` no es ese tipo de campo. Ver justificación extendida en [10-DECISIONES.md](10-DECISIONES.md) #1.
4. **Migraciones por schema, historial único**: cada archivo `.prisma` (y por tanto cada schema) lo modifica el equipo dueño del módulo correspondiente ([technical/04-PERSISTENCE.md §1](../technical/04-PERSISTENCE.md)), pero Prisma Migrate mantiene un único historial de migraciones para el datasource completo — el ownership de *archivo* no implica un historial de migraciones independiente por schema (limitación de la herramienta, no una decisión de este documento; detalle en [07-MIGRACIONES.md](07-MIGRACIONES.md)).
5. **Ningún schema nuevo se crea para un tenant, un país, ni un ambiente**: la única razón para dar de alta un schema nuevo es un Bounded Context nuevo (p. ej. `workshop` para un futuro segundo producto) — la unidad de particionamiento de tenants es la fila (`company_id` + RLS, [ADR-0004](../ADR/0004-multitenancy.md)), nunca el schema.

## 5. `outbox_event` no pertenece a ningún Bounded Context

La tabla que sostiene el Outbox Pattern ([technical/04-PERSISTENCE.md §4](../technical/04-PERSISTENCE.md)) no protege ningún invariante de negocio de ningún Bounded Context — es un mecanismo transversal de entrega confiable de eventos. Se aloja físicamente en `support` (decisión de detalle ya delegada a la implementación por ese mismo documento) como **una única tabla con columna `source_schema`**, no una tabla por schema emisor — justificación completa de esta elección concreta en [10-DECISIONES.md](10-DECISIONES.md) #2. Que viva en `support` no significa que el Bounded Context Support la posea conceptualmente: es infraestructura de plataforma alojada ahí por conveniencia operativa (un único lugar que vigilar), igual que `company_id` en `scheduling` es infraestructura y no lenguaje ubicuo (§4.3).

## 6. Qué NO se decide en este documento

- El contenido de columnas de cada tabla — ver [04-COLUMNAS-CONCEPTUALES.md](04-COLUMNAS-CONCEPTUALES.md).
- Los índices y constraints de cada schema — ver [05-INDICES-Y-CONSTRAINTS.md](05-INDICES-Y-CONSTRAINTS.md).
- El mecanismo exacto de RLS por tabla — ver [06-RLS.md](06-RLS.md).
- Si un futuro segundo producto (Taller Mecánico, Hotel) necesitará un schema `workshop`/`hotel` propio — se decide cuando ese producto exista, siguiendo el mismo criterio de este documento, no antes (coherente con [00-VISION.md §5](../00-VISION.md)).
