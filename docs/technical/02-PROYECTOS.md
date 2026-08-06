# 02 — Proyectos del Workspace

Inventario completo de los proyectos Nx del workspace, aplicando la regla y los tags fijados en [01-MONOREPO.md](01-MONOREPO.md) a los Bounded Contexts y agregados ya definidos en [docs/model/](../model/README.md). Cada fila de las tablas de §2-§5 es un proyecto Nx real (un `project.json`).

## 1. Apps

| Proyecto | Ruta | Tags | Descripción |
|---|---|---|---|
| `api` | `apps/api` | `scope:platform`, `type:feature` | Host NestJS; compone todos los módulos de `libs/platform` y `libs/products/rental` (ver [03-BACKEND-ARCHITECTURE.md](03-BACKEND-ARCHITECTURE.md)) |
| `api-e2e` | `apps/api-e2e` | `type:e2e` | Flujos E2E de negocio contra `api` + Testcontainers ([10-TESTING.md §5](../10-TESTING.md)) |
| `web-admin` | `apps/web-admin` | `scope:frontend`, `type:feature` | Next.js, administración |
| `web-admin-e2e` | `apps/web-admin-e2e` | `type:e2e` | Playwright, golden paths de `web-admin` |
| `mobile` | `apps/mobile` | `scope:frontend`, `type:feature` | Expo/React Native |
| `design-system-docs` | `apps/design-system-docs` | `scope:frontend`, `type:e2e`-adjacent (docs, no producción) | Storybook: catálogo vivo de `ui-kit` (ver §4) |

## 2. `libs/platform/` — por Bounded Context

### 2.1 Identity & Access

| Proyecto | Agregado(s) que aloja | Tags |
|---|---|---|
| `platform-identity-domain` | `Session` (autenticación, rotación) | `scope:platform`, `type:domain`, `module:identity` |
| `platform-identity-application` | Casos de uso de login/refresh/logout, `SessionSecurityService` | `scope:platform`, `type:application`, `module:identity` |
| `platform-identity-infrastructure` | `PrismaSessionRepository`, `AuthController`, estrategia Passport JWT | `scope:platform`, `type:infrastructure`, `module:identity` |
| `platform-users-domain` | `User` | `scope:platform`, `type:domain`, `module:users` |
| `platform-users-application` | Casos de uso de alta/deshabilitación de usuario | `scope:platform`, `type:application`, `module:users` |
| `platform-users-infrastructure` | `PrismaUserRepository`, `UsersController` | `scope:platform`, `type:infrastructure`, `module:users` |
| `platform-roles-permissions-domain` | `Role`, catálogo de `Permission` (versionado en código, ver [model/04-VALUE_OBJECTS.md §2](../model/04-VALUE_OBJECTS.md)) | `scope:platform`, `type:domain`, `module:roles-permissions` |
| `platform-roles-permissions-application` | Casos de uso de gestión de roles | `scope:platform`, `type:application`, `module:roles-permissions` |
| `platform-roles-permissions-infrastructure` | `PrismaRoleRepository`, `RolesController` | `scope:platform`, `type:infrastructure`, `module:roles-permissions` |

### 2.2 Organization

| Proyecto | Agregado(s) | Tags |
|---|---|---|
| `platform-companies-domain/application/infrastructure` | `Company` | `module:companies` |
| `platform-branches-domain/application/infrastructure` | `Branch` | `module:branches` |
| `platform-settings-domain/application/infrastructure` | `CompanySettings` (incluye `EnabledProductModules`) | `module:settings` |

### 2.3 Scheduling

| Proyecto | Agregado(s) | Tags |
|---|---|---|
| `platform-calendar-domain/application/infrastructure` | `AvailabilitySlot`; publica `CalendarPort` | `module:calendar` |

### 2.4 Commerce (empaquetado físico, ver [model/01-BOUNDED_CONTEXTS.md §3.5](../model/01-BOUNDED_CONTEXTS.md))

