# 05 — Convenciones de Backend (NestJS)

Guía de referencia para construir cualquier módulo backend de la Plataforma. Su cumplimiento no es opcional: es lo que mantiene la Clean Architecture descrita en [02-ARQUITECTURA.md](02-ARQUITECTURA.md) viva a lo largo de 10 años y de decenas de desarrolladores distintos.

## 1. Estructura de carpetas por módulo

```
libs/<platform|products/rental>/<modulo>/
  domain/
    entities/
    value-objects/
    events/
    services/
    ports/                    # interfaces que el dominio necesita (repos, gateways)
  application/
    commands/
      create-reservation/
        create-reservation.command.ts
        create-reservation.handler.ts
    queries/
      list-available-vehicles/
        list-available-vehicles.query.ts
        list-available-vehicles.handler.ts
    ports/                    # interfaces que la aplicación necesita hacia afuera (si no viven en domain)
  infrastructure/
    persistence/
      prisma/
        prisma-<agregado>.repository.ts
    http/
      <modulo>.controller.ts
      dto/
    events/
      <modulo>.event-listeners.ts
    providers/                 # adaptadores a servicios externos (si aplica)
  <modulo>.module.ts           # composición NestJS: bindings de puertos a implementaciones
  index.ts                     # ÚNICA superficie pública del módulo
```

**Regla no negociable**: solo lo exportado por `index.ts` es visible fuera del módulo. Todo lo demás es un detalle de implementación, aunque técnicamente TypeScript permitiría importarlo — Nx module boundaries lo bloquea en CI (ver [ADR-0006](ADR/0006-monorepo-nx.md)).

## 2. Nomenclatura

| Elemento | Convención | Ejemplo |
|---|---|---|
| Entidad de dominio | PascalCase, sustantivo | `Reservation`, `Vehicle` |
| Value Object | PascalCase, sustantivo o adjetivo | `Money`, `DateRange`, `LicensePlate` |
| Command | `<Verbo><Sustantivo>Command` | `ConfirmReservationCommand` |
| Command Handler | `<Command>Handler` | `ConfirmReservationHandler` |
| Query | `<Verbo><Sustantivo>Query` | `ListAvailableVehiclesQuery` |
| Evento de dominio | `<Sustantivo><ParticipioPasado>Event` + versión en payload | `ReservationConfirmedEvent` (`v1`) |
| Puerto (interfaz) | `<Nombre>Port` o `<Nombre>Repository` | `VehicleRepository`, `PaymentGatewayPort` |
| Adaptador (implementación) | `<Tecnología><Puerto>` | `PrismaVehicleRepository`, `StripePaymentGatewayPort` |
| DTO de entrada HTTP | `<Accion><Recurso>RequestDto` | `CreateReservationRequestDto` |
| DTO de salida HTTP | `<Recurso>ResponseDto` | `ReservationResponseDto` |
| Módulo NestJS | `<Modulo>Module` | `ReservationsModule` |

## 3. Reglas de capas (resumen ejecutable)

1. **`domain/`** no importa nada de `@nestjs/*`, `@prisma/client`, `axios`, ni de `infrastructure/` o `application/` de ningún módulo. Solo TypeScript y, cuando aplique, `shared-kernel`.
2. **`application/`** importa de `domain/` (propio) y de las interfaces públicas (`index.ts`) de otros módulos que necesite como colaboradores. Nunca importa `infrastructure/` de ningún módulo, ni siquiera el propio.
3. **`infrastructure/`** implementa los puertos definidos en `domain/` o `application/`. Es la única capa autorizada a usar `PrismaService`, HTTP clients, SDKs de terceros.
4. El **binding** puerto → adaptador ocurre exclusivamente en `<modulo>.module.ts`, vía `provide`/`useClass` de NestJS. Ningún caso de uso instancia una implementación concreta directamente.

```typescript
// reservations.module.ts — único lugar donde domain conoce infra, vía DI
providers: [
  { provide: VEHICLE_REPOSITORY, useClass: PrismaVehicleRepository },
  { provide: CALENDAR_PORT, useClass: HttpCalendarAdapter },
]
```

## 4. Inyección de dependencias

- Toda dependencia hacia un puerto se inyecta por **token de interfaz** (`Symbol` o `InjectionToken`), nunca por clase concreta.
- Prohibido `new` de un servicio de aplicación o repositorio fuera de un test. NestJS resuelve el grafo de dependencias.
- Prohibidos los Singletons manuales (`static instance`, módulos con estado mutable a nivel de proceso). El scope de vida lo controla el contenedor de NestJS (`DEFAULT`, `REQUEST` cuando el contexto de tenant lo requiera — ver §7).

## 5. Casos de uso (Commands/Queries)

