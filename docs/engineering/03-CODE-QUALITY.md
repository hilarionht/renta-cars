# 03 — Code Quality

Fija las herramientas que hacen cumplir, de forma automática y no negociable en code review, las convenciones ya decididas en [technical/09-CODING-STANDARDS.md](../technical/09-CODING-STANDARDS.md), [05-CONVENCIONES-BACKEND.md](../05-CONVENCIONES-BACKEND.md) y [06-CONVENCIONES-FRONTEND.md](../06-CONVENCIONES-FRONTEND.md). Este documento no introduce ninguna regla de estilo nueva — fija el mecanismo (ESLint, Prettier, Commitlint, Husky, lint-staged) que convierte esas reglas en un fallo de build en vez de una opinión de revisor.

## 1. ESLint

- **Configuración única** en `tooling/eslint/`, heredada sin excepción por el `eslint.config.*` (flat config) de cada proyecto — ninguna librería define reglas divergentes, mismo principio ya fijado en [technical/09-CODING-STANDARDS.md §4](../technical/09-CODING-STANDARDS.md).
- Capas de configuración dentro de `tooling/eslint/`:
  1. **Base TypeScript** (`@typescript-eslint`): `no-explicit-any` como error (no warning) — coherente con "prohibido `any`" ya fijado; `no-floating-promises`; `consistent-type-imports`.
  2. **Boundaries** (`@nx/enforce-module-boundaries`): los `depConstraints` derivados de la matriz de [technical/01-MONOREPO.md §5](../technical/01-MONOREPO.md), más `no-relative-import-across-lib-boundary` (§6 de [01-WORKSPACE.md](01-WORKSPACE.md)).
  3. **Import order** (`eslint-plugin-import`): agrupación de tres bloques ya fijada en [technical/09-CODING-STANDARDS.md §2](../technical/09-CODING-STANDARDS.md) (externo → alias de otro proyecto → relativo interno), con línea en blanco obligatoria entre grupos.
  4. **Naming** (`@typescript-eslint/naming-convention`): PascalCase para clases/tipos, camelCase para funciones/variables, `SCREAMING_SNAKE_CASE` para tokens de inyección (`VEHICLE_REPOSITORY`) — instancia ejecutable de la tabla de [technical/09-CODING-STANDARDS.md §1](../technical/09-CODING-STANDARDS.md).
  5. **Regla personalizada**: prohibición de `$queryRawUnsafe`/`$executeRawUnsafe` de Prisma fuera de una lista de excepción explícita y documentada — mecanismo concreto que cierra el riesgo de *Injection* mapeado en [technical/07-SECURITY.md §6](../technical/07-SECURITY.md).
  6. **Overrides por tipo de proyecto**: `type:domain` añade una regla que rechaza imports de `@nestjs/*`, `@prisma/client` y `axios` — la regla de capas de [05-CONVENCIONES-BACKEND.md §3](../05-CONVENCIONES-BACKEND.md) expresada como lint, no solo como code review.
- Un proyecto nuevo generado por `tooling/generators/*` ([01-WORKSPACE.md §5](01-WORKSPACE.md)) ya referencia `tooling/eslint/` por defecto — no hay paso manual de "conectar el lint".

## 2. Prettier

- Configuración única en la raíz (`.prettierrc`), sin overrides por proyecto — mismo criterio de config única que ESLint.
- `.prettierignore` excluye `dist/`, `.nx/cache`, migraciones generadas de Prisma (`prisma/migrations/**/migration.sql` no se reformatea — es SQL generado, no código de autor).
- Prettier corre **solo** como formateador (ancho de línea, comillas, punto y coma); ESLint nunca duplica una regla de formato pura — evita que ambas herramientas compitan en el mismo archivo (`eslint-config-prettier` desactiva las reglas de estilo de ESLint que Prettier ya resuelve).

## 3. Commitlint

- **Conventional Commits** (`feat:`, `fix:`, `refactor:`, `chore:`, `test:`, `docs:`, `ci:`) — no es una preferencia estética: es el insumo directo del versionado semántico automático de [05-CI-CD.md](05-CI-CD.md), ya exigido en [technical/09-CODING-STANDARDS.md §4](../technical/09-CODING-STANDARDS.md).
- `scope` opcional pero recomendado como el nombre corto del módulo tocado (`feat(reservations): ...`) — facilita generar un changelog agrupado sin trabajo manual.
- Un commit que no cumple el formato **no se crea** (hook, §4) — el error aparece en el momento de escribir el mensaje, no en un pipeline de CI diez minutos después.

## 4. Husky

| Hook | Acción |
|---|---|
| `pre-commit` | `lint-staged` (§5) — lint + format únicamente de los archivos en stage, nunca del proyecto completo (rápido, no exige que todo el workspace compile) |
| `commit-msg` | `commitlint` contra el mensaje redactado (§3) |
| `pre-push` | `nx affected --target=lint,typecheck` contra la rama base — red de seguridad barata antes de empujar, no un sustituto de CI (CI sigue siendo la fuente de verdad, ver [05-CI-CD.md](05-CI-CD.md)) |

Ningún hook ejecuta la suite completa de tests de integración (Testcontainers) — sería demasiado lento para el flujo de commit/push local; esa validación completa vive exclusivamente en CI.

## 5. `lint-staged`

Configuración por patrón de archivo:

```
*.{ts,tsx}: eslint --fix, prettier --write
*.{json,md,yml,yaml}: prettier --write
*.prisma: prettier --plugin=prisma-prettier-plugin --write   # si el plugin está disponible; si no, sin reformateo automático (Prisma CLI ya normaliza el schema en `prisma format`, invocado por separado)
```

`eslint --fix` solo corrige violaciones auto-arreglables (orden de imports, comillas) — una violación de boundaries (§1.2) o de `no-explicit-any` nunca se "arregla sola"; falla el commit y exige una corrección deliberada.

## 6. Políticas de calidad (gate, no sugerencia)

- Un Pull Request con hallazgos de ESLint a nivel `error` no es mergeable — mismo nivel de bloqueo que un test roto, aplicado por el pipeline de CI (`nx affected --target=lint`, [05-CI-CD.md §1](05-CI-CD.md)), no por convención de revisor.
- Ninguna regla de `tooling/eslint/` se desactiva con un comentario inline (`// eslint-disable-next-line`) sin una justificación en el propio comentario — un `eslint-disable` sin explicación es, en revisión, motivo de rechazo directo del PR.
- Cambiar una regla de `tooling/eslint/` que afecte a más de un proyecto sigue la misma disciplina de [technical/README.md — Regla de consistencia](../technical/README.md): se documenta la razón (puede vivir como entrada en [05-CI-CD.md](05-CI-CD.md) o en el propio PR que la introduce si es de alcance acotado), nunca una edición silenciosa.

## 7. Qué se decide en otro documento

- Convenciones de nombre, capas, manejo de errores (el contenido que estas herramientas hacen cumplir) → [technical/09-CODING-STANDARDS.md](../technical/09-CODING-STANDARDS.md) (sin cambios).
- Umbrales de cobertura de test como gate de PR → [04-TESTING-FOUNDATION.md](04-TESTING-FOUNDATION.md).
- Pipeline de CI donde estos comandos se ejecutan sobre el conjunto afectado → [05-CI-CD.md](05-CI-CD.md).
