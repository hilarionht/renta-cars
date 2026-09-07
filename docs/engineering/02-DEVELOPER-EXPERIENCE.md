# 02 — Developer Experience

Fija lo que ocurre entre `git clone` y el primer request exitoso contra `apps/api`, y cómo se depura, formatea y recarga el código día a día. El objetivo medible: un desarrollador nuevo, siguiendo únicamente este documento, llega a un entorno funcional sin pedir ayuda a otro humano ni tomar una decisión de configuración propia.

## 1. Bootstrap (clon → entorno funcional)

Secuencia fija, cada paso depende solo del anterior:

1. `git clone` + Node.js en la versión LTS fijada por `.nvmrc`/`engines` de `package.json` (una única versión para todo el workspace, ver [01-WORKSPACE.md §2](01-WORKSPACE.md)).
2. `npm install` en la raíz (un único lockfile para todo el monorepo — ningún proyecto tiene su propio `package.json` con dependencias de producción propias salvo lo estrictamente necesario para `packages/*` cuando existan).
3. `npm run db:generate` — genera el cliente de Prisma (`node_modules/.prisma/client`). `npm install` no lo hace por sí solo (sin `postinstall` — ver [06-DOCKER.md §1](06-DOCKER.md), un `postinstall` automático rompería la etapa `deps` del `Dockerfile` de `apps/api`, que corre `npm ci` antes de copiar el schema de Prisma); sin este paso, `apps/api` compila pero falla en runtime con `Cannot find module '.prisma/client/default'`.
4. `cp .env.example .env` — valores de desarrollo ya funcionales para todo lo que no sea secreto real (credenciales de sandbox de proveedores quedan vacías, ver [07-CONFIGURATION.md](07-CONFIGURATION.md)).
5. `npm run security:generate-jwt-keys` — genera un par de claves RS256 de desarrollo e imprime las variables `JWT_*` por stdout; pegarlas en `.env` (el script nunca escribe el archivo directamente, para no pisar otras variables ya configuradas, ver [technical/07-SECURITY.md §1](../technical/07-SECURITY.md)). `.env.example` las deja vacías a propósito — sin este paso, `apps/api` falla fail-fast al arrancar con "Configuración inválida" (`ConfigModule`, ver [07-CONFIGURATION.md §4](07-CONFIGURATION.md)).
6. `docker compose up -d` — levanta PostgreSQL, Redis, MinIO (§ ver [06-DOCKER.md](06-DOCKER.md)); observabilidad local queda fuera por defecto (perfil aparte, [08-OBSERVABILITY-BOOTSTRAP.md](08-OBSERVABILITY-BOOTSTRAP.md)).
7. `npm run db:migrate` — aplica el historial de Prisma Migrate contra la base local (wrapper de `tooling/scripts/db/`, nunca `prisma migrate` invocado directamente, para que el script pueda fijar `DATABASE_URL` desde `ConfigModule`/`.env` de forma uniforme).
8. `npm run db:seed` — datos sintéticos mínimos: una Company, una Branch, un usuario admin con rol completo — suficiente para iniciar sesión sin tocar la base de datos a mano.
9. `npm run dev` — levanta `apps/api` en modo watch; `npm run dev:web` / `npm run dev:mobile` para los frontends, cada uno en su propia terminal (no se orquestan desde un único proceso, para que el log de cada uno sea legible por separado).

Ningún paso adicional (no hay decisión de puerto, de base de datos, ni de proveedor a elegir) — todo eso ya viene resuelto en `.env.example` y `docker-compose.yml`.

## 2. Scripts de `package.json` (raíz)

| Script                       | Comando subyacente                                                | Propósito                                                                           |
| ---------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `dev`                        | `nx serve api`                                                    | API en modo watch                                                                   |
| `dev:web`                    | `nx dev web-admin`                                                | Next.js en modo dev                                                                 |
| `dev:mobile`                 | `nx start mobile`                                                 | Metro bundler de Expo                                                               |
| `build`                      | `nx run-many --target=build`                                      | Build completo (uso puntual; CI usa `affected`)                                     |
| `test`                       | `nx affected --target=test`                                       | Igual criterio que CI local                                                         |
| `test:integration`           | `nx affected --target=test --configuration=integration`           | Fuerza Testcontainers local                                                         |
| `lint`                       | `nx affected --target=lint`                                       |                                                                                     |
| `typecheck`                  | `nx affected --target=typecheck`                                  |                                                                                     |
| `e2e`                        | `nx affected --target=e2e`                                        |                                                                                     |
| `db:generate`                | `prisma generate`                                                 | Regenera `node_modules/.prisma/client` - necesario tras cada `npm install` (§1)     |
| `db:migrate`                 | wrapper de `tooling/scripts/db/migrate.ts` → `prisma migrate dev` | Nunca Prisma directo (§1)                                                           |
| `db:seed`                    | wrapper de `tooling/scripts/db/seed.ts`                           |                                                                                     |
| `db:studio`                  | `prisma studio`                                                   | Inspección visual, solo local                                                       |
| `security:generate-jwt-keys` | `tooling/scripts/security/generate-jwt-keys.ts`                   | Par de claves RS256 de desarrollo, imprime por stdout para pegar en `.env` (§1)     |
| `generate:module`            | `nx g @tooling/generators:bounded-context`                        | Alias corto del generador de [01-WORKSPACE.md §5.1](01-WORKSPACE.md)                |
| `generate:feature`           | `nx g @tooling/generators:frontend-feature`                       | Alias del generador de [01-WORKSPACE.md §5.2](01-WORKSPACE.md)                      |
| `graph`                      | `nx graph`                                                        | Visualización del grafo de dependencias, referencia de impacto antes de un refactor |

