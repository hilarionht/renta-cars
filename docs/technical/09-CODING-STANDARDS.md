# 09 — Coding Standards

Extiende [05-CONVENCIONES-BACKEND.md §2](../05-CONVENCIONES-BACKEND.md) y [06-CONVENCIONES-FRONTEND.md](../06-CONVENCIONES-FRONTEND.md) con las reglas técnicas que faltan por fijar antes de implementar: naming de piezas introducidas en esta fase, imports, manejo de errores como registro declarativo, y convenciones generales de TypeScript.

## 1. Naming (elementos nuevos de esta fase)

| Elemento | Convención | Ejemplo |
|---|---|---|
| Proyecto Nx | `<scope-corto>-<module>-<type>` | `platform-vehicles-domain`, `rental-reservations-infrastructure` |
| Listener de evento | `<Evento>Listener` (sin el sufijo de versión) | `ReservationConfirmedListener` |
| Processor de BullMQ | `<Cola>Processor` | `OutboxRelayProcessor`, `SendNotificationProcessor` |
| Cola de BullMQ | `<module>.<intención>` (kebab, con punto separador de namespace) | `notifications.send`, `support.outbox-relay` |
| Guard | `<Responsabilidad>Guard` | `TenantModuleEnabledGuard` |
| Interceptor | `<Responsabilidad>Interceptor` | `CorrelationIdInterceptor` |
| Prisma Client Extension | `<responsabilidad>Extension` | `tenantScopeExtension`, `softDeleteExtension` |
| Token de inyección de puerto | `<NOMBRE_PUERTO>` en `SCREAMING_SNAKE_CASE`, valor `Symbol('NombrePuerto')` | `VEHICLE_REPOSITORY`, `CALENDAR_PORT` |
| Archivo | `kebab-case.ts`, sufijo por tipo (`.command.ts`, `.handler.ts`, `.repository.ts`, `.listener.ts`, `.processor.ts`) | `confirm-reservation.handler.ts` |
| Test | mismo nombre de archivo + `.spec.ts` (unitario/aplicación) o `.integration.spec.ts` (Testcontainers) | `confirm-reservation.handler.spec.ts` |

Esta tabla es aditiva a la de [05-CONVENCIONES-BACKEND.md §2](../05-CONVENCIONES-BACKEND.md) — no la reemplaza.

## 2. Imports

- Todo import entre proyectos Nx usa el alias `@platform/<module>/<type>` o `@rental/<module>/<type>` fijado en [01-MONOREPO.md §8](01-MONOREPO.md) — nunca una ruta relativa que atraviese la frontera de un proyecto (`../../../otro-proyecto/src/...`), verificado por la regla ESLint `no-relative-import-across-lib-boundary` de `tooling/eslint/`.
- Dentro de un mismo proyecto, imports relativos son aceptables y preferidos sobre el alias propio (evita indirección innecesaria).
- Orden de imports en un archivo, agrupado y separado por línea en blanco: (1) módulos de Node/librerías externas, (2) alias `@platform/*`/`@rental/*`/`@frontend/*` de otros proyectos, (3) imports relativos internos al proyecto — impuesto por `eslint-plugin-import`, no por revisión manual.
- Un `index.ts` de proyecto exporta explícitamente cada símbolo público (`export { Vehicle } from './entities/vehicle'`) — prohibido `export *` salvo en el propio `index.ts` reexportando un único submódulo interno de barrel, para que la superficie pública sea legible con un vistazo al archivo.

## 3. Manejo de errores: registro declarativo

- Toda excepción de dominio extiende una base `DomainError` común (ya fijado en [05-CONVENCIONES-BACKEND.md §6](../05-CONVENCIONES-BACKEND.md)), con convención de nombre `<Motivo>Error` (`ReservationOverlapError`, `CustomerNotEligibleError`).
- Cada módulo mantiene un **registro declarativo** (mapa, no código imperativo) que asocia cada subclase de `DomainError` que produce con: código HTTP (§4 de [08-API-CONTRACTS.md](../08-API-CONTRACTS.md)), `code` estable (`RESERVATION_OVERLAP`), y plantilla de `title`. `DomainExceptionFilter` (§6 de [03-BACKEND-ARCHITECTURE.md](03-BACKEND-ARCHITECTURE.md)) consulta este registro — nunca contiene un `switch`/`if` creciente por tipo de error, que se volvería inmanejable a medida que se agregan módulos.
- Un error de dominio no mapeado en el registro de su propio módulo es un error de desarrollo (falla el test de contrato del módulo, no llega nunca a producción sin código HTTP asociado) — el registro es obligatorio, no opcional, para cada `DomainError` nueva.

