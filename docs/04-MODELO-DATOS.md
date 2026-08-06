# 04 — Modelo de Datos (reglas, no esquema físico)

Este documento define **reglas** para PostgreSQL y Prisma. No contiene DDL ni el `schema.prisma` final — eso se genera en la fase de implementación, respetando lo aquí definido. Ver [00-VISION.md §4.2](00-VISION.md) sobre no-objetivos.

## 1. Decisión raíz: PostgreSQL + Prisma

| Opción | Por qué se descarta / acepta |
|---|---|
| MySQL | Menor soporte nativo de features usadas activamente (RLS, schemas, JSONB avanzado, extensiones tipo `pg_trgm`) |
| MongoDB | El dominio es fuertemente relacional (Reservations, Payments, Invoices con integridad referencial crítica); un modelo documental introduciría consistencia eventual donde no se necesita |
| **PostgreSQL** | RLS nativo (clave para multi-tenancy defensiva), schemas nativos (clave para aislar bounded contexts), JSONB para extensibilidad puntual, extenso ecosistema, madurez de 10+ años garantizada |
| TypeORM | Menor seguridad de tipos end-to-end, migraciones menos predecibles |
| Drizzle | Más joven, ecosistema y tooling (Prisma Studio, generación de tipos, migraciones) menos maduro para un proyecto de 10 años |
| **Prisma ORM** | Mejor DX, tipado end-to-end, migraciones declarativas, soporte multi-schema estable, generador de cliente desacoplable detrás de puertos |

Justificación extendida en [ADR-0003](ADR/0003-postgresql-prisma.md).

## 2. Un schema de PostgreSQL por Bounded Context

Cada Bounded Context (§1 de [03-DOMINIO.md](03-DOMINIO.md)) tiene su propio **schema de PostgreSQL** dentro de la misma base de datos física:

```
identity.*
organization.*   (companies, branches, settings)
rental.*         (customers, vehicles, reservations)
commerce.*       (payments, invoices)
scheduling.*     (calendar / availability_slots)
support.*        (files, notifications, audit)
```

**Por qué**: refuerza a nivel de base de datos el mismo límite que ya existe a nivel de código (§1 de [02-ARQUITECTURA.md](02-ARQUITECTURA.md)). Un desarrollador no puede escribir un JOIN accidental entre `rental.reservations` y `commerce.invoices` sin cruzar explícitamente de schema — lo cual sirve como señal de alarma en code review. También deja la base de datos **pre-particionada** para el día en que un bounded context se extraiga a un servicio con su propia base de datos: migrar un schema completo a otra instancia es mecánico; separar tablas entremezcladas no lo es.

Prisma soporta esto de forma estable mediante `multiSchema` (`@@schema("rental")` por modelo) mapeado en un único `datasource`. Se usa **una carpeta de schema Prisma multi-archivo** (un archivo `.prisma` por bounded context) que compila a un único Prisma Client — esto da separación de autoría/ownership de código sin renunciar a un cliente tipado único. Detalle de convención en [05-CONVENCIONES-BACKEND.md](05-CONVENCIONES-BACKEND.md).

## 3. Sin Foreign Keys entre schemas distintos

- **Dentro de un mismo schema/bounded context**: FKs de Postgres normales, con las reglas de integridad referencial que correspondan (`ON DELETE RESTRICT` por defecto; `CASCADE` solo donde el negocio lo exige explícitamente y está documentado).
- **Entre schemas distintos**: **nunca** FK física. La referencia se guarda como columna de ID simple (p. ej. `reservations.customer_id` sin constraint hacia `rental.customers` si `customers` estuviera en otro schema — en este caso están en el mismo schema `rental`, pero `reservations.company_id` **sí** sería un ID sin FK hacia `organization.companies`).

**Por qué**: una FK entre schemas es, en la práctica, un acoplamiento fuerte entre bounded contexts a nivel de motor de base de datos — exactamente lo que la arquitectura modular busca evitar. La integridad se garantiza a nivel de aplicación (el caso de uso valida que el `companyId` referenciado existe, vía el puerto correspondiente) y se refuerza con jobs de consistencia/auditoría, no con constraints físicos cross-schema.

