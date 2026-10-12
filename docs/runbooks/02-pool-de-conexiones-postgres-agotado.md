# Runbook: pool de conexiones Postgres agotado

## 1. Señal/Síntoma

- Requests empiezan a tardar mucho o a fallar con timeout justo en la capa de Prisma, sin que la query en sí sea lenta.
- Alerta `DbConnectionPoolNearSaturation` (`tooling/observability/alert-rules.yml`) — placeholder no calibrado, umbral real pendiente de Fase 6 con tráfico de producción.
- Dashboard "infra-use" (Grafana `localhost:3001`) — panel de `db_client_connection_count{db_system_name="postgresql"}`, método USE (`docs/technical/06-OBSERVABILITY.md §3`).

## 2. Diagnóstico inmediato

1. Confirmar en el dashboard "infra-use" si el conteo de conexiones activas está efectivamente alto y sigue subiendo (no un pico transitorio) — hoy no hay una métrica de tamaño máximo del pool expuesta para comparar contra un límite exacto, así que la tendencia importa más que el número absoluto.
2. Revisar Tempo (Grafana → Explore, filtrar por `db.system=postgresql`) para identificar si el tiempo se está yendo en conexiones esperando el pool (`db_client_operation_duration_seconds` alto de forma generalizada, no en una query puntual) vs. una query específica lenta que está reteniendo conexiones más tiempo del normal.
3. Verificar si el patrón coincide con un despliegue reciente — una migración con un `ALTER TABLE` bloqueante, o un nuevo handler que no cierra una transacción correctamente, son las causas más comunes de agotamiento súbito. Ver `04-rollback-de-despliegue.md` si el patrón coincide con el timing de un deploy.
4. Confirmar `pg_isready` contra el contenedor `renta-postgres-1` (`docker compose exec postgres pg_isready -U renta`) — descartar que Postgres mismo esté degradado (CPU/IO), no solo el pool del lado de la aplicación.

## 3. Mitigación

- Si el patrón coincide con un deploy reciente: rollback (`04-rollback-de-despliegue.md`) es más rápido que diagnosticar bajo presión.
- Si es una query específica reteniendo conexiones: identificarla vía trace y, si es posible, desactivar el flujo que la dispara vía `EnabledProductModules` mientras se prepara un fix, mismo mecanismo de mitigación rápida que `01-fuga-de-datos-entre-tenants.md` usa para un bug de aislamiento.
- Reiniciar réplicas de `apps/api` libera conexiones huérfanas rápido, pero es un parche temporal — si el pool vuelve a saturarse en minutos, el problema es estructural (query/handler específico), no una casualidad de carga.

## 4. Seguimiento de causa raíz

- Si la causa fue una query lenta: agregar un índice o revisar el plan de ejecución (`EXPLAIN ANALYZE`) — sin un baseline de performance de queries todavía (Fase 6, ítem "cache/performance" del roadmap, tanda separada), este es el primer dato real que alimenta esa tanda futura.
- Si la causa fue una transacción no cerrada: buscar el mismo patrón de `UnitOfWork.run()`/`ReadTransaction.run()` sin awaitar correctamente en otros handlers del mismo módulo.
- Si el pool está genuinamente subdimensionado para el tráfico real (no un bug): el tamaño del pool es configuración, no código — ajustar y documentar el nuevo valor en `docs/persistence/10-DECISIONES.md` si cambia el criterio original.

## 5. Docs relacionados

- `docs/technical/06-OBSERVABILITY.md §3` — método USE, por qué el pool de Postgres es una de las métricas de infraestructura de primera clase.
- `docs/technical/04-PERSISTENCE.md` — `UnitOfWork`/`ReadTransaction`, cómo se manejan las transacciones.
- `docs/technical/08-DEVOPS.md §6` — apagado ordenado (cierre del pool de Prisma antes de terminar una réplica).
