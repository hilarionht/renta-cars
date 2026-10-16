# Guía de continuación — plataforma de alquiler de vehículos

Este archivo es el punto de entrada para retomar el desarrollo en una sesión nueva (otra máquina, posiblemente otra cuenta de Claude). Si estás leyendo esto por primera vez en este repo: **empezá por acá antes de tocar código.**

## Qué es este proyecto

Monorepo Nx (NestJS + Prisma/Postgres + Next.js + React Native/Expo) para una plataforma empresarial modular, cuyo primer producto es alquiler de vehículos. La documentación completa de arquitectura vive en `docs/` — empezá por [`docs/00-VISION.md`](docs/00-VISION.md) y [`docs/01-ROADMAP.md`](docs/01-ROADMAP.md) si necesitás contexto de negocio/arquitectura general.

**El documento más importante para continuar es [`docs/persistence/10-DECISIONES.md`](docs/persistence/10-DECISIONES.md)** — el log cronológico de cada decisión de diseño tomada durante el desarrollo, numerado (`#1` a `#141` al momento de escribir esto), con el razonamiento de cada una y los gaps aceptados explícitamente. Leé al menos las últimas 10-15 entradas antes de proponer cualquier cambio nuevo — evita repetir investigación ya hecha o pisar una decisión ya tomada a propósito.

## Trabajo en curso — RETOMAR ACÁ (si la sesión se cortó)

**Regla del usuario**: si la sesión se corta (límite de tokens, cierre, error), la próxima sesión **continúa sola desde este punto** apenas se habilite, sin volver a preguntar lo ya decidido. Al terminar cada paso, actualizar esta lista. Cuando quede vacía, borrar la sección.