- Un Command Handler hace **una** cosa: valida entrada mínima de infraestructura (ya validada por DTO), carga el/los agregado(s) vía repositorio, invoca comportamiento del dominio, persiste, publica eventos. La regla de negocio vive en el agregado o en un servicio de dominio — nunca en el handler.
- Un Query Handler puede saltarse el modelo de dominio rico y usar Prisma directamente para proyecciones de lectura optimizadas, **siempre dentro de `infrastructure/` o `application/`, nunca exponiendo Prisma a `domain/`**.
- Un Command Handler retorna, como máximo, el ID del agregado afectado o un DTO mínimo de confirmación — nunca el agregado de dominio completo (evita que Controllers empiecen a acoplarse a la forma interna del dominio).

## 6. Manejo de errores

- El dominio lanza **excepciones de dominio tipadas** (`ReservationOverlapError extends DomainError`), sin conocer HTTP.
- Un `ExceptionFilter` global en `infrastructure/http` traduce excepciones de dominio a respuestas HTTP consistentes con [08-API-CONTRACTS.md §4](08-API-CONTRACTS.md).
- Prohibido capturar excepciones de dominio dentro de `application/` solo para loguearlas y relanzarlas sin valor agregado — el logging estructurado se hace en un interceptor transversal.

## 7. Contexto de tenant (Company/Branch)

- El `companyId` (y `branchId` cuando aplique) del usuario autenticado se resuelve una vez, en un `Guard`/`Middleware` de `infrastructure/http`, y se propaga vía un `RequestContext` de scope `REQUEST` inyectable.
- Ningún caso de uso recibe `companyId` como parámetro "de confianza" del cliente HTTP salvo en endpoints explícitamente cross-tenant de administración de plataforma (excepción documentada caso por caso).
- Todo repositorio Prisma aplica el filtro de `companyId` a través de una Prisma Client Extension conectada al `RequestContext` — nunca un desarrollador escribe `where: { companyId }` a mano en cada query (elimina la clase de bug "olvidé el filtro").

## 8. Eventos de dominio

- Se publican desde `application/` (al final de un Command Handler exitoso), nunca desde `domain/` directamente (el dominio produce el evento como valor de retorno/registro interno del agregado; quien lo *emite* al bus es la capa de aplicación, tras confirmar persistencia).
- Un módulo que reacciona a un evento de otro lo hace mediante un `Listener` en su propia carpeta `infrastructure/events/`, nunca importando código del módulo emisor más allá del *shape* versionado del evento (que vive en `shared-kernel` o en el `index.ts` público del emisor).

## 9. Validación

- DTOs de entrada usan `class-validator`/`class-transformer` para validación sintáctica (tipos, formatos, longitudes) en el borde HTTP.
- Las reglas de **negocio** (invariantes, no sintaxis) se validan siempre dentro del dominio, nunca solo en el DTO — un DTO válido no implica una operación de negocio válida.

## 10. Testing (resumen; detalle en [10-TESTING.md](10-TESTING.md))

- `domain/`: 100% testeable sin NestJS, sin mocks de infraestructura — tests unitarios puros.
- `application/`: tests con dobles de los puertos (in-memory fakes, no mocks frágiles de framework).
- `infrastructure/`: tests de integración contra Postgres real (Testcontainers), nunca contra Prisma mockeado para lógica de queries no triviales.

## 11. Errores comunes a evitar

| Error común | Por qué es un problema | Corrección |
|---|---|---|
| Importar `PrismaService` en un servicio de dominio | Rompe la independencia del dominio, imposibilita testear sin DB | Definir un puerto (`Repository`) y su implementación en `infrastructure/` |
| Un Controller con lógica de negocio ("if" de reglas) | El Controller se vuelve el único lugar que "sabe" la regla, invisible al dominio | Mover la regla al agregado o servicio de dominio; el Controller solo traduce HTTP ↔ Command |
| Módulo A importando `application/` de módulo B directamente | Acopla dos bounded contexts por la puerta trasera | Exponer un puerto explícito en el `index.ts` de B, o comunicarse por evento |
| Entidades de dominio con decoradores de Prisma/NestJS | El dominio queda contaminado de framework | Mantener modelos de Prisma como *modelos de persistencia* separados, mapeados a entidades de dominio en el repositorio |
| `companyId` tomado del body del request sin validarlo contra el usuario autenticado | Vulnerabilidad de escalación entre tenants | `companyId` siempre desde `RequestContext`, nunca desde payload del cliente |
| Lógica de paginación/filtrado duplicada por módulo | Inconsistencia de API entre recursos | Usar utilidades compartidas de `platform/shared-kernel` para paginación/filtros, ver [08-API-CONTRACTS.md](08-API-CONTRACTS.md) |
| Un evento de dominio sin versión en el nombre/payload | Imposible evolucionar el contrato sin romper consumidores | Todo evento lleva sufijo de versión desde el día uno (`.v1`) |

## 12. Composición del host NestJS

`apps/api` no contiene lógica de negocio: es exclusivamente el punto de composición que importa los `Module` de cada bounded context, configura middlewares globales (auth, tenant context, logging, rate limiting) y arranca la aplicación. Ningún caso de uso ni entidad vive en `apps/api`.
