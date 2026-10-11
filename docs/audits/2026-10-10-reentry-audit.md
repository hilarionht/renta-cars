# Fase A — Auditoría de reentrada y recuperación de gobernanza SDD

- **Fecha**: 2026-10-10
- **Repo**: `C:\Developer\renta` (GitHub `hilarionht/renta-cars`)
- **Modo**: solo lectura. Sin cambios de código, configuración, ramas, commits ni PRs.
- **Etiquetas**: `VERIFIED` (comprobado en esta sesión con el comando citado), `REPORTED` (afirmado en docs/CLAUDE.md, no re-verificado), `UNKNOWN` (sin evidencia disponible), `BLOCKED` (no verificable sin una acción o decisión externa).

> **Nota**: este documento es la foto de la auditoría tal como se entregó, antes de cualquier cambio. Las decisiones que tomó el usuario después, y lo que se hizo con ellas, están en la sección "Seguimiento" al final y en `docs/persistence/10-DECISIONES.md #124`. No se reescribe el cuerpo histórico.

---

## 1. Resumen ejecutivo

1. **El trabajo local está preservado en GitHub** (`VERIFIED`). `origin/sync/local-work-2026-09-07` apunta exactamente al HEAD local `e36aaba` (0/0 de divergencia). No hay riesgo inmediato de perder trabajo. `master` local va 238 commits por delante de `origin/master`, en avance rápido (sin divergencia).
2. **El PR #2 no se puede mergear tal como está** (`VERIFIED`). Los checks obligatorios `ci / lint-typecheck` y `ci / test` **fallaron**, y `build`, `docker-validate`, `e2e` y `audit` se saltearon. Además requiere 1 aprobación de CODEOWNERS, y `enforce_admins=true`. La causa del fallo es `UNKNOWN`: los logs del run `34168729602` ya no se pueden descargar.
3. **El PR #1 ya es redundante** (`VERIFIED`): su rama tiene 0 commits que no estén en `master`, así que todo su contenido viaja dentro del PR #2.
4. **Contradicción real con la restricción "sin Docker"** (`VERIFIED`): 18 proyectos `*-infrastructure` y `apps/api-e2e` usan **testcontainers**, que necesita Docker, y no existe modo de base externa. Sin Docker, ni las pruebas de integración ni las e2e se pueden correr localmente. **Se necesita una decisión humana** (ver §9).
5. **La gobernanza de Claude Code es mínima** (`VERIFIED`): solo existe `CLAUDE.md` en la raíz. No hay agentes, skills, reglas ni hooks de Claude Code. **Todo `.claude/` está en `.gitignore`**, así que nada de esa configuración se comparte entre máquinas. El `settings.json` local acumula permisos sueltos, algunos con tokens JWT/refresh de desarrollo incrustados.
6. **Las funcionalidades descritas existen en el código** (`VERIFIED` por inspección). Su funcionamiento de punta a punta sigue **sin verificar**: #121 y #122 nunca tuvieron una prueba completa por HTTP (`REPORTED` en sus propias entradas), y en esta auditoría no se ejecutaron pruebas (ver §4 y §12).
7. **El entorno de esta máquina es justo** (`VERIFIED`): 15,7 GB de RAM y **1,3 GB libres** en el momento de la auditoría (VS Code y Chrome ocupan la mayor parte). Node local es v22.12.0, pero `.nvmrc` pide 20.19.4. No hay PostgreSQL ni Redis nativos instalados; Docker sí lo está.

**Estado global: `PARTIAL`** (detalle en §12).

---

## 2. Estado verificado del repositorio

