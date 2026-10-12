# Guía de continuación — plataforma de alquiler de vehículos

Este archivo es el punto de entrada para retomar el desarrollo en una sesión nueva (otra máquina, posiblemente otra cuenta de Claude). Si estás leyendo esto por primera vez en este repo: **empezá por acá antes de tocar código.**

## Qué es este proyecto

Monorepo Nx (NestJS + Prisma/Postgres + Next.js + React Native/Expo) para una plataforma empresarial modular, cuyo primer producto es alquiler de vehículos. La documentación completa de arquitectura vive en `docs/` — empezá por [`docs/00-VISION.md`](docs/00-VISION.md) y [`docs/01-ROADMAP.md`](docs/01-ROADMAP.md) si necesitás contexto de negocio/arquitectura general.

**El documento más importante para continuar es [`docs/persistence/10-DECISIONES.md`](docs/persistence/10-DECISIONES.md)** — el log cronológico de cada decisión de diseño tomada durante el desarrollo, numerado (`#1` a `#132` al momento de escribir esto), con el razonamiento de cada una y los gaps aceptados explícitamente. Leé al menos las últimas 10-15 entradas antes de proponer cualquier cambio nuevo — evita repetir investigación ya hecha o pisar una decisión ya tomada a propósito.

## Última sesión (2026-10-10 a 2026-10-12) — leer primero

