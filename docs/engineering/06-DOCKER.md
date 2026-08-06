# 06 — Docker

Fija los archivos Docker concretos que implementan [technical/08-DEVOPS.md §1](../technical/08-DEVOPS.md): build multi-stage por app, y Docker Compose de desarrollo local con PostgreSQL, Redis y MinIO. No introduce ninguna pieza de infraestructura no mencionada ahí (sin Kubernetes local, [technical/10-DECISIONES.md #11](../technical/10-DECISIONES.md)).

## 1. Dockerfiles por app

Un `Dockerfile` en la raíz de cada app desplegable (`apps/api/Dockerfile`, `apps/web-admin/Dockerfile`), no uno global parametrizado — cada app tiene requisitos de runtime distintos (Next.js necesita `output: 'standalone'`; NestJS no) y un Dockerfile compartido acumularía condicionales innecesarios.

**Etapas comunes** (ambas apps):

1. **`deps`**: `node:<LTS>-alpine`, copia únicamente `package.json`/`package-lock.json` (+ los `package.json` de proyectos Nx afectados si se usa instalación con caché por capa), `npm ci` — capa cacheada mientras las dependencias no cambien.
2. **`build`**: copia el código fuente completo necesario (Nx permite `nx build <app> --configuration=production` acotado al grafo de dependencias de esa app, no todo el workspace), ejecuta el build aprovechando el cache de Nx (§3 de [01-WORKSPACE.md](01-WORKSPACE.md); en CI, el cache remoto ya resuelto por el job de build previo, §2 de [05-CI-CD.md](05-CI-CD.md), evita recompilar dentro del propio contenedor).
3. **`runtime`**: `node:<LTS>-alpine` mínimo, copia únicamente `dist/apps/<app>` y `node_modules` de producción (`npm ci --omit=dev` en una sub-etapa, o `npm prune --production` sobre el resultado de `deps`), usuario no-root (`USER node`), sin herramientas de build.

`apps/mobile` no tiene Dockerfile — se distribuye vía Expo Application Services (EAS) o los stores, fuera del alcance de contenedores (ya fijado en [technical/08-DEVOPS.md §1](../technical/08-DEVOPS.md)).

## 2. `.dockerignore`

Único en la raíz, aplicado a todo build (el contexto de build es la raíz del monorepo, requerido para que Nx pueda resolver el grafo de dependencias del proyecto que se construye):

```
node_modules
.git
.nx/cache
dist
coverage
**/*.spec.ts
**/*.integration.spec.ts
.env
.env.*
!.env.example
docs/
.vscode/
.devcontainer/
```

## 3. `docker-compose.yml` — servicios base

| Servicio | Imagen | Puerto host | Propósito |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | `5432` | Base de datos única multi-schema ([04-MODELO-DATOS.md §2](../04-MODELO-DATOS.md)) |
| `redis` | `redis:7-alpine` | `6379` | Cache, `ThrottlerGuard` (Redis storage), backing de BullMQ |
| `minio` | `minio/minio` | `9000` (API), `9001` (consola) | `StorageProviderPort` local ([11-INTEGRACIONES.md §11](../11-INTEGRACIONES.md)) |
| `minio-init` | `minio/mc` | — | Job de un solo uso: crea el bucket por defecto y credenciales de acceso al arrancar por primera vez; `depends_on: minio` con condición `service_healthy` |

- **Volúmenes nombrados**: `postgres-data`, `minio-data` — persisten entre `docker compose down`/`up`, se eliminan explícitamente con `docker compose down -v` cuando un desarrollador necesita un estado limpio (documentado en [02-DEVELOPER-EXPERIENCE.md](02-DEVELOPER-EXPERIENCE.md) como comando de "reset total", no en el flujo estándar).
- **Red**: una única red bridge por defecto (`renta-dev`) — todos los servicios se resuelven por nombre de servicio (`postgres`, `redis`, `minio`) desde `apps/api` corriendo en el host o desde su propio contenedor si se decide containerizar también el dev loop (no es el caso por defecto, §5 de [02-DEVELOPER-EXPERIENCE.md](02-DEVELOPER-EXPERIENCE.md): `apps/api` corre nativo en modo watch, no en contenedor, durante desarrollo diario).
- **Healthchecks**: cada servicio expone un healthcheck (`pg_isready`, `redis-cli ping`, `mc ready local`) — `apps/api` en desarrollo no arranca contra una dependencia que aún no respondió, mismo principio que el gate de `/health/ready` en despliegue ([technical/08-DEVOPS.md §6](../technical/08-DEVOPS.md)), aplicado también localmente.

## 4. `docker-compose.override.yml`

Cargado automáticamente por `docker compose up` junto al archivo base (comportamiento nativo de Compose, sin flag adicional) — contiene únicamente ajustes de conveniencia de desarrollo que no deben existir en ningún entorno remoto:

- Puertos publicados al host (el archivo base podría, en un entorno de CI con Testcontainers, no publicar puertos fijos — Testcontainers gestiona sus propios puertos efímeros, [04-TESTING-FOUNDATION.md §2](04-TESTING-FOUNDATION.md)).
- Credenciales de desarrollo fijas y no secretas (usuario/contraseña triviales de Postgres/MinIO local) — nunca las mismas credenciales que cualquier entorno remoto.

## 5. Perfil de observabilidad (opt-in)

`docker-compose.observability.yml`, activado explícitamente con `docker compose -f docker-compose.yml -f docker-compose.observability.yml up` (o un script `npm run dev:observability`) — **no** se levanta por defecto en `docker compose up` (§1 de [technical/08-DEVOPS.md](../technical/08-DEVOPS.md): "activable aparte para no forzar su arranque en el ciclo diario de desarrollo"). Contenido detallado en [08-OBSERVABILITY-BOOTSTRAP.md](08-OBSERVABILITY-BOOTSTRAP.md).

## 6. Paridad con producción

- Misma imagen base (`node:<LTS>-alpine`) en desarrollo (Dev Container, [02-DEVELOPER-EXPERIENCE.md §6](02-DEVELOPER-EXPERIENCE.md)) y en runtime de producción (§1) — evita el clásico "funciona en mi máquina" por divergencia de versión de Node.
- Misma versión mayor de PostgreSQL en Testcontainers (§2 de [04-TESTING-FOUNDATION.md](04-TESTING-FOUNDATION.md)), Docker Compose local (§3) y producción — ninguna característica específica de versión (p. ej. sintaxis de `EXCLUDE USING gist` ya usada en migraciones, [technical/04-PERSISTENCE.md §7](../technical/04-PERSISTENCE.md)) se valida contra una versión distinta a la de producción.
- La imagen construida en CI (§1) es exactamente la que se promueve de staging a producción sin reconstruir — principio de paridad ya fijado en [technical/08-DEVOPS.md §4](../technical/08-DEVOPS.md), este documento garantiza que no exista una segunda definición de imagen "de producción" distinta a la de CI.

## 7. Qué se decide en otro documento

- CI/CD que construye y publica estas imágenes → [05-CI-CD.md](05-CI-CD.md).
- Variables de entorno consumidas por cada servicio → [07-CONFIGURATION.md](07-CONFIGURATION.md).
- Servicios del perfil de observabilidad en detalle → [08-OBSERVABILITY-BOOTSTRAP.md](08-OBSERVABILITY-BOOTSTRAP.md).
- Despliegue, rollback y entornos remotos → [technical/08-DEVOPS.md §4-7](../technical/08-DEVOPS.md) (sin cambios).
