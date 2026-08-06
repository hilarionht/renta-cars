# 01 — Workspace

Este documento traduce las reglas ya fijadas en [technical/01-MONOREPO.md](../technical/01-MONOREPO.md) y el inventario de [technical/02-PROYECTOS.md](../technical/02-PROYECTOS.md) en un workspace Nx real y arrancable. No redefine tags, matriz de dependencias ni la lista de proyectos — fija cómo se configura Nx para que esas reglas existan en disco y se hagan cumplir en cada `nx affected`.

## 1. Árbol raíz exacto a generar

```
renta/
  apps/
    api/
    api-e2e/
    web-admin/
    web-admin-e2e/
    mobile/
    design-system-docs/
  libs/
    platform/
      shared-kernel/
      identity/{domain,application,infrastructure}/
      users/{domain,application,infrastructure}/
      roles-permissions/{domain,application,infrastructure}/
      companies/{domain,application,infrastructure}/
      branches/{domain,application,infrastructure}/
      settings/{domain,application,infrastructure}/
      calendar/{domain,application,infrastructure}/
      payments/{domain,application,infrastructure}/
      files/{domain,application,infrastructure}/
      notifications/{domain,application,infrastructure}/
      audit/{domain,application,infrastructure}/
      integration-providers/infrastructure/
    products/
      rental/
        customers/{domain,application,infrastructure}/
        vehicles/{domain,application,infrastructure}/
        reservations/{domain,application,infrastructure}/
        invoices/{domain,application,infrastructure}/
        reports/{application,infrastructure}/
    frontend/
      domain-types/
      data-access/
      ui-kit-core/
      ui-kit-web/
      ui-kit-mobile/
  packages/
    sdk/          # reservado, no generado hasta que exista consumidor (technical/01-MONOREPO.md §6)
    cli/           # reservado, ídem
  tooling/
    generators/
      bounded-context/
      frontend-feature/
    eslint/
    scripts/
      ci/
      db/
    testing/       # helpers compartidos de Testcontainers, ver 04-TESTING-FOUNDATION.md
  prisma/
    schema/
    migrations/
  docs/
  .devcontainer/
  .github/
    workflows/
    CODEOWNERS
  nx.json
  tsconfig.base.json
  package.json
  docker-compose.yml
  docker-compose.override.yml
  .env.example
```