## 4. Multi-tenancy a nivel de datos

- Toda tabla de negocio (Plataforma o Producto) que no sea un catálogo global del sistema incluye `company_id UUID NOT NULL`.
- **Row-Level Security (RLS)** habilitado en toda tabla con `company_id`: una política `USING (company_id = current_setting('app.current_company_id')::uuid)`. La aplicación fija `app.current_company_id` al inicio de cada request (vía middleware, dentro de la misma conexión/transacción).
- Esto es una **segunda capa de defensa**, no la única: el filtro también se aplica explícitamente en la capa de repositorio (Prisma Client Extension). Un bug de aplicación que olvide el filtro seguiría bloqueado por RLS; un bug de configuración de RLS seguiría bloqueado por el filtro de aplicación.
- Detalle completo de la estrategia en [ADR-0004](ADR/0004-multitenancy.md).

## 5. Convenciones generales

| Regla | Detalle |
|---|---|
| Identificadores | UUID v7 (ordenable por tiempo) como PK en todas las tablas de negocio. No se usan IDs autoincrementales expuestos externamente. |
| Nombres de tabla | `snake_case`, plural (`reservations`, `vehicle_categories`) |
| Nombres de columna | `snake_case` |
| Timestamps | `created_at`, `updated_at` (siempre); `deleted_at` solo en tablas con soft-delete explícitamente justificado |
| Soft delete | Excepción, no regla general. Se usa solo donde el negocio requiere retención por auditoría/legal (p. ej. `reservations`, `invoices`). El resto usa borrado físico o desactivación (`is_active`) según corresponda |
| Moneda | Nunca `float`/`double`. Montos como entero en unidad mínima (centavos) + columna de moneda ISO-4217, mapeado al VO `Money` del dominio |
| Fechas/horas | `timestamptz` siempre; nunca `timestamp` sin zona horaria |
| JSONB | Permitido solo para datos verdaderamente no estructurados o de extensión (p. ej. metadata de integraciones externas), nunca para modelar relaciones de negocio que deberían ser tablas |

## 6. Migraciones

- Prisma Migrate como mecanismo único de evolución de esquema. Prohibido alterar el esquema manualmente en producción.
- Toda migración es **aditiva y reversible** cuando sea posible (agregar columna nullable → backfill → agregar constraint `NOT NULL` en migración separada), para permitir despliegues sin downtime.
- Las migraciones se versionan junto con el código del módulo dueño del schema correspondiente — el ownership del schema de datos sigue al ownership del módulo (§2).

## 7. Auditoría a nivel de datos

El módulo `audit` (Plataforma) no vive en las mismas tablas que el resto: su schema (`support.audit_log`) almacena eventos de auditoría append-only, poblados por listeners de eventos de dominio (§4 de [03-DOMINIO.md](03-DOMINIO.md)), no por triggers de base de datos — para mantener la lógica de "qué se audita" en el dominio/aplicación, testeable, en vez de en SQL.

## 8. Índices y performance (reglas, no implementación)

- Todo `company_id` usado en filtros obligatorios (§4) debe ser el primer componente de índices compuestos relevantes.
- Los rangos de fechas usados por `Calendar`/`Reservations` para detectar solapamientos usan índices GiST (`btree_gist` + exclusion constraints) para garantizar, a nivel de base de datos, que **no puede existir** una condición de carrera que permita doble reserva — esto es una restricción de integridad, no solo una optimización de lectura.
- Decisiones de índices específicas se documentan junto a cada migración, no en este documento.

## 9. Qué se decide más adelante (no aquí)

- El `schema.prisma` completo por bounded context.
- Estrategia de particionamiento de tablas de alto volumen (p. ej. `audit_log`), a evaluar en Fase 6 (Hardening) con datos reales de volumen.
- Estrategia de réplicas de lectura, si el volumen de Reports lo justifica.
