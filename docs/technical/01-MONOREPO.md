# 01 — Monorepo

Este documento desarrolla al nivel de construcción la decisión ya fijada en [ADR-0006](../ADR/0006-monorepo-nx.md): Nx como herramienta de monorepo, con fronteras de módulo impuestas en CI. Aquí se fija la estructura física completa, el sistema de tags y la matriz de dependencias permitidas — lo que un generador de Nx debe producir por defecto y lo que `enforce-module-boundaries` debe rechazar.

## 1. Estructura raíz del workspace

```
apps/           # Desplegables: NestJS host, Next.js, Expo, E2E runners
libs/           # Librerías internas del workspace (no publicables)
packages/       # Artefactos publicables fuera del workspace (reservado, ver §6)
tooling/        # Generadores Nx, executors, scripts de CI/CD, configuración compartida
docs/           # Esta documentación
```

No existe una carpeta `shared/` de primer nivel. Lo que el enunciado de esta fase llama "shared" ya está resuelto en la arquitectura aprobada como `libs/platform/shared-kernel` (Value Objects de dominio universales — `Money`, `DateRange`, `EntityId<T>`, `Email`, `PhoneNumber`, ver [02-ARQUITECTURA.md §8](../02-ARQUITECTURA.md)) y `libs/frontend/domain-types` (tipos derivados del contrato de API). Introducir una carpeta `shared/` adicional duplicaría un concepto ya fijado — ver [10-DECISIONES.md](10-DECISIONES.md) #9.

## 2. `apps/` — Desplegables

```
apps/
  api/                    # Host NestJS — composición de módulos, bootstrap (ver 03-BACKEND-ARCHITECTURE.md)
  api-e2e/                # Tests E2E de la API (Jest + Supertest, contra Testcontainers)
  web-admin/               # Next.js — administración
  web-admin-e2e/           # Tests E2E de UI (Playwright)
  mobile/                  # Expo/React Native
  design-system-docs/      # Storybook — documentación viva del Design System (ver 02-PROYECTOS.md §4)
```

Ningún `app` contiene lógica de negocio ni casos de uso propios — son exclusivamente puntos de composición (regla ya fijada en [05-CONVENCIONES-BACKEND.md §12](../05-CONVENCIONES-BACKEND.md) para `apps/api`, extendida aquí a `web-admin` y `mobile`: sus `app`/`features` importan de `libs/frontend/*`, nunca al revés).

## 3. `libs/` — Librerías internas