`packages/sdk` y `packages/cli` se crean como carpetas vacías con un `README.md` de "reservado" (no como proyectos Nx) — generar un `project.json` para ellos sería construir sin consumidor, lo que [technical/10-DECISIONES.md #9](../technical/10-DECISIONES.md) ya prohíbe explícitamente.

## 2. Plugins Nx a instalar

| Plugin | Cubre |
|---|---|
| `@nx/js` + `@nx/node` | Librerías TypeScript puras (`domain`, `application`, `shared-kernel`) |
| `@nx/nest` | `apps/api` y las librerías `infrastructure` que exponen módulos NestJS |
| `@nx/next` | `apps/web-admin` |
| `@nx/expo` (o `@nx/react-native`, a confirmar en implementación según soporte vigente de Expo SDK) | `apps/mobile` |
| `@nx/react` | Librerías `frontend/ui-kit-web`, `frontend/data-access` |
| `@nx/jest` | Test runner de todo proyecto no-E2E (§ ver [04-TESTING-FOUNDATION.md](04-TESTING-FOUNDATION.md)) |
| `@nx/playwright` | `web-admin-e2e` |
| `@nx/eslint` | Integración de lint por proyecto con la configuración única de `tooling/eslint/` |
| `@nx/storybook` | `design-system-docs` |

Ningún plugin adicional se instala sin que resuelva un problema presente — mismo criterio anti-sobreingeniería de [00-VISION.md §3](../00-VISION.md), aplicado aquí a la elección de plugins.

## 3. `nx.json` — decisiones de configuración

- **Named inputs**: `default` (todo el proyecto), `production` (excluye archivos `*.spec.ts`, `*.integration.spec.ts`, configuración de test) — así `nx affected --target=build` no se dispara por un cambio que solo toca un test.
- **Target defaults**: `build` depende de `^build` (los proyectos de los que depende se construyen primero); `test` y `lint` no dependen de `build` (pueden correr en paralelo apenas el código está presente).
- **Cache**: `build`, `test`, `lint`, `typecheck` son cacheables. Cache remoto (Nx Cloud o backend de cache autoalojado equivalente) obligatorio desde el primer commit de CI — sin él, el costo de que cada capa sea un proyecto Nx independiente ([technical/01-MONOREPO.md §3](../technical/01-MONOREPO.md)) se paga en tiempo de pipeline sin compensación.
- **`release`**: configurado con *independent versioning* por proyecto publicable/desplegable (`api`, `web-admin`), coherente con que se versionan de forma independiente ([technical/08-DEVOPS.md §3](../technical/08-DEVOPS.md)) — detalle de la herramienta exacta en [05-CI-CD.md](05-CI-CD.md).

## 4. `tsconfig.base.json` — alias

Un `path` por proyecto Nx, generado automáticamente por cada ejecución de un generador (§5) — nunca editado a mano salvo para el `shared-kernel` inicial. Patrón fijado en [technical/01-MONOREPO.md §8](../technical/01-MONOREPO.md):

| Prefijo | Alcance |
|---|---|
| `@platform/<module>/<type>` | Librerías de `libs/platform/**` |
| `@rental/<module>/<type>` | Librerías de `libs/products/rental/**` |
| `@frontend/<lib>` | Librerías de `libs/frontend/**` (sin sufijo `<type>`, porque no siguen la triada domain/application/infrastructure) |

`strict: true` en `tsconfig.base.json`, heredado sin excepción por cada `tsconfig.json` de proyecto ([technical/09-CODING-STANDARDS.md §4](../technical/09-CODING-STANDARDS.md)) — ningún generador produce un `tsconfig.json` de proyecto que relaje esta opción.

## 5. Generadores — contrato de entrada/salida

### 5.1 `tooling/generators/bounded-context`

**Entrada** (prompts/flags): nombre del módulo (kebab-case), `scope` (`platform` | `product-rental`), si aplica la excepción "sin `domain`" (§3.1 de [technical/01-MONOREPO.md](../technical/01-MONOREPO.md)).

**Salida**: los tres proyectos Nx (`domain`, `application`, `infrastructure`, o el par sin `domain` si se marcó la excepción), cada uno con:
- `project.json` con tags ya resueltos según la tabla de [technical/01-MONOREPO.md §4](../technical/01-MONOREPO.md) (`scope:*`, `type:*`, `module:<nombre>`).
- `src/index.ts` vacío con el comentario de convención ("exporta explícitamente, nunca `export *`").
- Árbol de carpetas interno conforme a [05-CONVENCIONES-BACKEND.md §1](../05-CONVENCIONES-BACKEND.md) (`entities/`, `value-objects/`, `events/`, `services/`, `ports/` en `domain`; `commands/`, `queries/`, `ports/` en `application`; `persistence/prisma/`, `http/`, `events/`, `providers/` en `infrastructure`).
- Configuración de Jest ya conectada (§ ver [04-TESTING-FOUNDATION.md](04-TESTING-FOUNDATION.md)).
- Entrada en `tsconfig.base.json` con el alias correspondiente (§4).

### 5.2 `tooling/generators/frontend-feature`

**Entrada**: nombre de la feature, app destino (`web-admin` | `mobile`).

**Salida**: estructura de feature conforme a [06-CONVENCIONES-FRONTEND.md](../06-CONVENCIONES-FRONTEND.md), con imports ya apuntando a `frontend-data-access`, `frontend-domain-types` y el `ui-kit` correspondiente a la plataforma (`ui-kit-web` o `ui-kit-mobile`) — nunca a `ui-kit-core` directamente desde una feature.

Ambos generadores son la **única** forma soportada de crear un proyecto nuevo (§7 de [technical/02-PROYECTOS.md](../technical/02-PROYECTOS.md)) — un proyecto creado a mano que "parece correcto" es el error más común en workspaces Nx grandes, porque un tag mal puesto no falla hasta que otro desarrollador intenta un import inválido.

## 6. Boundaries — `depConstraints` derivados de la matriz

`tooling/eslint/` centraliza una única regla `@nx/enforce-module-boundaries` con `depConstraints` que codifica exactamente la matriz de [technical/01-MONOREPO.md §5](../technical/01-MONOREPO.md) (no una nueva regla — la misma, expresada en configuración ejecutable). Cada fila de esa matriz es una entrada `{ sourceTag, onlyDependOnLibsWithTags }`. Añadir un módulo nuevo (§5.1) nunca requiere tocar esta configuración porque los `depConstraints` se expresan sobre tags, no sobre nombres de proyecto.

Regla adicional de higiene, no cubierta por la matriz de dependencias pero exigida por [01-MONOREPO.md §8](../technical/01-MONOREPO.md): `no-relative-import-across-lib-boundary`, que rechaza cualquier `../../../otro-proyecto/src/...` incluso cuando el import sería, por tags, válido — fuerza el uso del alias (§4) en todos los casos.

## 7. Convenciones de alta que no dependen del generador

- Ningún `project.json` se edita para añadir una dependencia de build — Nx la infiere del grafo de imports (`@nx/dependency-checks` valida que `package.json` de cada proyecto publicable liste exactamente lo que usa, aplica hoy solo a `packages/*` cuando existan).
- Nombre de proyecto Nx siempre derivable de la ruta física (`<scope-corto>-<module>-<type>`, [technical/09-CODING-STANDARDS.md §1](../technical/09-CODING-STANDARDS.md)) — el generador lo calcula, nunca se solicita como input libre para evitar divergencia entre ruta y nombre.

## 8. Qué se decide en otro documento

- Bootstrap local, scripts de `package.json`, VS Code, Dev Containers → [02-DEVELOPER-EXPERIENCE.md](02-DEVELOPER-EXPERIENCE.md).
- ESLint/Prettier/Husky/Commitlint → [03-CODE-QUALITY.md](03-CODE-QUALITY.md).
- Pipelines de GitHub Actions que consumen `nx affected` → [05-CI-CD.md](05-CI-CD.md).
