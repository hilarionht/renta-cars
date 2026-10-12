# Load testing multi-tenant

Fase 6 (Hardening), último ítem del roadmap: "Pruebas de carga multi-tenant (aislamiento de datos bajo concurrencia real)" (`docs/01-ROADMAP.md §8`). No es un benchmark de performance genérico — verifica específicamente que RLS + el Prisma Client Extension de `companyId` (`docs/persistence/06-RLS.md §1`) no dejan fugar datos de una company a otra bajo concurrencia real. `docs/09-SEGURIDAD.md §5` llama al aislamiento entre tenants "el activo crítico número uno" — esta es la prueba dirigida a ese riesgo específico.

## Cómo correr

Con `apps/api` + Postgres/Redis ya levantados (`docker compose up -d` + `npx nx serve api`):

```bash
npm run load-test:setup      # siembra companies + admins + customers taggeados
npm run load-test:run        # corre el escenario de aislamiento contra ellos
npm run load-test:teardown   # limpia todo lo sembrado
```

`load-test:setup` escribe `tooling/load-testing/.output/companies.json` (gitignored — contiene `accessToken`s reales y la password del admin sembrado, aunque sean datos sintéticos). `load-test:run` lo lee.

### Parámetros (variables de entorno)

| Variable                 | Default                 | Uso                                                    |
| ------------------------ | ----------------------- | ------------------------------------------------------ |
| `API_BASE_URL`           | `http://localhost:3000` | Contra qué instancia de `apps/api` corre (setup y run) |
| `COMPANIES`              | `6`                     | Cuántas companies siembra `setup`                      |
| `CUSTOMERS_PER_COMPANY`  | `3`                     | Cuántos customers taggeados por company                |
| `BURSTS`                 | `3`                     | Cuántas ráfagas dispara el escenario k6                |
| `BURST_INTERVAL_SECONDS` | `35`                    | Espera entre ráfagas                                   |

## Por qué la escala es chica

El rate-limit de `ThrottlerGuard` (`auth` 8/60s, `general` 20/60s — `docs/persistence/10-DECISIONES.md #104`/`#106`) es por IP+ruta, no por company: con toda la carga saliendo de una sola máquina, un volumen alto autolimitaría el test casi de inmediato, sin señal real. Los defaults (`COMPANIES=6`, `CUSTOMERS_PER_COMPANY=3`) se mantienen deliberadamente bajo ese presupuesto — no se tocó el rate-limit para esta tanda (decisión explícita del usuario, ver `#107`). El patrón ráfaga-y-espera del script k6 (todos los VUs disparan juntos, después duermen) da concurrencia real en el momento que importa (el pool de conexiones/RLS bajo presión simultánea) sin necesitar RPS agregado alto.

## Cómo leer un fallo

- **`tenant_isolation_violations` > 0 / threshold `count==0` cruzado**: esto es lo único que de verdad importa. Significa que una company vio datos de otra — un incidente de seguridad real, no un problema de performance. Ver `docs/runbooks/01-fuga-de-datos-entre-tenants.md`.
- **`http_req_failed` alto / latencia elevada**: señal de performance normal (pool de conexiones saturado, ver `docs/runbooks/02-pool-de-conexiones-postgres-agotado.md`), no de aislamiento — no implica una fuga.
- **`429` inesperados**: probablemente `COMPANIES`/`CUSTOMERS_PER_COMPANY` configurados por arriba del presupuesto de throttle (ver sección anterior) — no es un fallo del test en sí, hay que bajar la escala.

## Qué NO hace este test

- No corre en CI — no es parte del pipeline de PR.
- No calibra números de latencia/error-rate contra tráfico de producción real — mismo criterio que el resto de Fase 6 (`docs/technical/06-OBSERVABILITY.md §6`).
- No genera un dashboard de Grafana nuevo — el dashboard de "ruido por tenant" sigue explícitamente diferido (`docs/technical/06-OBSERVABILITY.md §6`) hasta que exista tráfico distinguible de más de un tenant; este load test genera exactamente ese tráfico, pero construir el dashboard es trabajo aparte.
