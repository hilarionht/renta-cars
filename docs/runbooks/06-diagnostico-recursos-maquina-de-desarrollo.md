# 06 — Diagnóstico de RAM/disco en la máquina de desarrollo local

A diferencia de los 5 runbooks anteriores (incidentes de producción/staging), este cubre un problema puramente local: la máquina de desarrollo se queda sin RAM al levantar Docker + `apps/api` + un bundler (Metro/webpack) en simultáneo, y la sesión de trabajo se cuelga. Todos los comandos son de solo lectura salvo los del punto 3 (parar Docker), que son los mismos que ya usás todos los días.

## 1. Señal/Síntoma

- El editor o la terminal deja de responder al arrancar `apps/api` (`nx serve api`) o el bundler de `apps/mobile` con Docker ya corriendo.
- `docker compose up` termina bien, pero cualquier proceso Node pesado que arranca después se cuelga o tarda de forma anormal.
- Un crash de VSCode/editor con `reason: 'oom'` en el mensaje.

## 2. Diagnóstico inmediato

**RAM libre, de un vistazo**:

```powershell
Get-CimInstance Win32_OperatingSystem |
  Select-Object @{N='RAM Total (GB)';E={[math]::Round($_.TotalVisibleMemorySize/1MB,2)}},
                @{N='RAM Libre (GB)';E={[math]::Round($_.FreePhysicalMemory/1MB,2)}},
                @{N='% Libre';E={[math]::Round(($_.FreePhysicalMemory/$_.TotalVisibleMemorySize)*100,1)}}
```

Umbrales confirmados empíricamente (máquina de 16GB total):

- **> 3 GB libres**: margen razonable para Docker + backend + bundler, de a uno por vez.
- **1–2 GB libres**: zona de riesgo — un build puede agotar lo que queda a mitad de camino.
- **< 1 GB libre**: no arrancar nada nuevo. Cerrar algo primero o reiniciar.

**Qué se está comiendo la RAM** (agrupado por nombre de proceso, no por PID individual):

```powershell
Get-Process | Group-Object ProcessName | ForEach-Object {
  [PSCustomObject]@{
    Nombre    = $_.Name
    Procesos  = $_.Count
    RAM_GB    = [math]::Round((($_.Group | Measure-Object WorkingSet64 -Sum).Sum)/1GB, 2)
  }
} | Sort-Object RAM_GB -Descending | Select-Object -First 15 | Format-Table -AutoSize
```

Sospechosos habituales: `Code` (VS Code, escala con extensiones/ventanas), `chrome`/`msedge`/`msedgewebview2` (una pestaña = un proceso), clientes Electron (`slack`, etc.), y `vmmemWSL` (ver punto 3 — el más engañoso de liberar bien).

**Espacio en disco** (paginación/memoria virtual también se degrada con poco disco libre, chequear junto con la RAM):

```powershell
Get-Volume | Where-Object { $_.DriveLetter } |
  Select-Object DriveLetter,
                @{N='Tamaño (GB)';E={[math]::Round($_.Size/1GB,1)}},
                @{N='Libre (GB)';E={[math]::Round($_.SizeRemaining/1GB,1)}},
                @{N='% Libre';E={[math]::Round(($_.SizeRemaining/$_.Size)*100,1)}}
```

Carpetas que suelen crecer sin que nadie las mire:

```powershell
# node_modules por proyecto - candidato #1 a limpiar en un repo que ya no se usa activamente
Get-ChildItem -Path C:\ -Recurse -Directory -Filter "node_modules" -ErrorAction SilentlyContinue -Depth 4 |
  ForEach-Object {
    $size = (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    [PSCustomObject]@{ Carpeta = $_.FullName; GB = [math]::Round($size/1GB,2) }
  } | Sort-Object GB -Descending | Select-Object -First 10 | Format-Table -AutoSize

# Carpeta temporal del usuario
Get-ChildItem $env:TEMP -Recurse -File -ErrorAction SilentlyContinue |
  Measure-Object Length -Sum | ForEach-Object { "{0:N2} GB en $env:TEMP" -f ($_.Sum/1GB) }
```

## 3. Mitigación

**Hallazgo confirmado, reproducible**: `docker compose down` (o cerrar Docker Desktop desde el ícono) **no libera** la RAM que usa la VM de WSL2 (`vmmemWSL` en la lista de procesos) — esa memoria queda reservada hasta que la VM se apaga explícitamente.

```powershell
# 1. Frenar los contenedores (desde la carpeta del proyecto)
docker compose down

# 2. El paso que realmente libera la RAM - sin esto, vmmemWSL se queda con varios GB reservados igual
wsl --shutdown

# 3. Confirmar que se liberó
Start-Sleep -Seconds 3
Get-CimInstance Win32_OperatingSystem | Select-Object -ExpandProperty FreePhysicalMemory |
  ForEach-Object { "{0:N2} GB libres" -f ($_/1MB) }
```

En corridas reales esto liberó entre 3 y 4 GB de un saque (de ~0.3-1.8 GB libres a ~6 GB libres), consistente cada vez que se probó.

Si además hace falta cerrar algo manualmente (RAM sigue baja después de `wsl --shutdown`), usar la lista del punto 2 para decidir qué cerrar — no hay un comando genérico seguro para "cerrar lo que no se está usando" sin criterio humano de por medio.

**Antes de volver a levantar Docker**, esperar a que el daemon esté listo en vez de lanzar `docker compose up` a ciegas:

```powershell
for ($i = 0; $i -lt 18; $i++) {
  docker info *> $null
  if ($LASTEXITCODE -eq 0) { Write-Host "Docker listo"; break }
  Start-Sleep -Seconds 5
}
```

## 4. Seguimiento de causa raíz

- Esto no es un bug de esta aplicación — es el comportamiento conocido de Docker Desktop en Windows con el backend WSL2. No hay fix de código posible desde este repo.
- Si se repite seguido, la mitigación de fondo es de infraestructura personal (más RAM física, o limitar la RAM máxima de la VM de WSL2 via `%UserProfile%\.wslconfig`, `[wsl2] memory=`), no algo a resolver por tanda de desarrollo.
- Rutina recomendada antes de una sesión pesada (Docker + backend + bundler): medir RAM (punto 2) → si < 3GB, liberar (punto 3) → levantar Docker y esperar a que responda → medir RAM de nuevo antes de sumar el proceso Node/bundler → al terminar, `docker compose down` + `wsl --shutdown` siempre juntos.

## 5. Docs relacionados

- [docs/engineering/06-DOCKER.md](../engineering/06-DOCKER.md) — Docker Compose de desarrollo, qué servicios levanta y por qué.
- [03-redis-caido.md](03-redis-caido.md) — mismo `docker-compose.yml`, otro síntoma (Redis específicamente, no la máquina entera).
