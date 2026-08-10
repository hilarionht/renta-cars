## Qué cambia y por qué

<!-- El "por qué" es lo que el diff no puede explicar por sí solo - no una relatoría de
qué archivos se tocaron (docs/engineering/09-CONTRIBUTING.md §3). -->

## Checklist

- [ ] `nx affected --target=lint,typecheck,test` pasa localmente (o se confía en CI para el veredicto final, pero no se abre un PR sabiendo que falla).
- [ ] Si el cambio afecta a un agregado o regla de negocio: tests unitarios de dominio nuevos/actualizados.
- [ ] Si el cambio afecta a un adaptador de infraestructura: test de integración con Testcontainers.
- [ ] Si el cambio persiste datos nuevos con `companyId`: incluye el escenario de fuga cross-tenant obligatorio.
- [ ] Changeset agregado si el cambio afecta a `apps/api` o `apps/web-admin` en comportamiento visible.
- [ ] Documentación de `docs/` actualizada si el cambio contradice o extiende una decisión ya escrita.