Ningún desarrollador invoca `nx` con flags largos de memoria — todo flujo frecuente tiene su alias en esta tabla; `nx` directo queda para casos puntuales no cubiertos aquí.

## 3. CLI

No se construye una CLI propia en v1.0 (`packages/cli` reservado, [01-WORKSPACE.md §1](01-WORKSPACE.md)) — la "CLI" del día a día **es** Nx (`nx <target> <project>`) más los scripts de §2. Reevaluar solo cuando la operación manual de la Plataforma supere lo que estos scripts resuelven razonablemente, mismo criterio ya fijado en [technical/01-MONOREPO.md §6](../technical/01-MONOREPO.md).

## 4. Variables de entorno (referencia)

El catálogo completo, su jerarquía y validación viven en [07-CONFIGURATION.md](07-CONFIGURATION.md). Este documento solo fija que `.env.example` es la única fuente de verdad de "qué variables existen" en desarrollo — un desarrollador nunca descubre una variable requerida por prueba y error, porque `ConfigModule` falla rápido al arrancar (`03-BACKEND-ARCHITECTURE.md §3`) y `.env.example` la lista con un comentario de propósito.

## 5. VS Code

Carpeta `.vscode/` versionada (no `.gitignore`d) con:

- `extensions.json` (recomendaciones): ESLint, Prettier, Prisma, Nx Console, Docker, Playwright Test for VSCode.
- `settings.json`: format-on-save con Prettier como formateador por defecto, ESLint en modo `flat config` apuntando a `tooling/eslint/`, exclusión de `dist/`/`.nx/cache` del explorador y de la búsqueda.
- Nx Console (extensión) es la forma recomendada, no obligatoria, de ejecutar generadores desde la UI en vez de memorizar el comando — mismo generador de [01-WORKSPACE.md §5](01-WORKSPACE.md) por debajo.

## 6. Dev Containers

`.devcontainer/devcontainer.json` — entorno reproducible para quien no quiera instalar Node/Docker localmente en la versión exacta esperada (o para codificar en la nube):

- Imagen base con la misma versión de Node fijada en §1.
- `postCreateCommand` ejecuta exactamente los pasos 2, 3, 4, 5 y 7 de §1 (instala dependencias, genera el cliente de Prisma, copia `.env.example`, genera y agrega las claves JWT, migra) — nunca una secuencia distinta a la documentada para bootstrap local, para que ambos caminos (local nativo y Dev Container) sean el mismo flujo. El paso 5 se agrega al `.env` automáticamente ahí (`>> .env`) porque no hay una persona presente para pegarlo a mano, a diferencia del flujo local de §1.
- Docker-outside-of-Docker (o Docker-in-Docker) habilitado para que `docker compose up` (paso 6) funcione dentro del contenedor de desarrollo.
- Puertos reenviados: API, `web-admin`, Postgres, Redis, MinIO console (mismos puertos que §7 de [06-DOCKER.md](06-DOCKER.md)).

No reemplaza el entorno local nativo — es una alternativa válida, no la única soportada.

## 7. Debug

- **`apps/api`**: configuración de VS Code `launch.json` tipo `node` adjunta al proceso de `nx serve api --inspect`, con _source maps_ de TypeScript ya resueltos por el executor de `@nx/nest`. Breakpoints funcionan directamente en `domain/`/`application/` sin paso de compilación manual.
- **Tests**: configuración de `launch.json` dedicada para correr un único archivo `.spec.ts` bajo el debugger (`--runInBand` de Jest vía el executor de `@nx/jest`), para poder poner un breakpoint dentro de un test de dominio sin levantar infraestructura.
- **`apps/web-admin`**: debugging de servidor (Next.js) vía el mismo mecanismo `node --inspect`; debugging de cliente vía las DevTools del navegador (React DevTools recomendado en `extensions.json` de §5 no aplica a VS Code, se documenta aquí como recomendación de navegador).
- **`apps/mobile`**: React Native Debugger / Flipper (o el sucesor vigente en el SDK de Expo elegido en implementación) — fuera del ecosistema de VS Code `launch.json`, documentado como excepción explícita, no un olvido.

## 8. Hot reload

| App                   | Mecanismo                                                                                                                                                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`            | `@nx/nest` executor con `webpack`/`swc` en modo watch — recompilación incremental, reinicio automático del proceso Nest al detectar cambio                                                                                                                                                                     |
| `apps/web-admin`      | Fast Refresh nativo de Next.js                                                                                                                                                                                                                                                                                 |
| `apps/mobile`         | Fast Refresh de Metro (Expo)                                                                                                                                                                                                                                                                                   |
| Librerías (`libs/**`) | No se compilan a `dist/` para consumo local — Nx resuelve el alias TypeScript (§4 de [01-WORKSPACE.md](01-WORKSPACE.md)) directamente contra el código fuente en modo desarrollo, así que un cambio en `libs/platform/vehicles/domain` dispara el watcher del proyecto consumidor sin paso de build intermedio |

## 9. Qué se decide en otro documento

- Variables de entorno, su validación y jerarquía → [07-CONFIGURATION.md](07-CONFIGURATION.md).
- Servicios de Docker Compose y sus puertos exactos → [06-DOCKER.md](06-DOCKER.md).
- ESLint/Prettier/hooks de Git → [03-CODE-QUALITY.md](03-CODE-QUALITY.md).
