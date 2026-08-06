# ADR-0003 — PostgreSQL + Prisma ORM como capa de persistencia

## Estado
Aceptado

## Contexto
La Plataforma necesita un motor de base de datos y una capa de acceso a datos que: soporte modelado fuertemente relacional con integridad referencial (crítico en Reservations/Payments/Invoices), soporte aislamiento multi-tenant robusto, y ofrezca una capa de ORM con buen soporte de tipos end-to-end para mantener velocidad de desarrollo en un monorepo TypeScript de backend y frontend.

## Decisión
**PostgreSQL** como motor de base de datos único. **Prisma ORM** como capa de acceso a datos, con schema multi-archivo (un archivo `.prisma` por bounded context, ver [04-MODELO-DATOS.md §2](../04-MODELO-DATOS.md)) compilando a un único Prisma Client, y siempre detrás de puertos de repositorio definidos por el dominio (nunca inyectado directamente en `domain/`, ver [05-CONVENCIONES-BACKEND.md](../05-CONVENCIONES-BACKEND.md)).

## Alternativas consideradas

### Motor de base de datos

| Opción | Evaluación |
|---|---|
| MySQL | Descartado: soporte más débil de Row-Level Security nativo (clave para [ADR-0004](0004-multitenancy.md)), de schemas como unidad de organización, y de tipos avanzados (JSONB, exclusion constraints con GiST) usados en el modelo de disponibilidad de `calendar` |
| MongoDB | Descartado: el dominio central (Reservations, Payments, Invoices) es fuertemente relacional con integridad referencial crítica; forzar un modelo documental introduciría consistencia eventual y validación manual donde Postgres la da nativamente |
| **PostgreSQL** | Elegido: RLS nativo, schemas nativos, extensiones maduras (`btree_gist` para exclusion constraints de rangos de fecha), JSONB para extensibilidad puntual, 25+ años de madurez y comunidad, sin riesgo de discontinuidad en horizonte de 10 años |

### Capa de acceso a datos

| Opción | Evaluación |
|---|---|
| TypeORM | Descartado: histórico de inconsistencias de tipado end-to-end, patrón Active Record por defecto que tiende a filtrar el ORM hacia el dominio, migraciones menos predecibles que Prisma Migrate |
| Drizzle ORM | Descartado (a la fecha de esta decisión): ecosistema y tooling operativo (Prisma Studio, generación de tipos, madurez de migraciones declarativas) menos probado a la escala de un proyecto de 10 años; reevaluable en el futuro si su ecosistema madura significativamente, pero no hay motivo suficiente hoy para asumir ese riesgo |
| SQL crudo con query builder (Kysely, etc.) | Descartado como capa única: máximo control pero mayor costo de mantenimiento de mapeo objeto-relacional manual en cada módulo; Prisma da suficiente control (incluyendo `$queryRaw` puntual cuando se necesita) sin ese costo sistemático |
| **Prisma ORM** | Elegido: tipado end-to-end generado, migraciones declarativas versionadas, soporte estable de `multiSchema` (alineado con [ADR arquitectónico de un schema por bounded context](../04-MODELO-DATOS.md)), curva de aprendizaje baja para nuevos desarrolladores del equipo a lo largo de los años |

## Consecuencias

**Positivas**
- Tipado fuerte desde la base de datos hasta el caso de uso, reduciendo una clase entera de bugs de mapeo.
- Migraciones declarativas y versionadas junto al código del módulo dueño.
- El modelo de Prisma nunca contamina el dominio porque siempre está detrás de un puerto de repositorio (regla de [02-ARQUITECTURA.md](../02-ARQUITECTURA.md)).

**Negativas / trade-offs aceptados**
- Dependencia de un único proveedor de ORM; mitigado porque el dominio no conoce Prisma directamente — reemplazar Prisma en el futuro es un cambio de `infrastructure/`, no de `domain/`.
- Prisma no expone control SQL tan fino como un query builder en casos extremos de optimización; se acepta el uso puntual de `$queryRaw` tipado para esos casos, documentado por query.

## Revisión
Se reevalúa si Prisma deja de recibir mantenimiento activo, o si aparece una limitación estructural real (no hipotética) que bloquee un requisito de negocio.
