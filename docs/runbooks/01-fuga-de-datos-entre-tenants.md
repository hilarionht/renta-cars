# Runbook: fuga de datos entre tenants sospechada

`docs/09-SEGURIDAD.md §5` llama al aislamiento multi-tenant "el activo crítico número uno" del sistema: una fuga de datos entre companies es, por definición, la falla de seguridad más grave posible en esta plataforma. Este runbook trata cualquier sospecha con esa prioridad — incluso si termina siendo un falso positivo.

## 1. Señal/Síntoma

- Un usuario reporta ver datos (reservas, clientes, vehículos, facturas) que no le corresponden a su `companyId`.
- Un log de `AuditLogEntry` registra un intento de acceso cross-tenant bloqueado (`docs/09-SEGURIDAD.md §4`: "acceso a datos sensibles de otro tenant intentado y bloqueado" ya se audita como evento de dominio) — esto en sí mismo NO es una fuga (el bloqueo funcionó), pero un volumen anormal de estos eventos para el mismo actor es señal de un intento activo, no de un bug de aislamiento.
- Una respuesta HTTP contiene un `id` o campo que no pertenece a la `companyId` del JWT del request.

## 2. Diagnóstico inmediato

1. **Confirmar con datos, no con el reporte solo**: pedir el `correlationId` de la respuesta sospechosa (viene en toda respuesta vía `DomainExceptionFilter`/`ResponseEnvelopeInterceptor`, `docs/technical/03-BACKEND-ARCHITECTURE.md §8`) y buscarlo en logs — el log de acceso trae `companyId` del actor y los ids de los recursos devueltos.
2. **Descartar la explicación más común primero**: ¿el actor tiene un rol `System` (`scope: null` en `identity.roles`)? Un rol System es intencionalmente cross-company para ciertos flujos de plataforma — no es una fuga si el actor es, en efecto, un rol de sistema operando como se diseñó.
3. **Verificar RLS directo en Postgres** (bypasea la capa de aplicación, aísla si el bug está en la app o en la política RLS): conectar como el rol `app_runtime` (no como `migrator`, que está exento de RLS) con `SET LOCAL app.current_company_id = '<companyId-del-actor>'` y correr la query que devolvió el dato ajeno directo contra la tabla — si RLS ya filtra correctamente a nivel SQL, el problema está en la capa de aplicación (un repositorio que no pasó `companyId`, o un caso de uso que confía en un id recibido del cliente sin re-validar pertenencia); si RLS mismo devuelve la fila ajena, la política de RLS de esa tabla tiene un bug (revisar la migración que la creó, `docs/persistence/07-MIGRACIONES.md`).
4. **Revisar el trace del request** en Tempo (Grafana → Explore → Tempo, `localhost:3001`) filtrando por el `correlationId` — el span de Prisma muestra la query ejecutada; confirmar si el filtro `company_id` está presente en el `WHERE` real.

## 3. Mitigación

- Si el actor es real (no un bug, alguien está explotando algo): revocar sus sesiones activas ya mismo — `SessionSecurityService` ya soporta invalidar todas las sesiones de un usuario (mismo mecanismo que usa ante reutilización de refresh token detectada, `docs/09-SEGURIDAD.md §1`).
- Si es un bug de aislamiento en un endpoint específico: usar `EnabledProductModules` (`CompanySettings`) para desactivar ese módulo de producto para todas las companies afectadas mientras se prepara el fix — mitigación de negocio más rápida que un rollback completo de despliegue (`docs/technical/08-DEVOPS.md §7`), igual que para cualquier regresión — ver `04-rollback-de-despliegue.md` si el módulo entero necesita revertirse.
- Nunca "arreglar en caliente" con una query manual sobre la base — cualquier corrección de datos pasa por el mismo camino auditado que el resto del sistema (`docs/09-SEGURIDAD.md §4`: los registros de auditoría son append-only, ninguna corrección de datos que toque el historial es invisible).

## 4. Seguimiento de causa raíz

- Si el bug estaba en la capa de aplicación: buscar el mismo patrón (repositorio/caso de uso) en otros módulos — un olvido de `companyId` en un `ReadTransaction.run()`/`UnitOfWork.run()` suele repetirse por copiar el mismo esqueleto de handler.
- Si el bug estaba en RLS: agregar el escenario exacto como test de integración en `*.integration.spec.ts` del módulo afectado (Testcontainers, RLS real — nunca un mock, `docs/engineering/04-TESTING-FOUNDATION.md §5`).
- Documentar el incidente y su causa en `docs/persistence/10-DECISIONES.md` si el fix cambia algún patrón ya establecido (no si es simplemente un bug puntual de un handler).

## 5. Docs relacionados

- `docs/09-SEGURIDAD.md §5` — por qué el aislamiento es la prioridad número uno.
- `ADR-0004` — diseño completo de multi-tenancy (aislamiento lógico, no físico).
- `docs/technical/04-PERSISTENCE.md §5` — RLS + Prisma Client Extension de `companyId`.
- `docs/05-CONVENCIONES-BACKEND.md §7` — scoping de tenant obligatorio en repositorios.