| Ítem                          | Valor                                                                                                                                                                                                                                                | Estado            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Raíz                          | `C:\Developer\renta`                                                                                                                                                                                                                                 | VERIFIED          |
| Rama / HEAD                   | `master` @ `e36aaba2b0a5c2045ce50828d838560d9cb3c9d8`                                                                                                                                                                                                | VERIFIED          |
| Árbol de trabajo              | limpio (`git status --porcelain` vacío), sin stash                                                                                                                                                                                                   | VERIFIED          |
| Apps                          | `api`, `api-e2e`, `design-system-docs`, `mobile`, `web-admin`, `web-admin-e2e`                                                                                                                                                                       | VERIFIED          |
| Libs (proyectos Nx)           | 55: `libs/platform/*` (12 módulos × domain/application/infrastructure, más `shared-kernel`, `persistence-kernel` e `integration-providers`), `libs/products/rental/*` (customers, invoices, reports, reservations, vehicles) y `libs/frontend/*` (5) | VERIFIED          |
| Prisma                        | schema multiarchivo en `prisma/schema/` (7 archivos), **51 migraciones**                                                                                                                                                                             | VERIFIED          |
| Specs                         | 176 en `libs`, 3 en `apps/api`, 11 en `apps/mobile`, 1 en `apps/web-admin`, 20 `*.e2e-spec.ts` en `apps/api-e2e`                                                                                                                                     | VERIFIED (conteo) |
| Herramientas                  | Node v22.12.0 (`.nvmrc`: 20.19.4, **no coincide**), npm 10.9.0, Nx local v23.1.1 (no hay global)                                                                                                                                                     | VERIFIED          |
| Hooks de git (husky)          | `commit-msg`: commitlint; `pre-commit`: lint-staged (eslint, prettier); `pre-push`: `nx affected --target=lint,typecheck`                                                                                                                            | VERIFIED          |
| CI                            | `pr.yml` (ci reusable, docker-validate, e2e con Playwright), `main.yml`, `nightly-e2e.yml` (cron 06:00), `_reusable-ci.yml` (Node desde `.nvmrc`)                                                                                                    | VERIFIED          |
| Registros de decisiones       | `docs/persistence/10-DECISIONES.md` (#1–#123, log principal de implementación), `docs/technical/10-DECISIONES.md` (1–12), `docs/contracts/10-DECISIONES.md` (#1–#9), `docs/ADR/` (0001–0011)                                                         | VERIFIED          |
| Decisiones posteriores a #123 | ninguna                                                                                                                                                                                                                                              | VERIFIED          |

---

## 3. Git y Pull Requests

| Elemento                                | Hallazgo                                                                                                                                                                                                     | Estado   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `master` vs `origin/master`             | 238 por delante, 0 por detrás. `origin/master` (`6df5504`) es ancestro de `master`, así que no hay divergencia                                                                                               | VERIFIED |
| `origin/sync/local-work-2026-09-07`     | = `e36aaba` = HEAD local. **Incluye el commit de CLAUDE.md**, lo que corrige lo que dije en el resumen anterior de esta sesión                                                                               | VERIFIED |
| PR #2 (sync)                            | OPEN, `mergeable=MERGEABLE`, `mergeStateStatus=BLOCKED`, `REVIEW_REQUIRED`. Checks: lint-typecheck **FAILURE**, test **FAILURE**, build/docker-validate/e2e/audit **SKIPPED** (run del 2026-09-07 23:04 UTC) | VERIFIED |
| Causa del fallo de CI                   | `gh run view --log-failed` no devuelve contenido (logs expirados o no disponibles)                                                                                                                           | UNKNOWN  |
| PR #1 (`docs/bootstrap-sequence-gaps`)  | OPEN, BLOCKED. Su rama tiene 0 commits que no estén en `master`: **contenido ya incluido en el PR #2**                                                                                                       | VERIFIED |
| Rama local `feat/identity-access-fase0` | 0 commits únicos, sin rama remota. Sin riesgo                                                                                                                                                                | VERIFIED |
| Protección de `master`                  | 6 checks obligatorios (`docker-validate`, `e2e`, `audit`, `ci / lint-typecheck`, `ci / test`, `ci / build`), 1 aprobación obligatoria de CODEOWNERS, `enforce_admins=true`, sin force-push ni borrado        | VERIFIED |

**Riesgo de perder trabajo**: bajo. Todo el trabajo local está en una rama remota.

**Riesgo real**: el PR #2 es un diff de 238 commits con CI en rojo. Con `enforce_admins=true` y una aprobación obligatoria de CODEOWNERS, **ni el dueño del repo puede mergearlo sin otra cuenta que apruebe** (UNKNOWN: depende de quién figure en `.github/CODEOWNERS` y de si GitHub permite que el autor apruebe su propio PR; en general no lo permite).

**Recomendación** (la decisión es del usuario):

1. No tocar `master` ni la rama sync hasta saber por qué falló el CI.
2. Reproducir localmente los mismos pasos del CI con Node 20.19.4, escopeado a los proyectos afectados, para encontrar la causa.
3. Corregir en commits nuevos sobre la rama sync. Como esa rama es igual a `master` local, el arreglo se puede hacer en `master` local y pushear a `sync/...`.
4. Resolver la regla de aprobación: un segundo revisor, o cambiar temporalmente la protección. Esto es decisión del dueño.
5. Cerrar el PR #1 como redundante después de mergear el #2.

---

## 4. Estado de las funcionalidades y pruebas

En esta auditoría **no se ejecutaron tests, lint, typecheck ni build** (ver §12). Por eso "existe" significa que se verificó el código por inspección, y "funciona" queda como REPORTED o UNVERIFIED.

| Funcionalidad                                                               | Código existe                                                                                                                                                                 | Evidencia de funcionamiento                                                                                                   |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Módulos de negocio de plataforma (12) y rental (5)                          | VERIFIED (55 libs con domain/application/infrastructure)                                                                                                                      | REPORTED: 20 specs e2e en `apps/api-e2e`, sin correr en esta sesión                                                           |
| Recuperación de contraseña de staff (#113)                                  | VERIFIED (`password-reset.e2e-spec.ts`)                                                                                                                                       | REPORTED                                                                                                                      |
| Búsqueda de vehículos disponibles (#116) y `?expand=vehicleCategory` (#123) | VERIFIED (`vehicles.controller.ts:69-77`)                                                                                                                                     | REPORTED                                                                                                                      |
| Recordatorios con BullMQ (#121)                                             | VERIFIED: `reservation-reminder-scan.processor.ts` (`upsertJobScheduler`, `every`) y `send-reservation-reminder.processor.ts`; migración `20260903134752_platform_admin_role` | REPORTED: tests unitarios e integración (29 tests) en verde. **Prueba completa por HTTP NO hecha** (lo admite la propia #121) |
| Push de Expo (#122)                                                         | VERIFIED: `push-sender.adapter.ts`, `send-push-notification.handler.ts`, `register-device-push-token.ts`, `PATCH /me/push-token`                                              | REPORTED: unit tests en verde. **BLOCKED** de punta a punta: falta `projectId` de EAS                                         |
| Rol `platform_admin` con BYPASSRLS                                          | VERIFIED (migración)                                                                                                                                                          | REPORTED: permisos probados vía psql en #121                                                                                  |
| OCR                                                                         | VERIFIED: `DocumentExtractionPort` y `FakeDocumentExtractionAdapter` (fake, sin toggle)                                                                                       | REPORTED                                                                                                                      |
| Mobile, operador                                                            | VERIFIED: `app/login/index.tsx`, `app/reservations/[id]/check-out.tsx`, `check-in.tsx`                                                                                        | UNVERIFIED: nunca se probó a mano. Jest está roto (#108)                                                                      |
| Mobile, cliente                                                             | VERIFIED: `customer/login-phone.tsx`, `login-otp.tsx`, `index.tsx`, `reservations/new.tsx`, `[id].tsx`, `vehicles/search.tsx`                                                 | UNVERIFIED (ídem)                                                                                                             |
| `apps/web-admin`                                                            | VERIFIED: `page.tsx` (solo `<h1>`) y `(admin)/login/page.tsx`, que **no es un login real**: es una pantalla de bootstrap que hace ping a `/health/ready`                      | VERIFIED: no tiene funcionalidad                                                                                              |
| Gap preexistente de #123                                                    | VERIFIED: `VehiclesController.list()` sigue sin pasar `branchId` ni `status` al handler                                                                                       | VERIFIED: el bug sigue abierto                                                                                                |
| `db:seed`                                                                   | VERIFIED: `tooling/scripts/db/seed.ts` está vacío ("nada que sembrar todavía")                                                                                                | VERIFIED: no hay seed de desarrollo                                                                                           |

---

## 5. Matriz de gobernanza SDD (existente → propuesta)

| Mecanismo                                  | Estado actual                                                                                      | Brecha                                                                                                               | Propuesta                                                                                                                                                                                                                                                                               | Prioridad                                  | Criterio de aceptación                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `CLAUDE.md` raíz                           | Existe y es bueno. Tiene el flujo investigar → plan → aprobación → commits → registrar la decisión | Las fechas de "Estado actual" quedan viejas. No tiene estados de tarea ni formato de evidencia                       | Mantenerlo como punto de entrada y moverle el estado vivo a un índice de estado (ver §9 de artefactos)                                                                                                                                                                                  | Alta                                       | CLAUDE.md apunta al índice de estado y no duplica datos que cambian                               |
| Instrucciones por directorio               | No existen                                                                                         | Las reglas de RLS, migraciones y límites de módulos solo están en docs largos                                        | `apps/mobile/CLAUDE.md` (gotchas de Jest/EAS/Metro) y `prisma/CLAUDE.md` (migraciones inmutables, `platform_admin`). Nada más                                                                                                                                                           | Media                                      | Cada archivo tiene menos de 40 líneas y no contradice CLAUDE.md raíz                              |
| Versionado de `.claude/`                   | **Todo `.claude/` está en `.gitignore`**                                                           | La configuración de agentes, skills y hooks no viaja entre máquinas, que es justamente el problema de esta reentrada | Decisión humana: ignorar solo `.claude/settings.local.json` y versionar `.claude/settings.json`, `agents/`, `skills/` y `hooks/`                                                                                                                                                        | **Alta**                                   | `git ls-files .claude` lista la configuración compartida y settings.local sigue ignorado          |
| Permisos (`settings.json` local)           | Lista `allow` acumulada a mano, con tokens JWT/refresh de dev, IDs de company y PIDs               | Ruido, y secretos de dev en texto plano (no publicados)                                                              | Reemplazarla por una allowlist curada y genérica (lectura de git/gh, `nx` escopeado, `prisma migrate status`) y mover los `deny` a la versión compartida                                                                                                                                | Alta                                       | No hay tokens en ninguna regla y existe una lista `deny` explícita                                |
| Skill `sdd-workflow`                       | No existe                                                                                          | El flujo SDD vive en prosa en CLAUDE.md                                                                              | **Una sola skill** con fases (discovery, decision, spec, design, gate, implement, verify, review, done), plantilla de spec, formato de evidencia y manejo de decisiones. Absorbe `sdd-discovery`, `sdd-specification`, `sdd-implementation`, `sdd-verification` y `decision-management` | Alta                                       | Invocarla produce una spec con estado y una entrada de decisión con el número correcto (#124…)    |
| Skill `local-environment`                  | No existe. Hay un runbook 06 orientado a Docker y RAM                                              | No hay guía de arranque nativo ni de diagnóstico                                                                     | Skill con la secuencia de §7 (arranque, salud, diagnóstico, apagado)                                                                                                                                                                                                                    | Alta (después de la decisión sobre Docker) | Sigue la secuencia y termina con `/health/ready` = 200 o un diagnóstico explícito                 |
| Skill `testing`                            | No existe                                                                                          | Las reglas (e2e de a uno, nunca `--all`, testcontainers, bug de Jest en mobile) están dispersas                      | Skill corta que integre "qué test correr según qué se tocó"                                                                                                                                                                                                                             | Media                                      | Para un cambio dado devuelve los comandos escopeados exactos                                      |
| Skill `nx-architecture`                    | No existe. Los límites ya se hacen cumplir con `tooling/eslint/boundaries.mjs`                     | Ya es determinista vía lint                                                                                          | **No crearla**: basta una regla corta en CLAUDE.md que apunte a `boundaries.mjs`                                                                                                                                                                                                        | Baja                                       | —                                                                                                 |
| Agente `spec-reviewer` (más `sdd-auditor`) | No existe                                                                                          | —                                                                                                                    | **Fusionarlos**: un agente de solo lectura que revisa spec, trazabilidad y que la decisión esté registrada                                                                                                                                                                              | Media                                      | No puede editar archivos y entrega una checklist PASS/FAIL                                        |
| Agente `architecture-reviewer`             | No existe. CLAUDE.md usa el agente `Plan` genérico para validar                                    | Funciona bien hoy (#120–#123 citan correcciones reales que encontró)                                                 | Por ahora, mantener el `Plan` genérico más un prompt estándar. Crear el agente solo si se repite                                                                                                                                                                                        | Baja                                       | —                                                                                                 |
| Agente `security-reviewer`                 | No existe                                                                                          | RLS, BYPASSRLS, auth de customers y multi-tenant son el riesgo principal del sistema                                 | Agente de solo lectura especializado en RLS, permisos y aislamiento entre tenants                                                                                                                                                                                                       | Media                                      | Revisa cualquier migración o guard nuevo antes del gate                                           |
| Agente `test-engineer`                     | No existe                                                                                          | Un agente con permiso para correr tests se superpone con el implementador                                            | **No crearlo**: cubrirlo con la skill `testing`                                                                                                                                                                                                                                         | —                                          | —                                                                                                 |
| Hook PreToolUse (Bash)                     | No existe                                                                                          | Las operaciones peligrosas dependen solo del modelo                                                                  | Bloquear `git push` a `master`, `--force`, `prisma migrate reset`, `nx run-many --all`, `git reset --hard` y `git checkout`/`rebase` sin permiso                                                                                                                                        | **Alta**                                   | Un comando bloqueado devuelve exit 2 con el motivo, y hay pruebas con casos positivos y negativos |
| Hook PreToolUse (Edit/Write)               | No existe                                                                                          | Las migraciones aplicadas y las entradas históricas de decisiones se pueden editar                                   | Bloquear ediciones en `prisma/migrations/*/migration.sql` ya existentes. En `10-DECISIONES.md`, permitir solo agregar al final (detectar si un diff borra líneas)                                                                                                                       | Alta                                       | Editar una migración existente queda bloqueado y crear una nueva no                               |
| Hook Stop                                  | No existe                                                                                          | El modelo puede declarar algo "terminado" sin evidencia                                                              | Recordatorio no bloqueante con la checklist (tests escopeados, smoke test, decisión registrada) **si hubo cambios en el árbol**                                                                                                                                                         | Media                                      | Aparece solo cuando `git status` no está limpio                                                   |
| Hook PostToolUse (validación rápida)       | No existe                                                                                          | —                                                                                                                    | Prettier o eslint del archivo editado. **No** typecheck (con la RAM disponible es demasiado pesado)                                                                                                                                                                                     | Baja                                       | Corre en menos de 5 s por archivo                                                                 |
| Hooks de git (husky)                       | Existen: commitlint, lint-staged y pre-push con lint+typecheck afectados                           | Ninguna                                                                                                              | Mantenerlos. Son la capa determinista real                                                                                                                                                                                                                                              | —                                          | —                                                                                                 |
| Branch protection y CI                     | Existen y son estrictos                                                                            | El CI del PR #2 está en rojo                                                                                         | Ver §3                                                                                                                                                                                                                                                                                  | Alta                                       | —                                                                                                 |

**Principio**: los hooks complementan los permisos, no los reemplazan. Primero van los `deny` en `settings.json` y después los hooks como segunda capa, con mensajes explicativos.

---

## 6. Inventario existente

- **Instrucciones**: solo `CLAUDE.md` (raíz). No hay `AGENTS.md` ni reglas por directorio.
- **`.claude/`**: `settings.json` (solo allowlist), `settings.local.json` (allowlist) y `scheduled_tasks.lock`. **Sin** `agents/`, `skills/`, `rules/` ni hooks. Todo está ignorado por git (`.gitignore:22`).
- **Usuario (`~/.claude`)**: no tiene agentes. Tiene `skills/synced` (externo a este proyecto). La memoria del proyecto está vacía.
- **Git hooks**: husky (commit-msg, pre-commit, pre-push).
- **Plantillas**: `.github/PULL_REQUEST_TEMPLATE.md` y `.github/CODEOWNERS`.
- **Trazabilidad existente** (para reusar, no duplicar): `docs/persistence/09-TRAZABILIDAD.md` y `docs/contracts/09-TRAZABILIDAD.md`.

---

## 7. Entorno local sin Docker

### 7.1 Servicios: qué es obligatorio para arrancar

Según `apps/api/src/config/env.validation.ts`, `health.controller.ts` y los adaptadores:

| Servicio                                                    | ¿Obligatorio para el boot de `apps/api`?                                                                                                                             | Evidencia                                                                                                 | Estado en esta máquina                                                                                                    |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL 16 (docker-compose usa `postgres:16-alpine`)     | **Sí**: `DATABASE_URL`, `APP_DATABASE_URL` y `PLATFORM_ADMIN_DATABASE_URL` son obligatorios, y `/health/ready` hace ping                                             | VERIFIED                                                                                                  | **No instalado** (`psql`/`pg_ctl` ausentes, no hay servicio de Windows)                                                   |
| Roles de Postgres `app_runtime` y `platform_admin`          | Sí: los crean las migraciones (`CREATE ROLE ... IF NOT EXISTS`)                                                                                                      | VERIFIED (migración #121)                                                                                 | —                                                                                                                         |
| Redis 7                                                     | **Sí**: `REDIS_URL` es obligatorio, `/health/ready` lo chequea y BullMQ lo requiere                                                                                  | VERIFIED                                                                                                  | **No instalado.** En Windows nativo: Memurai o Redis en WSL. **UNKNOWN** si BullMQ y throttler funcionan bien con Memurai |
| Almacenamiento S3 (MinIO)                                   | **Variables obligatorias** (`STORAGE_*`). `S3Client` se construye al iniciar, pero no hay chequeo de bucket al arrancar (no se encontró `headBucket`/`createBucket`) | VERIFIED                                                                                                  | Solo hace falta para subir y descargar archivos. MinIO tiene binario nativo para Windows                                  |
| JWT (`JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `JWT_ACTIVE_KID`) | Sí                                                                                                                                                                   | VERIFIED; definidas en `.env` (valores no mostrados). Se generan con `npm run security:generate-jwt-keys` | —                                                                                                                         |
| Pagos                                                       | No: `PAYMENT_GATEWAY_PROVIDER` vale `fake` por defecto y Stripe se construye en diferido                                                                             | VERIFIED                                                                                                  | —                                                                                                                         |
| Notificaciones (WhatsApp, SendGrid, Twilio)                 | No: `NOTIFICATION_SENDER_PROVIDER` vale `fake` por defecto                                                                                                           | VERIFIED                                                                                                  | Las variables no están en `.env` (lo esperado)                                                                            |
| Expo push                                                   | No para el boot. `EXPO_PUSH_ACCESS_TOKEN` es opcional                                                                                                                | VERIFIED                                                                                                  | No está en `.env`                                                                                                         |
| OCR                                                         | No: adaptador fake fijo                                                                                                                                              | VERIFIED                                                                                                  | —                                                                                                                         |
| OTel/observabilidad                                         | No. Hay variables definidas, pero el collector es opcional                                                                                                           | REPORTED                                                                                                  | —                                                                                                                         |
| Mobile (Expo/Metro)                                         | Independiente del boot del API                                                                                                                                       | VERIFIED                                                                                                  | El target Nx `mobile` solo declara `build`. El arranque es `npx expo start --web` (REPORTED)                              |
| web-admin (Next.js)                                         | No (es un stub)                                                                                                                                                      | VERIFIED                                                                                                  | —                                                                                                                         |

**Variables de `.env` (solo nombres)**: definidas: `POSTGRES_*`, `DATABASE_URL`, `APP_DATABASE_URL`, `PLATFORM_ADMIN_DATABASE_URL`, `REDIS_URL`, `STORAGE_*` (salvo `MAX_UPLOAD_BYTES`), `JWT_*` (salvo `REFRESH_TTL`), `MFA_SECRET_ENCRYPTION_KEY` y `OTEL_*`. No definidas, todas opcionales: `NODE_ENV`, `PORT`, `LOG_LEVEL`, los proveedores de pago y notificaciones con sus credenciales, y `EXPO_PUSH_ACCESS_TOKEN`.

### 7.2 Bloqueo: pruebas y Docker

`tooling/testing/testcontainers/{postgres,redis,minio}.ts` levanta contenedores para todos los `*-infrastructure` (18 proyectos) y para `apps/api-e2e` (`global-setup.ts`). **No existe ningún override** del tipo `TEST_DATABASE_URL` externo antes de crear el contenedor. Sin Docker:

- Se pueden correr los unit tests de `domain` y `application`, lint, typecheck y build.
- **No** se pueden correr las pruebas de integración de repositorios Prisma ni las e2e del API.

Opciones (la decisión es humana):

- **(a)** Usar Docker solo para tests y no para runtime.
- **(b)** Construir un modo de "base externa" para testcontainers (una tanda propia, con riesgo de aislamiento entre corridas).
- **(c)** Aceptar que las pruebas de integración solo corran en CI.

### 7.3 Secuencia futura de arranque (diseño, no ejecutada)

1. **Prerrequisitos**: Node 20.19.4 (`.nvmrc`), PostgreSQL 16 y Redis 7 (o un equivalente) como servicios de Windows, y opcionalmente MinIO.
2. **Base**: crear la DB y el usuario de `.env`, y correr `npx prisma migrate deploy`. Verificar los roles `app_runtime` y `platform_admin` con `\du`.
3. **Datos mínimos**: `POST /api/v1/companies` y un admin vía `seedCompanyWithAdmin()` (`apps/api-e2e/src/support/seed-identity.ts`), apuntando a la DB de desarrollo.
4. **API**: `npx nx serve api` (puerto 3000). Salud: `GET /health/live` y `GET /health/ready` (Postgres y Redis).
5. **Workers**: corren dentro del proceso del API (BullMQ registrado en `ReservationsModule`). El scheduler del scan se registra al iniciar.
6. **Mobile**: `cd apps/mobile && npx expo start --web`.
7. **Diagnóstico**: `netstat` en 5432, 6379, 9000 y 3000. Logs de Nest en stdout. RAM libre (runbook 06).
8. **Apagado**: detener Expo, después el API con Ctrl+C (cierre ordenado de BullMQ) y después los servicios de Windows si hace falta.

**Riesgo de RAM**: con 1,3 GB libres al momento de auditar, el boot de webpack del API más Metro probablemente no entre sin cerrar otras aplicaciones (lo mismo que se observó en #121 y #122).

---

## 8. Backlog priorizado

| #      | Ítem                                                     | Estado real                                                          | Dependencias                                   | Riesgo                                            | Prioridad     | Falta                                                                                                                                     | Decisión humana                   |
| ------ | -------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **N1** | CI del PR #2 en rojo (lint-typecheck, test)              | VERIFIED en rojo, causa UNKNOWN                                      | Node 20.19.4 local                             | Alto: bloquea todo merge                          | **P0**        | Reproducción local y fix                                                                                                                  | Sí, para el merge y la aprobación |
| **N2** | Docker vs testcontainers                                 | VERIFIED: contradicción                                              | —                                              | Alto: deja sin verificar las capas de integración | **P0**        | Decisión entre (a), (b) y (c)                                                                                                             | **Sí**                            |
| **N3** | Node local 22.12 vs `.nvmrc` 20.19.4                     | VERIFIED                                                             | —                                              | Medio: diferencias con CI                         | P0            | Instalar 20.19.4 (nvm-windows)                                                                                                            | Sí, porque instala software       |
| 7      | Levantar todo y probar a mano                            | BLOCKED: no hay Postgres ni Redis nativos                            | N2, N3, servicios instalados                   | Medio                                             | P1            | Runbook nativo (§7.3)                                                                                                                     | Sí (instalar servicios)           |
| 1      | Prueba completa por HTTP de Reminder y Push              | REPORTED pendiente (#121, #122)                                      | 7                                              | Medio                                             | P1            | Spec del escenario: reserva `Confirmed` dentro de la ventana, el scan dispara, se crea la `Notification` y una segunda corrida no duplica | No                                |
| **N4** | Gobernanza de Claude Code (§5)                           | VERIFIED ausente                                                     | Decisión de versionar `.claude/`               | Medio                                             | P1            | Hooks, skill sdd-workflow y deny-list                                                                                                     | Sí (versionado)                   |
| 3      | Jest en mobile                                           | REPORTED (#108), no re-verificado                                    | —                                              | Bajo                                              | P2            | Diagnóstico de la resolución de `react-native`                                                                                            | No                                |
| **N5** | `VehiclesController.list()` ignora `branchId` y `status` | VERIFIED                                                             | —                                              | Bajo, pero los filtros mienten silenciosamente    | P2            | Spec chica y test e2e                                                                                                                     | No                                |
| **N6** | `db:seed` vacío                                          | VERIFIED                                                             | —                                              | Bajo: complica el ítem 7                          | P2            | Seed de desarrollo con una company y un admin                                                                                             | No (técnico)                      |
| 6      | `projectId` de EAS                                       | VERIFIED ausente (`app.json` sin `eas.projectId`; existe `eas.json`) | Cuenta EAS                                     | Bajo                                              | P2            | —                                                                                                                                         | **Sí** (cuenta externa)           |
| 5      | Push en Confirmation y Receipt                           | REPORTED, fuera de alcance (#122)                                    | 6 y 1                                          | Bajo                                              | P3            | Spec                                                                                                                                      | Sí (alcance)                      |
| 4      | Escalamiento humano (#94)                                | REPORTED sin diseñar                                                 | Definición de negocio del "Agente de Reservas" | Medio (regla de negocio sin cumplir)              | P3            | Diseño de dominio                                                                                                                         | **Sí**                            |
| 2      | OCR real                                                 | VERIFIED fake                                                        | Proveedor y credenciales                       | Bajo                                              | P3            | Spec del adaptador                                                                                                                        | **Sí** (Textract o Vision)        |
| **N7** | `apps/web-admin` sin funcionalidad                       | VERIFIED                                                             | Alcance de producto                            | —                                                 | Sin prioridad | —                                                                                                                                         | Sí (si se construye o no)         |

---

## 9. Decisiones pendientes que requieren intervención humana

1. **D-1**: cómo correr las pruebas de integración y e2e sin Docker: (a) Docker solo para tests, (b) modo de DB externa o (c) solo en CI.
2. **D-2**: cómo destrabar el PR #2: quién aprueba como CODEOWNER y si se ajusta temporalmente la protección.
3. **D-3**: si se versiona `.claude/` (settings compartido, agentes, skills, hooks).
4. **D-4**: si se autoriza instalar Node 20.19.4, PostgreSQL 16 y Redis 7 nativos (y cuál Redis: Memurai, WSL u otro).
5. **D-5**: cuenta EAS y `projectId`.
6. **D-6**: proveedor de OCR.
7. **D-7**: alcance de push (Confirmation y Receipt) y diseño del escalamiento humano.
8. **D-8**: ubicación del informe de auditoría y de los artefactos SDD (ver §10).

---

## 10. Artefactos SDD propuestos (mínimos y reusando lo existente)

| Artefacto                                  | Propuesta                                                                                                                                                                    | Por qué no duplica                                                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Índice de estado                           | `docs/status/README.md`: estado vivo por iniciativa con `DISCOVERY` / `WAITING FOR DECISION` / `SPECIFICATION` / `READY` / `IMPLEMENTING` / `VERIFYING` / `DONE` / `BLOCKED` | Hoy el estado vive en CLAUDE.md y se desactualiza. CLAUDE.md pasaría a enlazarlo                                                                         |
| Backlog priorizado                         | Una sección del mismo índice, no un archivo aparte                                                                                                                           | —                                                                                                                                                        |
| Decisiones                                 | **Seguir** con `docs/persistence/10-DECISIONES.md` (#124 en adelante), solo agregando al final. Las preguntas abiertas van al índice de estado como `WAITING FOR DECISION`   | No crear un cuarto log de decisiones                                                                                                                     |
| Trazabilidad REQ → SPEC → DEV → TEST → VAL | Extender el patrón de `docs/persistence/09-TRAZABILIDAD.md` con una columna por iniciativa nueva, en lugar de crear una matriz global retroactiva                            | Reusa lo existente. No se reconstruye la historia de #1–#123                                                                                             |
| Plantilla de spec                          | `docs/specs/_TEMPLATE.md` y una spec por iniciativa (`docs/specs/NNN-<slug>.md`)                                                                                             | No existe nada equivalente                                                                                                                               |
| Formato de evidencia                       | Sección fija dentro de cada spec: comando exacto, exit code, resumen de salida y fecha                                                                                       | —                                                                                                                                                        |
| Informe de auditoría                       | Propuesta: `docs/audits/2026-10-10-reentry-audit.md`                                                                                                                         | Carpeta nueva. **Requiere autorización (D-8)**, porque `docs/README.md` indexa las carpetas de `docs/` (aunque `runbooks/` ya existe sin estar indexada) |

### Flujo SDD obligatorio (adaptado a CLAUDE.md, sin contradecirlo)

1. **Discovery**: investigación de solo lectura; la evidencia va a la spec.
2. **Decision**: preguntas abiertas vía `AskUserQuestion` con 2-4 opciones (convención vigente). Si queda bloqueado, la iniciativa pasa a `WAITING FOR DECISION`.
3. **Specification**: alcance, requisitos, criterios de aceptación y casos negativos.
4. **Technical Design**: archivos, proyectos Nx, migraciones y riesgos. Para cambios sensibles (RLS, auth, migraciones), validación con un agente `Plan` o `security-reviewer`.
5. **Approval Gate**: `EnterPlanMode` → `ExitPlanMode` y aprobación explícita (convención vigente).
6. **Implementation**: commits en capas en una rama. Nunca en `master`.
7. **Verification**: lint, typecheck y test escopeados (`-p`), un smoke test real si toca wiring o HTTP, y las e2e de a una. Se registra la evidencia.
8. **Review**: arquitectura, seguridad y documentación.
9. **Completion**: entrada nueva en `10-DECISIONES.md`, estado `DONE` en el índice y PR. El merge lo decide el usuario.

---

## 11. Plan de continuación por iteraciones

- **Iteración 1 (recomendada): "CI en verde y entorno reproducible".** No toca funcionalidades.
  1. Con la autorización D-4 (solo Node): instalar Node 20.19.4 y reproducir `nx affected --target=lint,typecheck` y `--target=test --base=origin/master` **en tandas escopeadas** (no todo junto, por la RAM), para identificar la causa del fallo del PR #2.
  2. Escribir la spec del fix y corregirlo en commits sobre `sync/local-work-2026-09-07`. Esperar el CI.
  3. Registrar la decisión #124.

  **Criterios de aceptación**: la causa del fallo queda documentada con el comando y la salida; los checks `ci / lint-typecheck` y `ci / test` del PR #2 quedan en verde; `build`, `docker-validate`, `e2e` y `audit` se ejecutan (ya no se saltean); no se pierden commits; queda la entrada #124 registrada.

- **Iteración 2: gobernanza mínima** (con D-3 decidida): `settings.json` compartido con deny-list, hooks PreToolUse (Bash y migraciones), skill `sdd-workflow`, índice de estado y plantilla de spec.
- **Iteración 3: entorno nativo** (con D-1 y D-4 decididas): instalar Postgres y Redis, escribir el runbook nativo, un seed de desarrollo (N6) y `/health/ready` en verde.
- **Iteración 4**: prueba completa por HTTP de Reminder (ítem 1) y validación manual (ítem 7).
- **Iteración 5**: N5 (filtros de vehicles) y Jest de mobile (ítem 3).
- Después, según las decisiones de negocio: EAS, push ampliado, escalamiento, OCR y web-admin.

---

## 12. Acciones que NO realicé

- No ejecuté tests, lint, typecheck ni build. Motivos: la RAM libre era de 1,3 GB y la versión de Node no coincide con CI, así que un resultado local con Node 22 no sería evidencia válida.
- No levanté ningún proceso, servicio ni contenedor. No instalé nada ni actualicé dependencias.
- No hice checkout, reset, rebase, merge, cherry-pick, commit ni push. No modifiqué PRs.
- No modifiqué ningún archivo del repo. Este informe se escribió **fuera del repo** (scratchpad de la sesión) a la espera de D-8.
- No mostré valores de `.env` ni los tokens presentes en `.claude/settings.json`.
- No re-ejecuté el CI del PR #2.

### Comandos ejecutados (todos de lectura)

`git fetch origin`, `git status -sb`, `git rev-list --left-right --count`, `git merge-base`, `git branch -a`, `git ls-remote --heads origin`, `git ls-files`, `git check-ignore -v`, `gh pr list`, `gh pr view 1|2 --json …`, `gh api repos/{owner}/{repo}/branches/master/protection`, `gh run view 34168729602 --json jobs` / `--log-failed` (sin contenido), `node -v`, `npm -v`, `npx --no-install nx --version`, `Get-Service`, `netstat -ano`, `Get-CimInstance` (RAM y disco), `Get-Process`, y además `find`, `grep`, `sed` y `cat` sobre archivos del repo.

---

## Cierre

- **Estado global**: **`PARTIAL`**.
- **Evidencia**: el inventario del repo, Git, PRs, gobernanza y requisitos de entorno está completo y VERIFIED. El funcionamiento del sistema queda en REPORTED o UNVERIFIED, porque no se corrieron validaciones (§12). La causa del CI en rojo es UNKNOWN.
- **Bloqueos concretos**:
  1. CI del PR #2 en rojo, con causa desconocida.
  2. Testcontainers depende de Docker, en contradicción con la restricción "sin Docker" (D-1).
  3. Postgres y Redis no están instalados y no hay autorización para instalarlos (D-4).
  4. RAM libre baja.
  5. Node no coincide con `.nvmrc`.
- **Próxima iteración propuesta**: la Iteración 1 de §11, "CI en verde y entorno reproducible".
- **Archivos nuevos o modificados en el repo**: ninguno. El informe está en el scratchpad de la sesión, con ruta propuesta `docs/audits/2026-10-10-reentry-audit.md`, pendiente de autorización.
- **Confirmación**: no hubo cambios de código, infraestructura, ramas, commits ni PRs.

---

## Seguimiento (posterior a la entrega, mismo día)

Decisiones del usuario sobre las preguntas de §9:

| Pregunta                  | Decisión                                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1 Pruebas sin Docker    | **(c)**: integración y e2e solo en CI                                                                                                           |
| D-4 Instalaciones         | Autorizadas: Node 20.19.4, PostgreSQL 16 y Redis 7. Se usó Memurai porque WSL no tiene red en esta máquina                                      |
| D-8 Ubicación del informe | Autorizada de forma implícita ("todo debe estar documentado... si tomo la rama en otra, igual debe continuar"): este archivo, en `docs/audits/` |
| D-2, D-3, D-5, D-6, D-7   | Sin decidir todavía                                                                                                                             |

Qué se hizo con eso, en detalle: [`docs/persistence/10-DECISIONES.md #124`](../persistence/10-DECISIONES.md). En resumen: la causa del CI en rojo ya no es UNKNOWN (2 bugs reales, corregidos); el entorno nativo funciona (`/health/ready` 200); y apareció un bug real que impedía enviar cualquier recordatorio (#121), corregido y verificado en vivo.

**Corrección a §3**: la rama `sync/local-work-2026-09-07` **sí** incluía el commit de `CLAUDE.md`. Lo que se dijo antes de la auditoría en la conversación era incorrecto; la tabla de §3 ya lo reflejaba bien.