## 4. Convenciones generales de TypeScript

- **Modo estricto** (`strict: true`, incluye `noImplicitAny`, `strictNullChecks`) en todo el workspace, sin excepciones por proyecto.
- **Prohibido `any`** para evadir un error de tipos — mismo estándar ya fijado para frontend en [06-CONVENCIONES-FRONTEND.md §11](../06-CONVENCIONES-FRONTEND.md), extendido aquí a backend: si un tipo no encaja, se corrige el tipo o el contrato, no se apaga el chequeo.
- **Inmutabilidad por defecto**: propiedades de entidades y Value Objects son `readonly`; una "modificación" de un Value Object siempre retorna una instancia nueva (ya fijado conceptualmente en [model/04-VALUE_OBJECTS.md](../model/04-VALUE_OBJECTS.md)); una entidad expone métodos de comportamiento (`vehicle.markAsCheckedOut()`), nunca setters públicos de campo.
- **`null` vs `undefined`**: un campo de dominio ausente por diseño de negocio (p. ej. `Branch.closedAt` mientras está `Active`) usa `undefined`/propiedad opcional; `null` se reserva exclusivamente para el límite con Prisma (que sí distingue `null` de ausencia de columna) — la capa de repositorio traduce entre ambos al mapear `toDomain`/`toPersistence` (§2 de [04-PERSISTENCE.md](04-PERSISTENCE.md)), de forma que `domain/` y `application/` nunca manejan `null` directamente.
- **Fechas y tiempo**: ninguna aritmética de fechas cruda (`Date.getTime()` disperso) fuera de la implementación interna de `DateRange`/VOs de tiempo del `shared-kernel` — todo cálculo de duración/solapamiento pasa por sus métodos (`overlaps`, etc.), coherente con [model/04-VALUE_OBJECTS.md §1.2](../model/04-VALUE_OBJECTS.md).
- **Linting/formato**: ESLint + Prettier con configuración única en `tooling/eslint/`, heredada por todo proyecto — ninguna librería define su propia configuración divergente.
- **Mensajes de commit**: *Conventional Commits* (`feat:`, `fix:`, `refactor:`, ...) — insumo directo del versionado semántico automático de [08-DEVOPS.md §3](08-DEVOPS.md).

## 5. Estructura de archivo

- Un archivo por clase/tipo exportado principal en `domain/` y `application/` (una entidad, un Value Object, un Command, un Handler) — facilita que el nombre de archivo prediga el contenido y que el histórico de Git por archivo sea significativo.
- `infrastructure/` tolera archivos algo más grandes cuando agrupan configuración cohesiva (p. ej. el módulo NestJS con sus bindings de DI), pero un Controller, un Repository y un Listener nunca comparten archivo.
- Profundidad de carpeta limitada a lo ya fijado en el árbol de [05-CONVENCIONES-BACKEND.md §1](../05-CONVENCIONES-BACKEND.md) — no se introduce un nivel adicional de anidamiento por convención de esta fase.

## 6. Testing (referencia, sin redefinir)

La estrategia de testing por capa ya está completamente fijada en [10-TESTING.md](../10-TESTING.md) — este documento no la repite, solo fija su ubicación física: cada proyecto Nx (`type:domain`/`type:application`/`type:infrastructure`) tiene sus tests co-ubicados (`*.spec.ts` junto al archivo que prueba), y los tests de integración con Testcontainers se marcan con el sufijo `.integration.spec.ts` (§1) para que el target de CI correspondiente (§2.1 de [08-DEVOPS.md](08-DEVOPS.md)) pueda seleccionarlos por patrón de archivo sin configuración adicional por proyecto.

## 7. Qué se decide en otro documento

- Pirámide de testing y qué se prueba en cada capa → [10-TESTING.md](../10-TESTING.md) (sin cambios).
- Reglas de frontera entre proyectos (qué puede importar qué) → [01-MONOREPO.md §5](01-MONOREPO.md).
- Convenciones de nomenclatura de dominio ya fijadas (entidades, comandos, eventos, DTOs HTTP) → [05-CONVENCIONES-BACKEND.md §2](../05-CONVENCIONES-BACKEND.md) (sin cambios).