Estado al 2026-10-16. Mergeados: Incremento 4 (Clientes, PR #8, #139), Incremento 5 (Administración, PR #9, #140) y reserva y ocupación atómicas (PR #10, #141). El detalle de cada uno está en su decisión.

**En curso, elegido por el usuario (2026-10-16): pendiente 8, actor desde el token**, rama `feat/actor-from-token` (desde `master` con el PR #10). Hallazgos de la investigación:

- `inspectedBy` (retiro y devolución) y `cancelledBy` (cancelación del personal) los manda el cliente: se puede firmar a nombre de otro. La auditoría ya usa el token (`requestContext.userId`); lo falsificable es lo guardado en la inspección y en `ReservationCancelled.v1`. El cliente de mobile ya cancela con el token.
- `responsibleUserId` del mantenimiento acepta cualquier UUID (otra empresa o inexistente).
- El `ValidationPipe` usa `forbidNonWhitelisted`: quitar un campo hace que un cliente viejo reciba 400.

Decisiones del usuario (2026-10-16):

- **Quitar `inspectedBy` y `cancelledBy` del contrato**; el API usa siempre el usuario del token y web y mobile se actualizan en el mismo PR (no hay builds en producción).
- **`responsibleUserId` tiene que ser un usuario activo de la misma empresa** (si no, 422); elegir a otra persona sigue siendo válido.
- **Índice trigram de la búsqueda de clientes en este PR** (`pg_trgm`, GIN sobre nombre, documento y email).

Pasos:

Plan aprobado (2026-10-16), validado con un agente Plan (`~/.claude/plans/drifting-leaping-emerson.md`). Correcciones del agente: cancelar queda sin body y un `cancelledBy` viejo se ignora (no da 400); `@RequireStaffActor()` en el controller; `USER_LOOKUP_PORT.getStatus` angosto (rental no recibe `passwordHash`). **Riesgo del trigram**: `rental.customers` tiene RLS forzado y Postgres no usa índices para `ILIKE` (no `LEAKPROOF`) bajo RLS; se prueba primero como `app_runtime` y, si no se usa, la capa sale del PR y queda como gap. Capas:

- [x] 1. Actor desde el token: DTOs, controller, domain-types, data-access-web, data-access (spec), web-admin (`currentUserId` fuera), mobile (`useAuth` muerto fuera), e2e (+ caso 400) y `tooling/scripts/smoke/reminder.ts`.
- [ ] 2. Responsable de mantenimiento: `getStatus` en el puerto, adapter y 3 specs de identity; `InvalidResponsibleUserError` 422; `VehiclesModule` importa `UsersModule`.
- [x] 3. Trigram: **descartado** (2026-10-16, `trgm-rls-probe.cjs` del scratchpad, en una transacción revertida). Con seq scan e index scan apagados, el superusuario usa los 4 GIN (BitmapOr), pero `app_runtime` bajo RLS no: solo usa `customers_company_id_id_idx` y filtra el `ILIKE` fila por fila (`ILIKE` no es `LEAKPROOF`). Queda como gap en #142; la alternativa futura (función `SECURITY DEFINER` con filtro explícito por empresa) es una decisión de seguridad del usuario.
- [ ] 4. Verificación (unitarios, smoke, `next build`, 11 e2e individuales), docs (#142, `07-ERROR-CATALOG`, `05-INDICES-Y-CONSTRAINTS`, gap de `10-DECISIONES.md` #135, CLAUDE.md), PR y CI 6/6.

Pendiente del usuario: validación visual de Clientes y de Flota (la web queda en el 4200 mientras dure la sesión).

## Incremento 4 (2026-10-15) — Clientes

- PR #8, mergeado. Ver **`docs/persistence/10-DECISIONES.md #139`**:
  - renovación de documentos de clientes y vehículos (estado `Replaced`);
  - teléfono único por empresa, normalizado con Argentina por defecto;
  - el check-out rechaza a un cliente bloqueado o con el documento vencido;
  - pantallas de Clientes en la web.

## Última sesión (2026-10-14) — leer primero

- **Web de administración, Incremento 3 (Flota)**: rama `feat/web-admin-fleet`. Ver **`docs/persistence/10-DECISIONES.md #137`**. Antes de planear se auditó en vivo toda la superficie de Flota; eso encontró 4 problemas que se corrigieron:
  - un daño leve dejaba el vehículo trabado para siempre en mantenimiento: ahora crea un mantenimiento correctivo;
  - mantenimiento, daño y fuera de servicio dejaban sin auto a reservas activas: ahora el API responde 409 `VEHICLE_HAS_ACTIVE_BOOKINGS`;
  - un auto alquilado figuraba "Disponible": la reserva activa se deriva en la lectura, solo para el personal;
  - 500 en vez de 400/409: nuevo `InvalidValueError` (400 `INVALID_VALUE`).
- **#138**: **el MinIO open source fue archivado** (`dl.min.io` responde 410). En local se usa **RustFS** (guía del entorno §4.1, `npm run dev:storage-setup`). Además se corrigió un bug latente de producción: la URL de subida llevaba un checksum de un cuerpo vacío que S3 real rechaza. **Pendiente**: migrar el CI y `docker-compose.yml` fuera de MinIO, en un PR aparte.
- Siguen los incrementos 4 (Clientes) y 5 (Administración).

## Sesión anterior (2026-10-12 a 2026-10-13)

- **Web de administración, Incremento 2 (Reservas)**: hecho en el PR #6, rama `feat/web-admin-reservations`. Ver **`docs/persistence/10-DECISIONES.md #135`**:
  - zona horaria por sucursal (`Branch.timeZone`);
  - `expand` y filtro `branchId` en reservas (excepción acotada a `01-REST-STANDARDS` §7);
  - detalle de reserva solo para el personal;
  - búsqueda de clientes con `q` y cursor;
  - pantallas de listado, nueva reserva y detalle con acciones.

  Validado visualmente por el usuario.

- **#136**: el flujo en vivo encontró que reprogramar a un rango superpuesto y aprobar **cualquier** extensión fallaban siempre (la reserva chocaba con su propia ocupación). Se corrigió con `MoveSlotHandler`, que libera y ocupa en una sola transacción.
- Siguen los incrementos 3 (Flota), 4 (Clientes) y 5 (Administración).

## Sesión anterior (2026-10-10 a 2026-10-12)

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
- **`apps/web-admin`**: en construcción por incrementos (#134). **Incremento 1 (fundaciones)** hecho: login con MFA, sesión con refresh seguro, proxy con CSP, menú según permisos, design system `ui-kit-web` e inicio. **Incremento 2 (Reservas)** hecho (#135, PR #6). **Incremento 3 (Flota)** hecho (#137). **Incremento 4 (Clientes)** hecho (#139, PR #8). **Incremento 5 (Administración)** hecho (#140, rama `feat/web-admin-administration`): con eso la hoja de ruta de #134 queda completa. Arquitectura y restricciones en #134 y `docs/06` §3.
- Últimas decisiones: `#141` (reserva y ocupación atómicas, locks de vehículo y sucursal, eventos después del commit), `#138` (MinIO archivado, RustFS en local y URL de subida sin checksum), `#139` (Incremento 4: Clientes, renovación de documentos, teléfono único y check-out que revisa al cliente), `#140` (Incremento 5: Administración, último administrador protegido, refresh de usuario deshabilitado y primer puerto de platform implementado por rental).

## Pendientes conocidos, explícitamente documentados (no asumir que faltan si no están acá)

Todos estos son gaps **aceptados y documentados**, no bugs silenciosos. Elegir cuál atacar es una decisión del usuario, no algo a asumir — preguntale primero, mismo criterio usado en toda la sesión anterior (vía la herramienta de preguntas, ofreciendo 2-4 opciones concretas en vez de una pregunta abierta).

0. **CI del PR #2: RESUELTO y mergeado (2026-10-12, ver #125 a #129).** Historia: los 2 fallos reales originales están corregidos y ya pasan en CI (#124). La corrida del 2026-10-11 (run `38105986705`) mostró **4 fallos nuevos, todos de entorno, no de lógica**:
   - **`minio/minio` ya no se puede bajar de Docker Hub** ("pull access denied... repository does not exist"). Rompe `platform-integration-providers-infrastructure:test` y `api-e2e:test` (el `globalSetup` de testcontainers levanta MinIO). También afecta a `docker-compose.yml` (`minio/minio`, `minio/mc`). Elegir la imagen de reemplazo es decisión del usuario.
   - **`mobile:lint`** (6 errores `no-unsafe-*` en `check-in.tsx`/`check-out.tsx`) y **`mobile:test`** (timeouts de 5 s): solo fallan en CI. Localmente lint pasa porque `apps/mobile/node_modules` aporta tipos y paquetes que en CI no existen (`npm ci` solo instala la raíz). Es el mismo problema de fondo que #108 (ítem 3): ahora **bloquea el merge**.
   - **Actualización #125**: MinIO pasó a `cgr.dev/chainguard/minio` (fijada por digest, ya pasa en CI). Mobile en verde con el layout de CI (causa raíz de #108: `apps/mobile/node_modules` resuelve otras versiones, p.ej. zod 3 en vez de 4). `api-e2e` no arrancaba el API en CI por falta de `MFA_SECRET_ENCRYPTION_KEY` (corregido en `globalSetup`). Estado al 2026-10-11 (run `38137977186`): **5 de 6 checks en verde**. Solo fallaba `audit` (16 vulnerabilidades con parche): resuelto en #127 y #128 (`npm audit fix`, Nx 23.3.0 alineado, que elimina el pin de axios sin override, y excepción con vencimiento para image-size hasta que Expo use metro 0.87.1 o superior).
1. **Smoke test del Reminder: RESUELTO** (#131/#132). `npm run smoke:reminder` da PASS repetible con datos reales. Encontró y corrigió 2 bugs: ningún recordatorio se enviaba, y la disponibilidad liberaba el slot de otra reserva (doble reserva posible). **Queda el gap "como mucho una vez"**: el dispatch se registra antes de enviar, así que un envío fallido no se reintenta. Push real sigue bloqueado por el ítem 6.
2. **OCR con proveedor real** (AWS Textract / Google Vision) — hoy `DocumentExtractionPort` es un fake. Requiere que el usuario decida proveedor + credenciales, no es una decisión técnica.
3. **`apps/mobile/node_modules`: RESUELTO** (#133). Tiene que ser un **enlace** a la raíz, nunca una instalación aparte (ver guía §5). El lockfile de `apps/mobile` se conserva para EAS Build.
4. **Escalamiento humano** cuando una `Notification` `Confirmation` agota todos los canales (`#94`) — mecanismo sin diseñar todavía.
5. **Push (Expo) solo conectado a `Reminder`** — no a `Confirmation`/`Receipt`, por decisión explícita de acotar alcance en `#122`.
6. **Sin `extra.eas.projectId`** vinculado en `apps/mobile/app.json` — requiere una cuenta EAS real (acción externa). Sin esto, `getExpoPushTokenAsync()` no puede obtener un token real en ningún entorno de desarrollo.
7. **Validación visual manual**: hecha para el operador en un celular con Expo Go (#133), incluidos check-out y check-in. Falta completar el flujo del cliente. El teléfono del login ya se normaliza a E.164 con Argentina por defecto (#139).
8. **Gaps de la web de reservas (#135)**:
   - `inspectedBy` y `cancelledBy` todavía los manda el cliente; el API no los deriva del token;
   - ~~la zona horaria de una sucursal no se edita desde la UI~~: resuelto en #140 (Administración → Sucursales);
   - la búsqueda de clientes usa `ILIKE` sin índice trigram.
9. **Reserva y ocupación atómicas: RESUELTO** (#141). Las 7 operaciones que tocan el calendario van en una sola transacción; mantenimiento, daño, fuera de servicio y cierre de sucursal toman un lock exclusivo frente a confirmar; confirmar o cambiar de vehículo en una sucursal cerrada da 409 `BRANCH_CLOSED`; los eventos in-process se emiten después del commit.
10. **MinIO archivado** (#138): el CI (`cgr.dev/chainguard/minio`) y `docker-compose.yml` dependen de un producto sin parches. La migración a RustFS va en un PR aparte (el integration spec del adaptador S3 ya pasa contra RustFS).
11. **500 por ids que no son UUID v7 y por VO no migrados** (#137): un id v4 en un comando pasa `@IsUUID()` y `EntityId.from` responde 500; los VO de entrada de customers (#139) y de branches, roles, settings, users y companies (#140) ya lanzan `InvalidValueError`; los roles System v4 de seeds viejos se resuelven con un lookup por id crudo (#140). La web no los dispara.
12. **`@aws-sdk/client-s3` va a exigir Node 22 o superior desde enero de 2027** (#138); el proyecto usa Node 20.

## Entorno — cómo levantar todo

**Sin Docker (vigente desde #124)**: seguir [`docs/engineering/11-ENTORNO-LOCAL-NATIVO.md`](docs/engineering/11-ENTORNO-LOCAL-NATIVO.md). Usar siempre **Node 20.19.4** (`.nvmrc`, el mismo que CI). Con otra versión, un resultado local no es evidencia válida. Los tests `*-infrastructure` y `api-e2e` no corren localmente (testcontainers), solo en CI. Para subir archivos en local hace falta **RustFS** corriendo (guía §4.1; MinIO está archivado, #138). Los pasos de abajo son el camino original con Docker; siguen válidos si Docker está disponible.

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

- **Continuidad ante cortes (regla del usuario, 2026-10-14)**: si la sesión se corta por límite de tokens, cierre o error, el trabajo **no puede quedar suspendido hasta el otro día**. Cómo se cumple:
  1. Al empezar o al reanudar una sesión, si existe la sección "Trabajo en curso — RETOMAR ACÁ", **continuar solo** desde el primer paso pendiente, sin esperar instrucciones ni volver a preguntar lo ya decidido. Solo se pregunta lo que de verdad es decisión del usuario.
  2. Mantener esa sección al día **antes** de cada paso largo (push, CI, builds), para que un corte en el medio no pierda el estado.
  3. Al arrancar una tanda larga, programar en la sesión un recordatorio recurrente (`CronCreate`, cada hora): "revisar 'Trabajo en curso' en CLAUDE.md y continuar el primer paso pendiente". Si el límite corta la sesión pero la terminal sigue abierta, el recordatorio la reactiva apenas se libere. Es solo de esa sesión (no sobrevive a cerrar la terminal) y vence a los 7 días.
  4. Si la terminal se cerró, nada puede arrancarla solo: la próxima sesión que se abra aplica el punto 1.

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