- Se hizo una **auditoría de reentrada**: [`docs/audits/2026-10-10-reentry-audit.md`](docs/audits/2026-10-10-reentry-audit.md). Tiene el estado verificado, la matriz de gobernanza SDD propuesta y el backlog priorizado.
- Lo que se decidió y se hizo después está en **`docs/persistence/10-DECISIONES.md #124`**:
  - pruebas de integración y e2e **solo en CI**;
  - entorno local **sin Docker** (Node 20.19.4, PostgreSQL 16, Memurai);
  - 2 bugs reales de CI corregidos;
  - bug que impedía enviar **cualquier** recordatorio (#121), corregido y verificado en vivo.
- Después, #125 a #129 dejaron el CI del PR #2 en verde (6/6): MinIO por Chainguard, causa raíz de mobile (#108), `api-e2e` autocontenido y en serie, audit gate con Nx 23.3.0 alineado y fechas relativas en los e2e.
- **El PR #2 se mergeó el 2026-10-12** (`7fe8315`, aprobado y mergeado por el colaborador `gameoverplay26-stack`). `master` ya tiene todo. Para seguir en otra máquina: `git fetch origin && git checkout master && git pull`, y después seguir [`docs/engineering/11-ENTORNO-LOCAL-NATIVO.md`](docs/engineering/11-ENTORNO-LOCAL-NATIVO.md). Agregá la máquina nueva a su §8 (bitácora por máquina).
- **Regla del usuario**: todo lo que se hace en una máquina queda documentado en el repo (`docs/` + este archivo), nunca solo en la memoria local de Claude ni en `.claude/` (está en `.gitignore`).

## Estado actual (al 2026-09-07, ver arriba lo posterior)

- **Fases 0 a 6 del roadmap, formalmente cerradas** (`docs/persistence/10-DECISIONES.md #107` cierra Fase 6/Hardening explícitamente). El roadmap original (`docs/01-ROADMAP.md`) ya no tiene "próxima fase" obvia — desde `#108` en adelante, cada tanda fue backlog elegido a mano, no una fase nueva.
- **Fase 5 (Mobile)** tiene bastante superficie real: operador de sucursal (login, check-out/check-in), cliente-autogestión (login OTP por WhatsApp, ver/crear/cancelar reservas propias, búsqueda de vehículos disponibles, push notifications de recordatorio via Expo).
- **`apps/web-admin`** sigue siendo un stub de bootstrap puro (una página con `<h1>` y un ping a `/health/ready`) — nunca se construyó de verdad. Si el próximo paso implica UI de staff en navegador, ahí no hay nada que reusar.
- Últimas 3 decisiones: `#121` (Reminder de reservas, BullMQ + rol `platform_admin`/BYPASSRLS), `#122` (Push de Expo conectado a Reminder), `#123` (`GET /vehicles?expand=vehicleCategory`, primera implementación real del mecanismo `?expand=`, + pantalla de búsqueda de vehículos en mobile).

## Pendientes conocidos, explícitamente documentados (no asumir que faltan si no están acá)

Todos estos son gaps **aceptados y documentados**, no bugs silenciosos. Elegir cuál atacar es una decisión del usuario, no algo a asumir — preguntale primero, mismo criterio usado en toda la sesión anterior (vía la herramienta de preguntas, ofreciendo 2-4 opciones concretas en vez de una pregunta abierta).

0. **CI del PR #2: RESUELTO y mergeado (2026-10-12, ver #125 a #129).** Historia: los 2 fallos reales originales están corregidos y ya pasan en CI (#124). La corrida del 2026-10-11 (run `38105986705`) mostró **4 fallos nuevos, todos de entorno, no de lógica**:
   - **`minio/minio` ya no se puede bajar de Docker Hub** ("pull access denied... repository does not exist"). Rompe `platform-integration-providers-infrastructure:test` y `api-e2e:test` (el `globalSetup` de testcontainers levanta MinIO). También afecta a `docker-compose.yml` (`minio/minio`, `minio/mc`). Elegir la imagen de reemplazo es decisión del usuario.
   - **`mobile:lint`** (6 errores `no-unsafe-*` en `check-in.tsx`/`check-out.tsx`) y **`mobile:test`** (timeouts de 5 s): solo fallan en CI. Localmente lint pasa porque `apps/mobile/node_modules` aporta tipos y paquetes que en CI no existen (`npm ci` solo instala la raíz). Es el mismo problema de fondo que #108 (ítem 3): ahora **bloquea el merge**.
   - **Actualización #125**: MinIO pasó a `cgr.dev/chainguard/minio` (fijada por digest, ya pasa en CI). Mobile en verde con el layout de CI (causa raíz de #108: `apps/mobile/node_modules` resuelve otras versiones, p.ej. zod 3 en vez de 4). `api-e2e` no arrancaba el API en CI por falta de `MFA_SECRET_ENCRYPTION_KEY` (corregido en `globalSetup`). Estado al 2026-10-11 (run `38137977186`): **5 de 6 checks en verde**. Solo fallaba `audit` (16 vulnerabilidades con parche): resuelto en #127 y #128 (`npm audit fix`, Nx 23.3.0 alineado, que elimina el pin de axios sin override, y excepción con vencimiento para image-size hasta que Expo use metro 0.87.1 o superior).
1. **Smoke test del Reminder: RESUELTO** (#131/#132). `npm run smoke:reminder` da PASS repetible con datos reales. Encontró y corrigió 2 bugs: ningún recordatorio se enviaba, y la disponibilidad liberaba el slot de otra reserva (doble reserva posible). **Queda el gap "como mucho una vez"**: el dispatch se registra antes de enviar, así que un envío fallido no se reintenta. Push real sigue bloqueado por el ítem 6.
2. **OCR con proveedor real** (AWS Textract / Google Vision) — hoy `DocumentExtractionPort` es un fake. Requiere que el usuario decida proveedor + credenciales, no es una decisión técnica.
3. **`apps/mobile/node_modules` vs. CI** (`#108`, causa raíz encontrada en `#125`): ese árbol local (ignorado por git) hace que mobile resuelva otras versiones que el workspace (por ejemplo, zod 3 en vez de 4), así que lint y test locales **no reflejan CI**. Para verificar mobile de forma fiel: mover `apps/mobile/node_modules` **fuera del repo**, correr `nx run-many -t lint,test -p mobile` y restaurarlo. Pendiente, como tanda propia: decidir si se elimina o se alinea (#108 lo cita como necesario para EAS Build; no verificado).
4. **Escalamiento humano** cuando una `Notification` `Confirmation` agota todos los canales (`#94`) — mecanismo sin diseñar todavía.
5. **Push (Expo) solo conectado a `Reminder`** — no a `Confirmation`/`Receipt`, por decisión explícita de acotar alcance en `#122`.
6. **Sin `extra.eas.projectId`** vinculado en `apps/mobile/app.json` — requiere una cuenta EAS real (acción externa). Sin esto, `getExpoPushTokenAsync()` no puede obtener un token real en ningún entorno de desarrollo.
7. **Validación visual manual** (`apps/api` + `apps/mobile` en modo web): ya se puede hacer. Hay datos y credenciales con `npm run db:seed`, y el OTP de cliente sale de `npm run dev:last-otp` (ver `docs/engineering/11-ENTORNO-LOCAL-NATIVO.md` §5). Falta que el usuario la recorra.

## Entorno — cómo levantar todo

**Sin Docker (vigente desde #124)**: seguir [`docs/engineering/11-ENTORNO-LOCAL-NATIVO.md`](docs/engineering/11-ENTORNO-LOCAL-NATIVO.md). Usar siempre **Node 20.19.4** (`.nvmrc`, el mismo que CI). Con otra versión, un resultado local no es evidencia válida. Los tests `*-infrastructure` y `api-e2e` no corren localmente (testcontainers), solo en CI. Los pasos de abajo son el camino original con Docker; siguen válidos si Docker está disponible.

1. `npm install` en la raíz.
2. Copiar `.env.example` → `.env` (los valores por defecto ya coinciden con `docker-compose.yml`, son credenciales triviales de desarrollo, no secretos reales).
3. `docker compose up -d postgres redis minio minio-init` — Postgres/Redis/MinIO. **No hace falta ningún otro servicio** del compose (los de observability — Grafana/Prometheus/etc. — son opcionales, perfil aparte).
4. `npx prisma migrate deploy` (aplica las ~51 migraciones existentes).
5. `npx nx serve api` — backend en `localhost:3000`.
6. Mobile: `cd apps/mobile && npx expo start --web` (o `npx nx run mobile:start` para el menú interactivo completo).
7. **Primer admin de una company**: sigue sin existir camino vía API (gap aceptado desde Identity & Access). Para desarrollo local, `npm run db:seed` lo crea (#131). Para tests, `seedCompanyWithAdmin()` en `apps/api-e2e/src/support/seed-identity.ts`.

**Cuidado con RAM en máquinas con poca memoria disponible**: Docker Desktop + `apps/api` + un bundler (Metro/webpack) simultáneos pueden colgar una sesión de desarrollo. Ver [`docs/runbooks/06-diagnostico-recursos-maquina-de-desarrollo.md`](docs/runbooks/06-diagnostico-recursos-maquina-de-desarrollo.md) — incluye el hallazgo de que `docker compose down` no libera la RAM de la VM de WSL2 (hace falta `wsl --shutdown` además) y una rutina de diagnóstico completa en PowerShell. Si la máquina nueva tiene RAM abundante, probablemente no necesites nada de esto — es documentación de una limitación puntual, no una restricción del proyecto en sí.

## Git

- `master` en GitHub está protegida: requiere PR, **1 aprobación** y los 6 status checks (`ci / lint-typecheck`, `ci / test`, `ci / build`, `e2e`, `audit`, `docker-validate`), con `enforce_admins` activo. **Un `git push origin master` directo va a fallar.** Todo cambio va en una rama + PR (`gh pr create`).
- **Aprobaciones**: GitHub no deja que el autor apruebe su propio PR. Hay un segundo colaborador con permiso `write` (`gameoverplay26-stack`) que aprueba. "Require review from Code Owners" está **desactivado** (2026-10-12): `.github/CODEOWNERS` solo lista a `@hilarionht`, así que con esa opción activa ningún PR del dueño podía mergearse. Si se vuelve a activar, primero hay que agregar al colaborador en `CODEOWNERS` (vía PR: GitHub lee el `CODEOWNERS` de la rama destino).
- Historia: el trabajo local acumulado (237 commits) se sincronizó vía la rama `sync/local-work-2026-09-07` → PR #2, mergeado el 2026-10-12. El PR #1 también figura mergeado.
- Nunca mergear, aprobar ni bypassear PRs vos mismo (regla de abajo).

## Reglas operativas que aplicaron durante toda la sesión anterior (seguir aplicando salvo que el usuario diga lo contrario)

- Nunca mergear/aprobar/bypassear PRs vos mismo.
- Nunca pushear a `origin/master` sin que el usuario lo pida explícitamente en ese momento (no alcanza con una autorización de una sesión anterior).
- Nunca `nx run-many --all` — todo lint/typecheck/test escopeado por proyecto tocado (`nx run-many -t lint,typecheck,test -p <proyecto-1>,<proyecto-2>`).
- Antes de dar por cerrado un cambio que toque wiring cross-módulo o la forma de una respuesta HTTP, correr un smoke test contra un servidor real (no solo unit tests) — varios bugs reales de esta sesión (DI faltante, mapeos de schema faltantes, etc.) solo los atrapó eso, nunca los tests unitarios.
- Specs e2e siempre se corren individuales, nunca en batch.
- Para cualquier tanda no trivial: investigar → `EnterPlanMode` → (para cambios grandes/sensibles) validar el plan con un agente `Plan` antes de `ExitPlanMode` → aprobación explícita del usuario → commits en capas, cada uno verificado → documentar la decisión en `docs/persistence/10-DECISIONES.md` antes de dar la tanda por cerrada.
- Nunca inventar una decisión de negocio (proveedor externo, calibración de umbrales, alcance de una feature) — señalar el gap explícitamente y preguntarle al usuario, no asumir.

## Cómo arrancar una sesión nueva acá

1. Leer este archivo completo (ya lo estás haciendo).
2. Leer las últimas ~10 entradas de `docs/persistence/10-DECISIONES.md` para contexto reciente real (no solo el resumen de arriba).
3. `git fetch origin && git status -sb` — confirmar si el PR de sync ya se mergeó o sigue pendiente.
4. Preguntarle al usuario con qué de la lista de "Pendientes conocidos" quiere seguir (o si tiene algo nuevo en mente) — no asumir cuál por tu cuenta.
