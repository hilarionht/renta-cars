# Runbooks Operativos

Este directorio contiene procedimientos operativos para incidentes concretos — qué hacer cuando algo ya está pasando, no arquitectura ni diseño. Cada runbook asume que quien lo lee tiene acceso a producción/staging (o al entorno local equivalente) y sigue los pasos en orden.

**Relación con el resto de `docs/`**: un runbook nunca redefine una decisión de arquitectura — solo la opera. Donde un runbook cita un mecanismo (rollback, rotación de JWT, aislamiento de tenant), ese mecanismo ya está diseñado en otro documento; el runbook explica cómo ejecutarlo bajo presión, no por qué existe. Los **umbrales numéricos de alerta** (`tooling/observability/alert-rules.yml`) tampoco se fijan aquí — siguen sin calibrar contra tráfico real hasta Fase 6 con datos de producción, mismo criterio que [docs/technical/06-OBSERVABILITY.md §6](../technical/06-OBSERVABILITY.md).

## Índice

| Runbook                                                                                | Cuándo se usa                                                                                                    |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [01-fuga-de-datos-entre-tenants.md](01-fuga-de-datos-entre-tenants.md)                 | Se sospecha que un tenant vio datos de otro — el incidente de seguridad más grave posible en esta plataforma     |
| [02-pool-de-conexiones-postgres-agotado.md](02-pool-de-conexiones-postgres-agotado.md) | El pool de conexiones a Postgres se satura, requests empiezan a esperar/fallar                                   |
| [03-redis-caido.md](03-redis-caido.md)                                                 | Redis no responde — hoy solo respalda el health check, pero el impacto crece con cada tanda futura que lo adopte |
| [04-rollback-de-despliegue.md](04-rollback-de-despliegue.md)                           | Un despliegue reciente causó una regresión y hay que revertirlo                                                  |
| [05-rotacion-de-secreto-de-proveedor.md](05-rotacion-de-secreto-de-proveedor.md)       | Rotar la credencial de un proveedor externo (comprometida, vencida, o por política)                              |

## Cómo leer un runbook

Los 5 siguen la misma estructura:

1. **Señal/Síntoma** — qué se observaría (panel de Grafana, alerta de Prometheus, log, comportamiento reportado) que dispara este runbook.
2. **Diagnóstico inmediato** — pasos concretos para confirmar la causa antes de actuar, con nombres reales de servicio (Grafana en `localhost:3001`, Prometheus en `localhost:9090`, servicios de `docker-compose.yml`/`docker-compose.observability.yml`).
3. **Mitigación** — qué hacer para frenar el impacto, no necesariamente resolver la causa raíz de inmediato.
4. **Seguimiento de causa raíz** — qué investigar después de que el impacto inmediato está controlado.
5. **Docs relacionados** — dónde está diseñado el mecanismo que este runbook opera.

## Alcance

- Ningún runbook fija un número de alerta calibrado — eso es Fase 6 con tráfico real ([01-ROADMAP.md §8](../01-ROADMAP.md)).
- No cubre paging/on-call (a quién se notifica, con qué herramienta) — decisión de negocio no tomada todavía.
- Grounded en mecanismos ya diseñados en `docs/09-SEGURIDAD.md`, `docs/technical/`, no inventa comportamiento nuevo — donde falta un mecanismo real (p. ej. storage compartido del rate limiter), el runbook lo dice explícitamente en vez de simular que existe.
