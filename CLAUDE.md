# Guía de continuación — plataforma de alquiler de vehículos

Este archivo es el punto de entrada para retomar el desarrollo en una sesión nueva (otra máquina, posiblemente otra cuenta de Claude). Si estás leyendo esto por primera vez en este repo: **empezá por acá antes de tocar código.**

## Qué es este proyecto

Monorepo Nx (NestJS + Prisma/Postgres + Next.js + React Native/Expo) para una plataforma empresarial modular, cuyo primer producto es alquiler de vehículos. La documentación completa de arquitectura vive en `docs/` — empezá por [`docs/00-VISION.md`](docs/00-VISION.md) y [`docs/01-ROADMAP.md`](docs/01-ROADMAP.md) si necesitás contexto de negocio/arquitectura general.

**El documento más importante para continuar es [`docs/persistence/10-DECISIONES.md`](docs/persistence/10-DECISIONES.md)** — el log cronológico de cada decisión de diseño tomada durante el desarrollo, numerado (`#1` a `#123` al momento de escribir esto), con el razonamiento de cada una y los gaps aceptados explícitamente. Leé al menos las últimas 10-15 entradas antes de proponer cualquier cambio nuevo — evita repetir investigación ya hecha o pisar una decisión ya tomada a propósito.

## Estado actual (al 2026-09-07)

- **Fases 0 a 6 del roadmap, formalmente cerradas** (`docs/persistence/10-DECISIONES.md #107` cierra Fase 6/Hardening explícitamente). El roadmap original (`docs/01-ROADMAP.md`) ya no tiene "próxima fase" obvia — desde `#108` en adelante, cada tanda fue backlog elegido a mano, no una fase nueva.
- **Fase 5 (Mobile)** tiene bastante superficie real: operador de sucursal (login, check-out/check-in), cliente-autogestión (login OTP por WhatsApp, ver/crear/cancelar reservas propias, búsqueda de vehículos disponibles, push notifications de recordatorio via Expo).
- **`apps/web-admin`** sigue siendo un stub de bootstrap puro (una página con `<h1>` y un ping a `/health/ready`) — nunca se construyó de verdad. Si el próximo paso implica UI de staff en navegador, ahí no hay nada que reusar.
- Últimas 3 decisiones: `#121` (Reminder de reservas, BullMQ + rol `platform_admin`/BYPASSRLS), `#122` (Push de Expo conectado a Reminder), `#123` (`GET /vehicles?expand=vehicleCategory`, primera implementación real del mecanismo `?expand=`, + pantalla de búsqueda de vehículos en mobile).

## Pendientes conocidos, explícitamente documentados (no asumir que faltan si no están acá)

Todos estos son gaps **aceptados y documentados**, no bugs silenciosos. Elegir cuál atacar es una decisión del usuario, no algo a asumir — preguntale primero, mismo criterio usado en toda la sesión anterior (vía la herramienta de preguntas, ofreciendo 2-4 opciones concretas en vez de una pregunta abierta).

