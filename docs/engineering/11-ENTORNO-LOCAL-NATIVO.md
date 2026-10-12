# 11 — Entorno local nativo (Windows, sin Docker)

Cómo levantar `apps/api` y `apps/mobile` en una máquina Windows con los servicios **instalados directamente**, sin Docker. Esta guía es la alternativa a [06-DOCKER.md](06-DOCKER.md) para desarrollo. No reemplaza a Docker en CI: ahí los jobs siguen usando contenedores. Decisión de origen: [`docs/persistence/10-DECISIONES.md #124`](../persistence/10-DECISIONES.md).

Está escrita para que **cualquier máquina nueva** llegue al mismo estado siguiendo los pasos en orden. Lo específico de una máquina en particular (rutas, versiones exactas instaladas, problemas encontrados) va en la §8, no se mezcla con los pasos.

## 1. Qué hace falta y qué no

| Servicio                              | ¿Obligatorio para arrancar `apps/api`?                                                                           | Por qué                                                                                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node **20.19.4** (`.nvmrc`)           | Sí                                                                                                               | Es la versión de CI (`setup-node` usa `node-version-file: .nvmrc`). Correr con otra versión no es evidencia válida de que CI va a pasar                    |
| PostgreSQL 16                         | Sí                                                                                                               | `DATABASE_URL`, `APP_DATABASE_URL` y `PLATFORM_ADMIN_DATABASE_URL` son obligatorias (`apps/api/src/config/env.validation.ts`), y `/health/ready` hace ping |
| Redis 7 (API compatible)              | Sí                                                                                                               | `REDIS_URL` es obligatoria. `/health/ready` lo chequea y BullMQ (#121) lo necesita                                                                         |
| Almacenamiento S3 (MinIO)             | Solo las **variables** `STORAGE_*` son obligatorias. El servicio solo hace falta para subir y descargar archivos | `S3Client` se construye al iniciar, pero no hay chequeo de bucket                                                                                          |
| Pagos, notificaciones, OCR, Expo push | No                                                                                                               | Fakes por defecto: `PAYMENT_GATEWAY_PROVIDER=fake`, `NOTIFICATION_SENDER_PROVIDER=fake`, OCR fake fijo, `EXPO_PUSH_ACCESS_TOKEN` opcional                  |

**Tests**: sin Docker solo corren los tests que no usan testcontainers (`domain`, `application`, `apps/*` unitarios, `frontend/*`), además de lint, typecheck y build. Los `*-infrastructure` (17 proyectos) y `apps/api-e2e` levantan contenedores y **solo corren en CI** (decisión del usuario, #124). Ver §6.

## 2. Node 20.19.4 sin pisar el Node global

La máquina puede tener otro Node global para otros proyectos. No se cambia: se usa el 20.19.4 solo en la terminal de este repo.

Con **nvm-windows** ya instalado (`%NVM_HOME%`), `nvm install` desde una terminal no interactiva puede no hacer nada. El método que funcionó: bajar el zip oficial, verificar su checksum y dejarlo en la carpeta de nvm, donde nvm lo reconoce.

```powershell
$v='v20.19.4'; $dl="$env:TEMP\node-$v-dl"; New-Item -ItemType Directory -Force $dl | Out-Null
$zip="node-$v-win-x64.zip"
Invoke-WebRequest "https://nodejs.org/dist/$v/$zip" -OutFile "$dl\$zip"
Invoke-WebRequest "https://nodejs.org/dist/$v/SHASUMS256.txt" -OutFile "$dl\SHASUMS256.txt"
$expected=(Select-String -Path "$dl\SHASUMS256.txt" -Pattern " $zip$").Line.Split(' ')[0]
$actual=(Get-FileHash "$dl\$zip" -Algorithm SHA256).Hash.ToLower()
if ($expected -ne $actual) { throw 'CHECKSUM MISMATCH' }
Expand-Archive "$dl\$zip" -DestinationPath $dl -Force
Move-Item "$dl\node-$v-win-x64" "$env:NVM_HOME\$v"
```

Para usarlo en la terminal actual (no cambia nada global):

```powershell
$env:PATH = "$env:NVM_HOME\v20.19.4;$env:PATH"; node -v   # v20.19.4
```

```bash
# Git Bash
export PATH="/c/Users/$USERNAME/AppData/Roaming/nvm/v20.19.4:$PATH"; node -v
```

Alternativa si querés que sea el Node por defecto de toda la máquina: `nvm use 20.19.4` desde una terminal **como administrador**. Esto afecta a todos tus proyectos.

## 3. Redis: Memurai Developer

**Por qué Memurai y no Redis en WSL**: WSL es Redis "real", pero en la primera máquina donde se armó esto la distro de WSL no tenía salida a internet y `apt` fallaba. Memurai es nativo de Windows, corre como servicio y expone la API de Redis **7.2.5**. Si en tu máquina WSL tiene red, Redis 7 en WSL también sirve: lo único que importa es que `REDIS_URL=redis://localhost:6379` responda.

`winget install Memurai.MemuraiDeveloper --silent` **falló** con error 1603 (una acción interna del MSI no pudo crear su carpeta temporal). Lo que funcionó fue `msiexec` directo y elevado:

```powershell
$dl="$env:TEMP\memurai-dl"; New-Item -ItemType Directory -Force $dl | Out-Null
$msi="$dl\Memurai-Developer-v4.1.2.msi"
Invoke-WebRequest "https://dist.memurai.com/releases/Memurai-Developer/4.1.2/Memurai-Developer-v4.1.2.msi" -OutFile $msi
(Get-AuthenticodeSignature $msi).Status   # debe ser Valid (Janea Systems, Inc.)
Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn /norestart PORT=6379 ADD_FIREWALL_RULE=0 /L*v `"$dl\install.log`"" -Verb RunAs -Wait
```

Verificación:

```powershell
& "C:\Program Files\Memurai\memurai-cli.exe" PING                  # PONG
& "C:\Program Files\Memurai\memurai-cli.exe" INFO server | Select-String redis_version
& "C:\Program Files\Memurai\memurai-cli.exe" CONFIG GET bind       # 127.0.0.1
```

- Servicio de Windows: `Memurai`, con inicio automático. Para frenarlo: `Stop-Service Memurai`, elevado.
- **Limitación de la edición Developer**: es gratis para desarrollo, pero tiene restricciones de uso prolongado (revisá los términos vigentes en memurai.com). Si el servicio se detiene solo, reinicialo con `Restart-Service Memurai`.

## 4. PostgreSQL 16

**Descarga**: `winget install PostgreSQL.PostgreSQL.16` y la URL directa `get.enterprisedb.com/...` devuelven **403** (CloudFront). La descarga que funciona sale de la página de EnterpriseDB (`https://www.enterprisedb.com/downloads/postgres-postgresql-downloads`): el link `sbp.enterprisedb.com/getfile.jsp?fileid=...` de la fila **16.x, Windows x86-64**. Verificá la firma antes de ejecutar:

```powershell
(Get-AuthenticodeSignature "$env:TEMP\pg16-dl\postgresql-16.x-windows-x64.exe").Status   # Valid, EnterpriseDB
```

**Instalación desatendida** (solo servidor y herramientas de línea de comandos, sin pgAdmin ni StackBuilder):

```powershell
Start-Process "$env:TEMP\pg16-dl\postgresql-16.x-windows-x64.exe" -ArgumentList '--mode unattended --unattendedmodeui none --superpassword postgres --serverport 5432 --enable-components server,commandlinetools --disable-components pgAdmin,stackbuilder' -Verb RunAs -Wait
```

> La contraseña `postgres` del superusuario es **solo para desarrollo local**. `pg_hba.conf` del instalador solo acepta conexiones desde `127.0.0.1` y `::1`. No la uses en ningún entorno compartido.

**Usuario y base de la app** (los mismos valores que `.env.example` y `docker-compose.yml`):

```powershell
$psql = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
$env:PGPASSWORD = 'postgres'
& $psql -U postgres -h localhost -c "CREATE ROLE renta LOGIN SUPERUSER PASSWORD 'renta';"
& $psql -U postgres -h localhost -c "CREATE DATABASE renta OWNER renta;"
Remove-Item Env:PGPASSWORD
```

`renta` es **SUPERUSER** a propósito: es el mismo rol que la imagen de Docker crea con `POSTGRES_USER`, y las migraciones lo necesitan para crear roles con `BYPASSRLS` (`platform_admin`, #121). Los roles `app_runtime` y `platform_admin` **los crean las migraciones**, no a mano.

## 5. Arranque

```bash
# 0. Node 20.19.4 en esta terminal (§2)
npm install                                  # solo la primera vez o si cambió package-lock.json
cp .env.example .env                         # solo si no existe; los valores por defecto ya apuntan a localhost
npm run security:generate-jwt-keys >> .env   # solo si .env no tiene JWT_* (CI hace lo mismo)
npx prisma generate                          # npm install no lo hace (sin postinstall, a propósito)
npx prisma migrate deploy                    # aplica las 51+ migraciones
npx nx serve api                             # http://localhost:3000
```

Salud:

```bash
curl -s http://localhost:3000/health/live    # 200: el proceso vive
curl -s http://localhost:3000/health/ready   # 200: Postgres y Redis responden
```

### Datos de desarrollo (`npm run db:seed`, #131)

Con `apps/api` corriendo:

```bash
npm run db:seed          # company demo idempotente: si ya existe, solo reimprime credenciales
npm run smoke:reminder   # smoke de punta a punta del Reminder: PASS/FAIL con exit code
```

- **Admin (solo desarrollo)**: `admin@demo.renta.local` / `Demo!Renta2026`. El `companyId` y los ids se imprimen en consola y quedan en `tooling/scripts/db/.output/dev-seed.json` (ignorado por git).
- **Datos que crea**: sucursal, 2 vehículos habilitados (`DEMO-001`, `DEMO-002`), 2 clientes verificados (Ana `+525500009001`, Luis `+525500009002`), R1 `Confirmed` en +2 h (dentro de la ventana del Reminder) y R2 `Confirmed` en +3 días (para check-out/check-in).
- **OTP de cliente** (login en mobile): con el proveedor fake el código no viaja por WhatsApp. Pedilo desde la app y leelo con `npm run dev:last-otp -- +525500009001`.
- `smoke:reminder` crea y cancela su propia reserva en cada corrida, así que se puede repetir. No espera los 15 minutos del scheduler: encola el scan a mano en la cola BullMQ real.
- **`apps/mobile/node_modules` tiene que ser un enlace a la raíz** (#133): `New-Item -ItemType Junction -Path appsmobile
ode_modules -Target <raíz>
ode_modules` en Windows, `ln -s ../../node_modules apps/mobile/node_modules` en macOS/Linux. Nunca correr `npm install` dentro de `apps/mobile`: crea un árbol con otras versiones y Metro no resuelve las libs del workspace.
- **Mobile en un celular (Expo Go)**: `cd apps/mobile`, con `EXPO_PUBLIC_API_URL=http://<IP-de-la-PC>:3000` y `npx expo start --lan`. En Expo Go se abre `exp://<IP-de-la-PC>:8081`; celular y PC tienen que estar en la misma red y el firewall tiene que permitir Node. Si el editor exporta `NX_WORKSPACE_ROOT_PATH` con la unidad en minúscula, hay que corregirla. La versión web de mobile no es viable por diseño (SecureStore).
- **Empezar de cero**: `npx prisma migrate reset` (borra la base local; Prisma pide confirmación explícita) y después `npm run db:seed`. Si quedaron jobs viejos en BullMQ, `memurai-cli FLUSHDB` vacía el Redis local.

Mobile: `cd apps/mobile && npx expo start --web`.

## 6. Qué verificación corre dónde

| Verificación                                                      | Local (sin Docker)                                                                                                                    | CI                 |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| lint, typecheck                                                   | Sí: `npx nx run-many -t lint,typecheck -p <proyectos>`                                                                                | Sí (`nx affected`) |
| Tests unitarios (`domain`, `application`, `frontend/*`, `apps/*`) | Sí: `npx nx run-many -t test -p <proyectos>`                                                                                          | Sí                 |
| Tests y lint de `apps/mobile`                                     | Sí, pero **moviendo `apps/mobile/node_modules` fuera del repo** mientras corren (si no, se resuelven otras versiones que en CI; #125) | Sí                 |
| Tests `*-infrastructure` (testcontainers)                         | **No**                                                                                                                                | Sí                 |
| `apps/api-e2e`                                                    | **No**                                                                                                                                | Sí                 |
| Smoke test HTTP contra `apps/api` real                            | Sí (§5)                                                                                                                               | No                 |

Para reproducir el job `ci / lint-typecheck` completo: `npx nx affected --target=lint,typecheck --base=origin/master --parallel=1` con Node 20.19.4. `--parallel=1` es para no quedarse sin RAM; en máquinas con poca memoria tarda más de 10 minutos.

## 7. Apagado

1. Ctrl+C en Expo y en `nx serve api`. El cierre de Nest también cierra los workers de BullMQ.
2. Los servicios `Memurai` y `postgresql-x64-16` quedan corriendo (inicio automático, consumo bajo). Para liberar memoria, elevado: `Stop-Service Memurai, postgresql-x64-16`.

## 8. Bitácora por máquina

Cada máquina donde se arme este entorno agrega una entrada: qué se instaló, con qué versión, y qué falló. Sirve para que la próxima sesión sepa qué ya está hecho.

### Máquina `Hilarion` (Windows 11 Pro, 15,7 GB RAM) — 2026-10-10

- Node 20.19.4 en `%NVM_HOME%\v20.19.4` (zip oficial, SHA-256 verificado). El Node global sigue en 22.12.0.
- Memurai Developer 4.1.2 (API de Redis 7.2.5), servicio `Memurai`, `127.0.0.1:6379`, sin regla de firewall.
- WSL Ubuntu 24.04 presente pero **sin salida a internet** (`apt-get` da timeout): por eso no se usó Redis en WSL.
- PostgreSQL 16.15 (instalador de EnterpriseDB, `fileid=1260621`, firma válida), servicio `postgresql-x64-16`, rol `renta` SUPERUSER y base `renta`. 51 migraciones aplicadas.
- `apps/api` arrancado con este entorno: `/health/ready` 200 (postgres up, redis up). BullMQ sobre Memurai verificado (#124).
- `apps/mobile` tests: los 11 specs fallan localmente por #108 (`node_modules` duplicado).
- RAM libre típica con VS Code y Chrome abiertos: alrededor de 1,3 GB. Correr `nx` con `--parallel=1`.
