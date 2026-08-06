# ADR-0002 — DDD Pragmático (táctico completo, estratégico selectivo)

## Estado
Aceptado

## Contexto
DDD ofrece un espectro amplio de herramientas: desde patrones tácticos (entidades, agregados, value objects, eventos) hasta patrones estratégicos avanzados (context mapping formal, anticorruption layers explícitas en cada frontera, event sourcing, sagas). Aplicar el espectro completo en todos los módulos desde el día uno tiene un costo de complejidad que no todos los módulos justifican (p. ej. `settings` no necesita el mismo rigor de modelado que `reservations`).

## Decisión
Se aplica DDD **táctico** de forma consistente en todos los módulos de negocio: entidades con identidad, agregados con invariantes explícitos, value objects inmutables, servicios de dominio para reglas que no pertenecen a un único agregado, y eventos de dominio como mecanismo de comunicación entre bounded contexts.

Se aplica DDD **estratégico** de forma selectiva: bounded contexts y su lenguaje ubicuo se definen siempre (ver [03-DOMINIO.md](../03-DOMINIO.md)), pero anticorruption layers formales y context mapping detallado solo se documentan explícitamente donde dos contextos modelan el mismo concepto de forma genuinamente distinta (ejemplo real: la traducción entre `Reservation`/`Vehicle` de Rental Operations y `resource`/`slot` genérico de Scheduling).

Se descarta explícitamente, para v1.0: event sourcing como estrategia de persistencia, sagas orquestadas complejas, y CQRS con almacenamiento de lectura/escritura separado en todos los módulos (ver [ADR-0007](0007-cqrs-selectivo.md) para el tratamiento específico de CQRS).

## Alternativas consideradas

1. **DDD completo en todos los módulos** (event sourcing, sagas, CQRS con stores separados en todo el sistema).
   - Descartada: el costo de infraestructura y curva de aprendizaje no se justifica para módulos como `settings`, `files` o `audit`, cuya complejidad de negocio es baja. Aplicar el patrón más pesado disponible a todo el sistema es sobreingeniería, explícitamente contraria a los principios de [00-VISION.md](../00-VISION.md).

2. **Sin DDD, modelo anémico (entidades como bolsas de datos, lógica en services genéricos)**.
   - Descartada: es el patrón que típicamente produce "god services" con cientos de líneas de `if` de negocio, difícil de testear y de razonar, exactamente lo opuesto a la mantenibilidad a 10 años que se busca.

3. **DDD táctico siempre + estratégico donde el caso real lo exige** (elegida).

## Consecuencias

**Positivas**
- Las reglas de negocio complejas (disponibilidad, solapamiento de reservas, máquinas de estado) tienen un lugar único y explícito donde vivir y testearse (ver [10-TESTING.md §2](../10-TESTING.md)).
- El lenguaje ubicuo por bounded context reduce ambigüedad entre negocio y equipo técnico, y entre equipos de distintos productos futuros.
- No se paga el costo de infraestructura de event sourcing/CQRS completo sin necesidad demostrada.

**Negativas / trade-offs aceptados**
- Si en el futuro un módulo necesita alta trazabilidad histórica de cambios de estado (auditoría de negocio fina, no solo auditoría de seguridad), podría requerir introducir event sourcing puntualmente en ese módulo — decisión que se tomará como ADR nuevo cuando/si ese caso aparece, no de forma preventiva.

## Revisión
Se reevalúa módulo por módulo, nunca de forma global: cada módulo nuevo declara, en su documentación, si necesita patrones estratégicos adicionales, con justificación concreta.