1. **Smoke test end-to-end vía HTTP** de Reminder de reservas (`#121`) y de Push (`#122`) — nunca se corrió contra un boot completo de `apps/api` por restricciones de RAM en la máquina de desarrollo original. Los unit tests sí corrieron y pasan; falta la verificación real de punta a punta.
2. **OCR con proveedor real** (AWS Textract / Google Vision) — hoy `DocumentExtractionPort` es un fake. Requiere que el usuario decida proveedor + credenciales, no es una decisión técnica.
3. **Bug del test-runner de Jest en `apps/mobile`** (`#108`) — pre-existente, no causado por ninguna tanda. `node_modules` duplicado entre la raíz y `apps/mobile` (patrón `@nx/expo`+EAS) rompe la resolución de `react-native`/`@testing-library/react-native` de forma no determinística. Verificación real disponible en su lugar: `tsc --build` + `eslint`, ambos limpios en cada commit. Arreglar la causa raíz es su propia tanda dedicada.
4. **Escalamiento humano** cuando una `Notification` `Confirmation` agota todos los canales (`#94`) — mecanismo sin diseñar todavía.
5. **Push (Expo) solo conectado a `Reminder`** — no a `Confirmation`/`Receipt`, por decisión explícita de acotar alcance en `#122`.
6. **Sin `extra.eas.projectId`** vinculado en `apps/mobile/app.json` — requiere una cuenta EAS real (acción externa). Sin esto, `getExpoPushTokenAsync()` no puede obtener un token real en ningún entorno de desarrollo.
7. **Validación visual manual** (levantar Docker + `apps/api` + `apps/mobile` en modo web para clickear la app) — se intentó en la máquina original y se abortó por RAM insuficiente (ver runbook citado abajo). Nunca se llegó a sembrar una company + admin de prueba. Si esta máquina nueva tiene más RAM, es un buen primer paso para confirmar que todo lo de arriba realmente funciona de punta a punta.

## Entorno — cómo levantar todo

1. `npm install` en la raíz.
2. Copiar `.env.example` → `.env` (los valores por defecto ya coinciden con `docker-compose.yml`, son credenciales triviales de desarrollo, no secretos reales).
3. `docker compose up -d postgres redis minio minio-init` — Postgres/Redis/MinIO. **No hace falta ningún otro servicio** del compose (los de observability — Grafana/Prometheus/etc. — son opcionales, perfil aparte).
4. `npx prisma migrate deploy` (aplica las ~51 migraciones existentes).
5. `npx nx serve api` — backend en `localhost:3000`.
6. Mobile: `cd apps/mobile && npx expo start --web` (o `npx nx run mobile:start` para el menú interactivo completo).
7. **No existe ningún camino vía API para crear el primer usuario admin de una company** (gap aceptado desde Identity & Access) — hay que insertarlo directo en Postgres. El patrón exacto (con argon2id, rol System con el catálogo completo de permisos) está en `apps/api-e2e/src/support/seed-identity.ts` (`seedCompanyWithAdmin()`) — es reusable tal cual para sembrar un admin de prueba contra la base de desarrollo real (no solo contra la de test), apuntando `TEST_DATABASE_URL`/`DATABASE_URL` según corresponda. La company en sí sí tiene camino real: `POST /api/v1/companies` (`@Public()`).

**Cuidado con RAM en máquinas con poca memoria disponible**: Docker Desktop + `apps/api` + un bundler (Metro/webpack) simultáneos pueden colgar una sesión de desarrollo. Ver [`docs/runbooks/06-diagnostico-recursos-maquina-de-desarrollo.md`](docs/runbooks/06-diagnostico-recursos-maquina-de-desarrollo.md) — incluye el hallazgo de que `docker compose down` no libera la RAM de la VM de WSL2 (hace falta `wsl --shutdown` además) y una rutina de diagnóstico completa en PowerShell. Si la máquina nueva tiene RAM abundante, probablemente no necesites nada de esto — es documentación de una limitación puntual, no una restricción del proyecto en sí.

## Git — importante, cambió durante esta sesión

- `master` en GitHub está protegida (requiere PR + 6 status checks) — **un `git push origin master` directo va a fallar**. Todo cambio nuevo va en una rama + PR (`gh pr create`), nunca directo a `master`.
- Al cerrar la sesión anterior, `master` local estaba 237 commits adelante de `origin/master` (trabajo nunca antes pusheado). Se sincronizó vía la rama `sync/local-work-2026-09-07` → PR abierto, **sin mergear** (esa decisión queda para el usuario, nunca la tomes vos solo — ver la regla general de no mergear/aprobar/bypassear PRs).
- Antes de asumir que `origin/master` tiene el estado más reciente, correr `git fetch origin && git status -sb` — puede que el PR de sync siga sin mergear.

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
