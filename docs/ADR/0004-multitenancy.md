# ADR-0004 — Estrategia de Multi-tenancy

## Estado
Aceptado

## Contexto
La Plataforma es SaaS: una misma instalación sirve a múltiples empresas (`Company`) con datos que deben permanecer estrictamente aislados entre sí. Una fuga de datos cross-tenant es la falla de seguridad más grave posible en este modelo de negocio (ver [09-SEGURIDAD.md §5](../09-SEGURIDAD.md)). Es necesario decidir el modelo de aislamiento de datos.

## Decisión
**Base de datos compartida, schema compartido por bounded context, aislamiento por columna `company_id` + Row-Level Security (RLS) de PostgreSQL como defensa en profundidad**, reforzado por un filtro obligatorio a nivel de aplicación (Prisma Client Extension ligada al contexto de request).

Doble capa, ambas obligatorias y no sustituibles entre sí:
1. **Aplicación**: todo repositorio filtra automáticamente por `companyId` del `RequestContext` — un desarrollador no puede omitirlo porque no escribe el filtro a mano.
2. **Base de datos**: política RLS `USING (company_id = current_setting('app.current_company_id')::uuid)` en toda tabla con `company_id`, como red de seguridad ante un bug de aplicación.

## Alternativas consideradas

| Estrategia | Evaluación |
|---|---|
| Base de datos separada por tenant | Aislamiento máximo, pero costo operativo de aprovisionar/migrar/monitorear N bases de datos crece linealmente con el número de companies; inviable de gestionar con el equipo previsto en los primeros años; se revalúa solo si un cliente enterprise específico exige aislamiento físico contractual |
| Schema de Postgres separado por tenant | Mejor aislamiento que columna compartida, pero con cientos/miles de companies potenciales, el número de schemas y la complejidad de migraciones (aplicar una migración a N schemas) se vuelve operacionalmente costoso; los schemas en esta plataforma ya están reservados para separar bounded contexts ([04-MODELO-DATOS.md §2](../04-MODELO-DATOS.md)), no tenants |
| **Columna `company_id` + RLS + filtro de aplicación** (elegida) | Balance correcto: aislamiento robusto con defensa en profundidad, costo operativo constante sin importar el número de tenants, migraciones únicas para todos los tenants |

## Consecuencias

**Positivas**
- Costo operativo (backups, migraciones, monitoreo) no crece con el número de companies.
- Defensa en profundidad: un bug en una capa no es suficiente para causar una fuga — se necesitarían fallar ambas capas simultáneamente.
- Modelo simple de entender y auditar: toda tabla de negocio tiene `company_id`, sin excepción salvo catálogos globales documentados.

**Negativas / trade-offs aceptados**
- No ofrece aislamiento físico (útil para cumplimiento normativo extremo tipo "los datos de este cliente deben estar en infraestructura dedicada"); si un cliente futuro lo exige contractualmente, se resuelve con una instalación dedicada de la Plataforma completa para ese cliente, no cambiando el modelo de datos.
- Requiere disciplina estricta en cada migración nueva (no olvidar `company_id` + política RLS en tablas nuevas) — mitigado con checklist de PR y tests obligatorios de fuga cross-tenant ([10-TESTING.md §7](../10-TESTING.md)).

## Revisión
Se reevalúa si aparece un requisito contractual real de aislamiento físico por cliente, o si el volumen de datos de un tenant específico degrada el rendimiento de los demás (en cuyo caso se evalúa partición o migración selectiva de ese tenant a infraestructura dedicada, sin cambiar el modelo para el resto).
