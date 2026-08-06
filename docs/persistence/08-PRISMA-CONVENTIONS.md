# 08 — Prisma Conventions

Este documento fija los estándares de escritura del `schema.prisma` — no su contenido completo (eso es la fase de implementación), sino las convenciones que hacen que cualquier desarrollador que escriba un modelo nuevo lo haga de forma indistinguible de los demás. Construye sobre la organización física ya fijada en [technical/04-PERSISTENCE.md §1](../technical/04-PERSISTENCE.md) (un archivo `.prisma` por Bounded Context) y sobre las convenciones de nombre ya fijadas en [04-MODELO-DATOS.md §5](../04-MODELO-DATOS.md) (`snake_case` en base de datos).

## 1. Separación por archivos

Un archivo `.prisma` por schema de PostgreSQL ([01-SCHEMAS.md §1](01-SCHEMAS.md)), ya fijado en [technical/04-PERSISTENCE.md §1](../technical/04-PERSISTENCE.md):

```
prisma/schema/
  base.prisma           # datasource + generator, sin modelos
  identity.prisma        # @@schema("identity")
  organization.prisma    # @@schema("organization")
  scheduling.prisma      # @@schema("scheduling")
  rental.prisma          # @@schema("rental")   — incluye Invoice/Charge (§3.1 de 01-SCHEMAS.md)
  commerce.prisma        # @@schema("commerce")
  support.prisma         # @@schema("support")  — incluye outbox_event
```

**Dentro de cada archivo**, los modelos se ordenan siguiendo el mismo orden de dependencia de FK ya fijado en [07-MIGRACIONES.md §1](07-MIGRACIONES.md) — el agregado raíz primero, luego sus entidades internas, luego sus tablas de unión. Un archivo no ordenado alfabéticamente por casualidad, sino por dependencia, se lee de arriba a abajo como el propio agregado se construye.

**Ownership de archivo, no de cliente**: cada archivo lo modifica el equipo dueño del módulo correspondiente (`CODEOWNERS`), pero el `PrismaClient` generado es único para todo `apps/api` — ya fijado en [technical/04-PERSISTENCE.md §1](../technical/04-PERSISTENCE.md), no se repite el mecanismo aquí, solo se hereda.

## 2. Naming de modelos y campos

| Elemento | Convención Prisma (código) | Mapeo a base de datos | Ejemplo |
|---|---|---|---|
| Modelo | `PascalCase`, singular | `@@map("snake_case_plural")` | `model Reservation { ... } @@map("reservations")` |
| Campo escalar | `camelCase` | `@map("snake_case")` | `startDate DateTime @map("start_date")` |
| Campo de relación | `camelCase`, nombre del modelo relacionado o de su rol semántico si hay ambigüedad | Sin `@map` (los campos de relación no son columnas propias, salvo la FK escalar que sí lleva `@map`) | `vehicle Vehicle @relation(fields: [vehicleId], references: [id])`, `vehicleId String @map("vehicle_id")` |
| Enum | `PascalCase` para el tipo, `PascalCase` para cada valor (refleja el VO de dominio tal cual, sin traducir a `SCREAMING_SNAKE_CASE`) | `@@map("snake_case")` en el tipo | `enum ReservationStatus { Draft Confirmed CheckedOut CheckedIn Closed Cancelled } @@map("reservation_status")` |
| Tabla de unión | Nombre compuesto reflejando la relación de negocio, nunca genérico (`UserRole`, no `Junction1`) | `@@map` plural | `model UserRole { ... } @@map("user_roles")` |
| Índice/constraint | `@@index([...], map: "<tabla>_<columnas>_idx")`, `@@unique([...], map: "<tabla>_<columnas>_key")` | Nombre explícito siempre provisto (nunca el autogenerado de Prisma), para que el nombre del constraint en `\d <tabla>` sea legible sin abrir el `schema.prisma` | `@@unique([companyId, email], map: "users_company_id_email_key")` |

**Por qué el valor de un enum Prisma refleja el VO literalmente** (`Draft`, no `DRAFT` ni `draft`): el objetivo es que el nombre que aparece en `schema.prisma` sea el mismo string que ya aparece en [model/04-VALUE_OBJECTS.md](../model/04-VALUE_OBJECTS.md) y en el payload de eventos de dominio ([model/06-DOMAIN_EVENTS.md](../model/06-DOMAIN_EVENTS.md)) — evita una capa de traducción mental entre "cómo se llama en el dominio" y "cómo se llama en el schema".