| Proyecto | Agregado(s) | Tags |
|---|---|---|
| `platform-payments-domain/application/infrastructure` | `Payment`, `SecurityDeposit` (ambos son mecanismos genéricos de "retener/cobrar un monto"; se empaquetan en la misma librería física por no justificar módulos separados — ver [10-DECISIONES.md](10-DECISIONES.md) #12) | `module:payments` |

`Invoice` **no** vive aquí — vive en `libs/products/rental/invoices` (§3), porque su contenido es específico de Rental aunque su Bounded Context de reglas (Commerce) sea compartido. Ver la nota de empaquetado ya fijada en el modelo.

### 2.5 Support

| Proyecto | Agregado(s) | Tags |
|---|---|---|
| `platform-files-domain/application/infrastructure` | `File`; publica `StorageProviderPort` | `module:files` |
| `platform-notifications-domain/application/infrastructure` | `Notification`; publica `NotificationSenderPort`, `PushNotificationSenderPort` | `module:notifications` |
| `platform-audit-domain/application/infrastructure` | `AuditLogEntry`; listener transversal (ver [05-EVENTING.md §5](05-EVENTING.md)) | `module:audit` |

### 2.6 Integraciones y kernel compartido

| Proyecto | Contenido | Tags |
|---|---|---|
| `platform-integration-providers-infrastructure` | Adaptadores concretos: WhatsApp, Email/SMS, Push (Expo), Stripe, Mercado Pago, Google Maps, OCR, Firma Digital, MinIO/S3 (ver [11-INTEGRACIONES.md](../11-INTEGRACIONES.md)) | `scope:platform`, `type:infrastructure`, `module:integration-providers` |
| `platform-shared-kernel` | `Money`, `DateRange`, `EntityId<T>`, `Email`, `PhoneNumber` | `scope:shared`, `type:domain`, `module:shared-kernel` |

`platform-integration-providers-infrastructure` no tiene proyectos `domain`/`application` propios — no protege ningún invariante de negocio, solo implementa puertos publicados por los módulos consumidores (`payments`, `notifications`, `files`, etc.), coherente con [ADR-0010](../ADR/0010-provider-pattern-integraciones.md) y con la decisión ya fijada en [model/01-BOUNDED_CONTEXTS.md §6](../model/01-BOUNDED_CONTEXTS.md) de que las integraciones no son un séptimo Bounded Context.

## 3. `libs/products/rental/` — por agregado

| Proyecto | Agregado(s) | Tags |
|---|---|---|
| `rental-customers-domain/application/infrastructure` | `Customer`, `IdentityDocument`, `AdditionalDriver` | `scope:product-rental`, `module:customers` |
| `rental-vehicles-domain/application/infrastructure` | `Vehicle`, `VehicleCategory`, `VehicleDocument`, `MaintenanceRecord` | `scope:product-rental`, `module:vehicles` |
| `rental-reservations-domain/application/infrastructure` | `Reservation`, `Inspection`, `DamageReport`; aloja `AvailabilityService` y `PricingService` (application, ver [model/05-DOMAIN_SERVICES.md](../model/05-DOMAIN_SERVICES.md)) | `scope:product-rental`, `module:reservations` |
| `rental-invoices-domain/application/infrastructure` | `Invoice`, `Charge` | `scope:product-rental`, `module:invoices` |
| `rental-reports-application/infrastructure` | Sin agregados (§3.1 de [01-MONOREPO.md](01-MONOREPO.md)); Query Handlers + proyecciones Prisma de solo lectura | `scope:product-rental`, `module:reports` |

`rental-vehicles-domain` y `rental-customers-domain` son, junto con `rental-reservations-domain`, los únicos proyectos `scope:product-rental` que otro módulo de Rental puede consumir vía sus respectivos `type:application`/`type:infrastructure` públicos (`CustomerLookupPort`, `VehicleStatusPort`, `VehicleCategoryLookupPort` — ver [model/09-DEPENDENCIES.md §2](../model/09-DEPENDENCIES.md)).

## 4. `libs/frontend/` — compartido web + mobile

| Proyecto | Tags | Contenido |
|---|---|---|
| `frontend-domain-types` | `scope:shared`, `type:util` | Tipos/DTOs generados desde el contrato OpenAPI de `08-API-CONTRACTS.md` |
| `frontend-data-access` | `scope:shared`, `type:feature` | Hooks de dominio (React Query) por Bounded Context: `useReservations`, `useVehicleAvailability`, `auth/` (ver [06-CONVENCIONES-FRONTEND.md §5-6](../06-CONVENCIONES-FRONTEND.md)) |
| `frontend-ui-kit-core` | `scope:shared`, `type:ui` | Tokens de diseño + lógica/estado de primitivas, sin renderizado (headless) |
| `frontend-ui-kit-web` | `scope:shared`, `type:ui`, `platform:web` | Renderizado DOM de las primitivas de `ui-kit-core` |
| `frontend-ui-kit-mobile` | `scope:shared`, `type:ui`, `platform:mobile` | Renderizado nativo (React Native) de las mismas primitivas |

`web-admin` depende de `frontend-ui-kit-web`; `mobile` depende de `frontend-ui-kit-mobile`; ambos dependen de `frontend-ui-kit-core`, `frontend-data-access` y `frontend-domain-types` — mapea 1:1 la capa 1-3 del Design System ya fijada en [07-DESIGN-SYSTEM.md §2](../07-DESIGN-SYSTEM.md) a proyectos Nx concretos.

## 5. `packages/` y `tooling/`

Ver [01-MONOREPO.md §6-7](01-MONOREPO.md) — `packages/sdk` y `packages/cli` son ubicaciones reservadas, no proyectos activos en v1.0. `tooling/generators/bounded-context` y `tooling/generators/frontend-feature` son proyectos Nx de tipo `generator`, no librerías de aplicación.

## 6. Matriz resumen de conteo

| Bounded Context | Librerías físicas | Proyectos Nx (domain+application+infra) |
|---|---|---|
| Identity & Access | `identity`, `users`, `roles-permissions` | 9 |
| Organization | `companies`, `branches`, `settings` | 9 |
| Scheduling | `calendar` | 3 |
| Rental Operations | `customers`, `vehicles`, `reservations` | 9 |
| Commerce | `payments` (platform) + `invoices` (product) | 6 |
| Support | `files`, `notifications`, `audit` | 9 |
| Reports (sin dominio) | `reports` | 2 |
| Integraciones (sin dominio) | `integration-providers` | 1 |
| Shared kernel | `shared-kernel` | 1 |

Total: 49 proyectos de librería de negocio + 5 de frontend compartido + 6 apps (incluye E2E y Storybook) + 2 reservados en `packages/` (no construidos) + generadores de `tooling/`. Este número es informativo, no una meta — cambia con cada módulo nuevo sin que este documento deba mantenerse manualmente sincronizado más allá de reflejar el estado vigente en cada revisión.

## 7. Regla de alta de un proyecto nuevo

Ningún proyecto se crea a mano. Se ejecuta el generador `tooling/generators/bounded-context` (para un módulo de negocio) o `frontend-feature` (para una feature de app), que produce la estructura, los tags y el `project.json` ya conformes a [01-MONOREPO.md §4-5](01-MONOREPO.md) — evita que un desarrollador nuevo tenga que memorizar la convención de tags para dar de alta un módulo.
