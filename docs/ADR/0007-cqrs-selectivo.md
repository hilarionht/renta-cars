# ADR-0007 — CQRS Selectivo (separación conceptual, no stores separados)

## Estado
Aceptado

## Contexto
CQRS (Command Query Responsibility Segregation) puede aplicarse en un espectro que va desde "separar mentalmente comandos y consultas dentro del mismo modelo" hasta "modelos de lectura y escritura con almacenamiento físicamente distinto, sincronizados por eventos". El brief del proyecto pide usar CQRS "únicamente cuando aporte valor" — es necesario fijar dónde está esa línea para evitar que cada desarrollador la trace en un lugar distinto.

## Decisión
Se aplica **separación conceptual Command/Query dentro de la capa Application de cada módulo**, sin almacenamiento separado:

- **Commands**: pasan por el modelo de dominio rico (agregados, invariantes), persisten vía repositorio, publican eventos.
- **Queries**: pueden leer directamente vía Prisma con proyecciones optimizadas para el caso de uso de lectura, sin pasar por el modelo de dominio completo, siempre dentro de `application/`o `infrastructure/` (nunca exponiendo esto a `domain/`).

No se introduce CQRS con read-model materializado en un store separado (ni event sourcing) en ningún módulo para v1.0, con una única excepción evaluable: `reports`, si el volumen de datos transaccionales hace que las queries de reportería degraden el rendimiento del modelo transaccional — decisión que se toma con datos reales de producción, no de forma anticipada.

## Alternativas consideradas

1. **CQRS completo (read model + write model separados, sincronizados por eventos) en todos los módulos.**
   - Descartada: para módulos como `customers` o `vehicles`, con volumen y complejidad de consulta moderados, mantener dos modelos sincronizados es sobreingeniería — introduce latencia de sincronización y superficie de bugs sin un problema real que lo justifique.

2. **Sin separación Command/Query en absoluto (todo pasa por el mismo modelo de dominio, incluidas listas paginadas complejas).**
   - Descartada: forzar cada listado con filtros (p. ej. "vehículos disponibles en un rango de fechas, en una sucursal, ordenados por tarifa") a reconstituirse como agregados de dominio completos es ineficiente y no aporta ninguna garantía de negocio adicional — las queries de lectura no mutan estado, no necesitan el mismo rigor de invariantes que un Command.

3. **Separación conceptual sin duplicar almacenamiento** (elegida).

## Consecuencias

**Positivas**
- Se obtiene el beneficio principal de CQRS (las queries no cargan con la complejidad del modelo de escritura) sin el costo de sincronización de dos stores.
- El código sigue siendo predecible: un Command Handler siempre pasa por el dominio; un Query Handler siempre es de solo lectura y puede optimizarse libremente sin temor a introducir efectos secundarios.
- Deja una ruta de evolución clara y acotada (solo `reports`, solo si se justifica) en vez de una regla ambigua aplicada de forma inconsistente módulo por módulo.

**Negativas / trade-offs aceptados**
- Las queries complejas de reportería sobre el modelo transaccional pueden, en volúmenes altos, competir por recursos con las escrituras — mitigado en primera instancia con índices y, si no alcanza, con la excepción prevista para `reports` (Fase 4/6 del roadmap).

## Revisión
Se reevalúa específicamente para `reports` en Fase 4/6 del roadmap ([01-ROADMAP.md](../01-ROADMAP.md)) con datos reales de volumen y latencia. No se reevalúa de forma especulativa para el resto de los módulos.