## 3. Un `@@schema` por archivo, nunca mezclado

Cada modelo lleva su atributo `@@schema("...")` correspondiente al schema de [01-SCHEMAS.md §1](01-SCHEMAS.md); un archivo `.prisma` nunca declara modelos de más de un `@@schema` — aunque técnicamente Prisma lo permitiría, mezclar schemas dentro de un archivo rompería la correspondencia 1:1 entre archivo y ownership de equipo ya fijada en [technical/04-PERSISTENCE.md §1](../technical/04-PERSISTENCE.md).

## 4. Relaciones: cuándo `@relation` y cuándo un escalar sin relación

Regla derivada mecánicamente de [03-RELACIONES.md](03-RELACIONES.md):

| Tipo de relación (según 03-RELACIONES.md) | Declaración en Prisma |
|---|---|
| FK intra-schema (§2 de 03-RELACIONES.md) | `@relation` completa, con ambos lados navegables (`vehicle.reservations Reservation[]` y `reservation.vehicle Vehicle`) — permite `include` tipado en el repositorio |
| Referencia lógica inter-schema (§3 de 03-RELACIONES.md) | **Nunca** `@relation` — un campo escalar simple (`companyId String`, `branchId String`, `fileId String`), sin ninguna relación declarada en Prisma, ni siquiera unidireccional. Prisma no puede expresar "esta columna se parece a una FK pero no lo es" de otra forma que como un escalar plano, lo cual es exactamente la representación correcta |
| Relación "por evento" (§4 de 03-RELACIONES.md) | Ni relación ni escalar de correlación — dos modelos completamente independientes; el campo que en apariencia "correlaciona" (p. ej. `invoices.reservationId`) es, cuando existe como FK real (caso de `invoices`→`reservations`, mismo schema por empaquetado físico), una relación intra-schema normal — la ausencia de relación aplica a los casos genuinamente cross-schema del evento (p. ej. `payments` nunca declara una relación Prisma hacia `Invoice`, ni siquiera como escalar navegable, más allá de guardar el `targetId` opaco) |
| Propietario polimórfico (`identity_documents`, §5 de 03-RELACIONES.md) | Dos relaciones opcionales (`customer Customer? @relation(...)`, `additionalDriver AdditionalDriver? @relation(...)`), cada una con su FK nulable — nunca una única relación polimórfica genérica, porque Prisma no soporta relaciones polimórficas nativas y forzarla con un campo `ownerType` sin `@relation` perdería la integridad referencial real que sí está disponible aquí (a diferencia de `audit_log.subjectType`/`subjectId`, que sí es un escalar puro sin relación, por ser genuinamente genérico) |

## 5. Índices y constraints en el DSL

- Todo índice y constraint de [05-INDICES-Y-CONSTRAINTS.md](05-INDICES-Y-CONSTRAINTS.md) expresable en el DSL de Prisma (`@@index`, `@@unique`, con o sin cláusula parcial vía `@@unique(..., where: ...)` según la versión de Prisma vigente al implementar) se declara directamente en el `schema.prisma` correspondiente.
- Los **exclusion constraints** (`availability_slots`, `rates`) **no** tienen sintaxis en el DSL — se declaran en el modelo únicamente con un comentario explícito señalando su existencia fuera del schema declarativo, y se agregan editando el SQL de migración generado, procedimiento ya fijado en [07-MIGRACIONES.md §3](07-MIGRACIONES.md). El propio campo de rango de fecha usado por el exclusion constraint se marca `Unsupported("daterange")` en el DSL cuando el tipo de columna PostgreSQL (`daterange`/`tstzrange`) no tiene equivalente nativo en Prisma — mecanismo estándar de Prisma para tipos de columna que no puede modelar completamente, coherente con el uso ya aceptado de `$queryRaw` puntual documentado en [ADR-0003](../ADR/0003-postgresql-prisma.md).

## 6. Composite Types — por qué este modelo NO los usa

