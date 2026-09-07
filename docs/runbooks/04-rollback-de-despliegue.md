# Runbook: rollback de un despliegue

Este runbook operacionaliza el proceso ya diseñado en `docs/technical/08-DEVOPS.md §7` — no introduce ningún mecanismo nuevo, solo lo convierte en una lista de pasos accionables bajo presión.

## 1. Señal/Síntoma

- Un despliegue reciente coincide en el tiempo con: tasa de error elevada (alerta `HighHttpErrorRate`), latencia elevada (`HighHttpLatencyP95`), o un reporte funcional concreto (un flujo de negocio roto).
- El dashboard "golden signals" (Grafana `localhost:3001`) muestra el cambio de comportamiento empezando justo después del deploy.

## 2. Diagnóstico inmediato

1. Confirmar que el problema efectivamente empezó con el deploy, no con otra causa concurrente (ver `02-pool-de-conexiones-postgres-agotado.md`/`03-redis-caido.md` si el patrón apunta a infraestructura en vez de código nuevo).
2. Identificar el SHA de la imagen actualmente desplegada y el SHA de la última versión conocida-buena (`docs/technical/08-DEVOPS.md §3`: cada imagen se tagea con el SHA del commit, tag inmutable — nunca se sobrescribe).
3. Evaluar si el impacto está acotado a un solo módulo de producto: si es así, `EnabledProductModules` (`CompanySettings`) es más rápido que un rollback completo — desactivar el módulo para las companies afectadas mientras se decide el rollback, mismo mecanismo que `01-fuga-de-datos-entre-tenants.md` y `02-pool-de-conexiones-postgres-agotado.md` ya usan como mitigación rápida (`docs/technical/08-DEVOPS.md §7`, último punto).

## 3. Mitigación — rollback de código

1. Re-desplegar el tag de imagen inmutable anterior (SHA identificado en el paso 2) — posible en minutos precisamente porque las imágenes son inmutables y versionadas (`docs/technical/08-DEVOPS.md §3`).
2. El balanceador no debe enrutar tráfico a una réplica hasta que `/health/ready` responda `ok` (`docs/technical/08-DEVOPS.md §7`/`§6`) — el rollback está gateado por salud, no por tiempo fijo; no forzar tráfico antes de esa señal.
3. **Base de datos**: las migraciones son forward-only por diseño (`docs/persistence/07-MIGRACIONES.md`, `docs/technical/08-DEVOPS.md §7`) — no existe (ni se ejecuta) un script de downgrade de schema. El patrón _expand/contract_ es precisamente lo que permite que un rollback de código común no necesite rollback de base de datos: una columna nueva nullable no rompe el código viejo que no la conoce. Confirmar que el despliegue que se está revirtiendo efectivamente siguió ese patrón antes de asumir que el rollback de código alcanza solo.
4. **Caso excepcional** (una migración no-aditiva que rompió compatibilidad hacia atrás — situación que ya debería haberse evitado por diseño): no se revierte el schema; se resuelve con una migración correctiva hacia adelante (_hotfix forward_), nunca revirtiendo — mismo criterio ya fijado, no una excepción nueva de este runbook.

## 4. Seguimiento de causa raíz

- Confirmar en CI qué check debería haber atrapado la regresión antes de merge (`docs/technical/08-DEVOPS.md §2.1`) y si faltó cobertura de test, no solo "mala suerte".
- Si el incidente reveló que un módulo necesitó `EnabledProductModules` como mitigación de emergencia, considerar si ese flujo necesita un test e2e dedicado que hoy no existe.

## 5. Docs relacionados

- `docs/technical/08-DEVOPS.md §6-7` — deploy gateado por salud, rollback, migraciones forward-only.
- `docs/persistence/07-MIGRACIONES.md` — patrón expand/contract.
- `docs/technical/08-DEVOPS.md §2.2` — pipeline de rama principal (build, publicación de imagen, despliegue).