Hereda sin modificación el árbol ya fijado en [02-ARQUITECTURA.md §8](../02-ARQUITECTURA.md). Esta fase añade el nivel de detalle que ADR-0006 exige: **cada capa de Clean Architecture de cada módulo es una librería Nx independiente**, no una carpeta dentro de un único proyecto (ver justificación en [10-DECISIONES.md](10-DECISIONES.md) #1). Un módulo de negocio típico se ve así en el grafo de Nx:

```
libs/platform/vehicles-example/
  domain/           → proyecto Nx "platform-vehicles-example-domain"
  application/      → proyecto Nx "platform-vehicles-example-application"
  infrastructure/   → proyecto Nx "platform-vehicles-example-infrastructure"
```

Cada carpeta de capa es su propio `project.json`, con un único punto de entrada (`src/index.ts`) que define su superficie pública — lo no exportado por ese `index.ts` es inalcanzable desde fuera del proyecto, porque Nx resuelve imports contra el `index.ts` declarado (`importPath`), nunca contra rutas de archivo internas. Esto es lo que convierte la regla "solo `index.ts` es público" de [05-CONVENCIONES-BACKEND.md §1](../05-CONVENCIONES-BACKEND.md) en una garantía estructural, no solo de convención.

El inventario completo de librerías (una fila por proyecto Nx) está en [02-PROYECTOS.md](02-PROYECTOS.md); este documento fija la **regla**, no la lista.

### 3.1 Excepción: módulos sin capa `domain`

`reports` (Rental Operations) no tiene agregados ([model/01-BOUNDED_CONTEXTS.md §3.6](../model/01-BOUNDED_CONTEXTS.md)) y por tanto no tiene proyecto `domain` — solo `application` (Query Handlers) e `infrastructure` (proyecciones de lectura vía Prisma). Es la única excepción al trío estándar, documentada explícitamente para que un generador nuevo no la trate como un olvido.

## 4. Sistema de tags

Tres ejes ortogonales, cada uno impuesto por una regla de `enforce-module-boundaries` distinta. Todo proyecto Nx lleva al menos un tag de cada eje que aplique.

| Eje | Tags | Qué regla impone |
|---|---|---|
| **Alcance** (`scope:`) | `scope:platform`, `scope:product-rental`, `scope:frontend`, `scope:shared`, `scope:tooling` | La ley estructural más importante de toda la Plataforma: `platform` nunca depende de `product-rental` ([02-ARQUITECTURA.md §4](../02-ARQUITECTURA.md), INV-P03) |
| **Capa** (`type:`) | `type:domain`, `type:application`, `type:infrastructure`, `type:feature`, `type:ui`, `type:util`, `type:e2e` | La regla de dependencia de Clean Architecture ([02-ARQUITECTURA.md §2](../02-ARQUITECTURA.md)): las flechas de código apuntan siempre hacia adentro |
| **Módulo** (`module:`) | `module:identity`, `module:users`, `module:vehicles`, `module:reservations`, ... (uno por librería física de negocio) | Ownership y agrupación para CODEOWNERS (ver [08-DEVOPS.md §2](08-DEVOPS.md)); no impone dependencia por sí solo, pero **toda** dependencia entre `module:` distintos debe cruzar por un proyecto `type:infrastructure` o `type:application` con `index.ts` público — nunca `type:domain` a `type:domain` de otro `module:` |

Nombre de proyecto Nx: `<scope-corto>-<module>-<type>` (p. ej. `platform-vehicles-domain`, `rental-reservations-application`, `frontend-ui-kit-web`). El nombre es derivable mecánicamente de la ruta, lo que permite que el generador (§5) lo produzca sin intervención manual.

## 5. Matriz de dependencias permitidas

| Desde \ Hacia | `type:domain` (mismo módulo) | `type:domain` (otro módulo) | `type:application` (mismo módulo) | `type:application`/`type:infrastructure` (otro módulo, vía `index.ts`) | `type:infrastructure` (mismo módulo) | `scope:shared` |
|---|---|---|---|---|---|---|
| `type:domain` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ (solo `shared-kernel`) |
| `type:application` | ✅ | ❌ | ✅ | ✅ (solo el puerto/DTO exportado) | ❌ | ✅ |
| `type:infrastructure` | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `type:feature` (frontend) | — | — | — | ✅ (`data-access`) | — | ✅ (`ui-kit`, `domain-types`) |
| `type:ui` (frontend) | — | — | — | ❌ | — | ✅ (tokens únicamente) |

Reglas adicionales, verificadas por `depConstraints` de Nx:

1. `scope:platform` no puede depender de `scope:product-rental` bajo ninguna combinación de `type:` — INV-P03, sin excepción.
2. `scope:product-rental` puede depender de `scope:platform` únicamente a través de proyectos `type:application`/`type:infrastructure` (nunca `type:domain` de `platform` importado por `type:domain` de `product-rental`) — esto es lo que impide, por ejemplo, que el dominio de `Reservation` importe directamente una clase de dominio de `Customer` de otro módulo sin pasar por su puerto público.
3. `scope:frontend` no depende jamás de `scope:platform` ni `scope:product-rental` (el frontend no conoce Prisma ni el backend interno, [06-CONVENCIONES-FRONTEND.md §1](../06-CONVENCIONES-FRONTEND.md)) — su única fuente de datos es la API HTTP, consumida desde `data-access`.
4. `type:ui` no depende de `type:feature` ni de proyectos con datos de dominio de negocio — regla ya fijada en [06-CONVENCIONES-FRONTEND.md §2](../06-CONVENCIONES-FRONTEND.md) ("un botón no sabe de reservas"), aquí impuesta en CI.
5. Ningún proyecto `type:e2e` es importado por ningún otro proyecto (hoja terminal del grafo).

Un import que viole cualquiera de estas reglas rompe `nx lint`/`nx affected --target=lint` en CI — no es negociable en code review, es un fallo de build, coherente con [ADR-0006](../ADR/0006-monorepo-nx.md).

## 6. `packages/` — Artefactos publicables (reservado)

```
packages/
  sdk/      # Cliente TypeScript tipado de la API pública, para integradores externos
  cli/      # Herramienta de línea de comandos para operación/scaffolding
```

Ninguno de los dos se construye en v1.0 — son ubicaciones reservadas, no proyectos activos. `sdk` solo tiene sentido de negocio cuando exista un consumidor externo real de la API (no existe en el roadmap hasta después de v1.0, [01-ROADMAP.md §10](../01-ROADMAP.md)); `cli` solo cuando la operación manual de la Plataforma (migraciones, gestión de tenants) supere lo que scripts de `tooling/` resuelven razonablemente. Crearlos hoy sin consumidor sería la sobreingeniería que [00-VISION.md §3](../00-VISION.md) prohíbe explícitamente — ver [10-DECISIONES.md](10-DECISIONES.md) #9.

Diferencia con `libs/`: todo lo que vive en `packages/` está diseñado para ser versionado y consumido **fuera** de este monorepo (o publicado a un registro privado); todo lo que vive en `libs/` es interno y no se publica nunca.

## 7. `tooling/` — Generadores, executors y scripts

```
tooling/
  generators/
    bounded-context/       # Genera el trío domain/application/infrastructure con tags correctos
    frontend-feature/      # Genera una feature de app con la estructura de 06-CONVENCIONES-FRONTEND.md
  eslint/                  # Configuración compartida de ESLint (boundaries, reglas de naming)
  scripts/
    ci/                    # Scripts invocados por los workflows de GitHub Actions (ver 08-DEVOPS.md)
    db/                    # Wrappers de migración/seed (invocan Prisma Migrate, nunca lo reemplazan)
```

El generador `bounded-context` es la forma estándar (y única recomendada) de crear un módulo nuevo: produce los tres proyectos con `project.json`, tags, `index.ts` vacío y configuración de test ya correctos, para que ningún desarrollador tenga que recordar manualmente la convención de tags de §4 — mismo espíritu que [ADR-0006](../ADR/0006-monorepo-nx.md) ("un nuevo bounded context se crea con un generador que ya aplica la estructura y los tags correctos por defecto").

## 8. Alias de importación

Cada proyecto Nx expone un alias TypeScript (`paths` de `tsconfig.base.json`) con el patrón `@platform/<module>/<type>` o `@rental/<module>/<type>` (p. ej. `@platform/vehicles/domain`, `@rental/reservations/application`, `@frontend/ui-kit`). Ningún import usa rutas relativas que atraviesen la frontera de un proyecto (`../../../other-lib/src/...`) — regla verificada por ESLint (`no-relative-import-across-lib-boundary`), detallada en [09-CODING-STANDARDS.md §2](09-CODING-STANDARDS.md).

## 9. Cache y CI

- Nx Cloud (o cache remoto equivalente) para cache distribuido de `build`/`test`/`lint` entre desarrolladores y CI — sin esto, el costo de que cada capa sea un proyecto separado (§3) se pagaría en tiempo de pipeline sin el beneficio de paralelismo real.
- CI ejecuta `nx affected` (nunca el grafo completo) en cada Pull Request — el detalle de los workflows está en [08-DEVOPS.md §2](08-DEVOPS.md).
- `nx graph` es la herramienta de referencia para medir el impacto de un refactor antes de ejecutarlo, ya mencionado como beneficio en [ADR-0006](../ADR/0006-monorepo-nx.md).

## 10. Qué se decide en otro documento

- La lista completa de proyectos (una fila por librería/app) → [02-PROYECTOS.md](02-PROYECTOS.md).
- Convenciones de nombre de archivo, orden de imports dentro de un archivo → [09-CODING-STANDARDS.md](09-CODING-STANDARDS.md).
- Pipelines concretos de GitHub Actions que invocan `nx affected` → [08-DEVOPS.md](08-DEVOPS.md).