Prisma ofrece un feature llamado *Composite Types* (`type` embebido dentro de un modelo), pero está soportado **únicamente por el conector de MongoDB**, no por el conector de PostgreSQL vigente en este proyecto ([ADR-0003](../ADR/0003-postgresql-prisma.md)). En consecuencia, **ningún Value Object compuesto de este modelo se declara como Composite Type de Prisma** — no es una elección de estilo, es una restricción del conector relacional.

Todo VO compuesto (`Money`, `DateRange`, `Address`, `ContactInfo`, cada política de `CompanySettings`) se representa como **un grupo de campos escalares planos con un prefijo de nombre compartido**, tal como ya se fijó conceptualmente en [04-COLUMNAS-CONCEPTUALES.md §9](04-COLUMNAS-CONCEPTUALES.md):

```prisma
// Money embebido como par de campos, prefijo "amount"
model Rate {
  amountMinorUnits Int    @map("amount_minor_units")
  amountCurrency   String @map("amount_currency") // ISO-4217, 3 caracteres

  // DateRange embebido como par de campos, prefijo "valid"
  validFrom DateTime  @map("valid_from")
  validTo   DateTime? @map("valid_to")
}
```

La reconstrucción del VO de dominio (`Money.fromPersistence(amountMinorUnits, amountCurrency)`, `DateRange.fromPersistence(validFrom, validTo)`) es responsabilidad exclusiva del `toDomain()` del repositorio ([technical/04-PERSISTENCE.md §2](../technical/04-PERSISTENCE.md)) — el `schema.prisma` nunca expone el VO reconstruido, solo sus componentes primitivos.

## 7. Enums nativos de PostgreSQL vs. `String` + `CHECK`

Se usa **enum nativo de Prisma** (que Prisma traduce a un tipo `ENUM` nativo de PostgreSQL) para toda enumeración cerrada del modelo de dominio (`ReservationStatus`, `VehicleStatus`, `PaymentStatus`, `InvoiceStatus`, `SessionStatus`, `NotificationStatus`, `CustomerType`, `SlotKind`, etc.) — no `String` con `CHECK`. Justificación y alternativa descartada en [10-DECISIONES.md](10-DECISIONES.md) #12.

**Excepción**: catálogos que el propio modelo de dominio ya declara como *conjuntos configurables por Company* en lugar de máquinas de estado cerradas del sistema (`PaymentMethodsEnabled`, `EnabledProductModules`) se representan como un arreglo de `String` (o del enum correspondiente, si el conjunto de valores posibles sigue siendo fijo — que lo es, según [model/04-VALUE_OBJECTS.md §3](../model/04-VALUE_OBJECTS.md): "conjunto cerrado de un catálogo") — la diferencia frente a `ReservationStatus` no es el tipo de columna sino la cardinalidad: aquí son arreglos (`String[]`/`PaymentMethod[]`) de valores simultáneamente vigentes, no un único valor de estado excluyente.

## 8. Módulos que comparten un modelo — regla de `index.ts`, aplicada al repositorio Prisma

Ya fijado en [05-CONVENCIONES-BACKEND.md §1](../05-CONVENCIONES-BACKEND.md): solo lo exportado por el `index.ts` de un módulo es visible fuera de él. Aplicado a Prisma: **ningún módulo importa `PrismaClient` directamente en su capa de dominio o aplicación** — el único punto de acceso es el repositorio de `infrastructure/persistence/prisma/` del propio módulo, inyectado por token de puerto ([05-CONVENCIONES-BACKEND.md §3-4](../05-CONVENCIONES-BACKEND.md)). El `schema.prisma` multi-archivo no relaja esta regla de capas — que dos modelos convivan en el mismo `PrismaClient` generado es un detalle de compilación de Prisma, no una autorización para que un módulo consulte la tabla de otro directamente.

## 9. Qué NO se decide en este documento

- El contenido completo y final del `schema.prisma` de cada Bounded Context → fase de implementación.
- Los nombres exactos de generador/binario de Prisma (`previewFeatures`, versión del cliente) → [technical/09-CODING-STANDARDS.md](../technical/09-CODING-STANDARDS.md).
- El detalle de `toDomain()`/`toPersistence()` de cada repositorio → fase de implementación, siguiendo el contrato ya fijado en [technical/04-PERSISTENCE.md §2](../technical/04-PERSISTENCE.md).
