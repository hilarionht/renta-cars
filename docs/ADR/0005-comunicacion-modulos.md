# ADR-0005 — Comunicación entre Módulos: Puertos Síncronos + Eventos In-Process

## Estado
Aceptado

## Contexto
En un Monolito Modular ([ADR-0001](0001-modular-monolith.md)), los módulos no se comunican por red, pero deben mantener las mismas fronteras de acoplamiento que tendrían si fueran servicios independientes — de lo contrario, el "monolito modular" degrada a un monolito con carpetas y la extracción futura a servicios se vuelve inviable.

## Decisión
Dos mecanismos exclusivos de comunicación entre módulos, sin excepciones:

1. **Síncrona, para datos/operaciones inmediatas**: interfaces de puerto (`XxxPort`) publicadas por el módulo dueño, inyectadas por DI en el módulo consumidor. Ejemplo: `CustomerLookupPort` publicado por `customers`, consumido por `reservations`.
2. **Asíncrona, para reacciones desacopladas**: eventos de dominio versionados, publicados a un bus de eventos in-process (implementación inicial: `EventEmitter` de NestJS detrás de un puerto `DomainEventPublisher`), consumidos por listeners en el módulo interesado. Ejemplo: `notifications` reacciona a `ReservationConfirmed.v1` sin que `reservations` sepa que `notifications` existe.

Prohibido explícitamente: import de `domain/`, `application/` o `infrastructure/` de un módulo distinto fuera de su `index.ts` público; acceso directo a repositorios/tablas de otro módulo; transacciones de base de datos que crucen la frontera de dos módulos.

## Alternativas consideradas

1. **Import directo entre módulos sin restricción** (lo que ocurre por defecto en un monolito sin disciplina).
   - Descartada: es la causa raíz del acoplamiento que degrada monolitos en el tiempo; haría inviable extraer un módulo a servicio en el futuro sin una reescritura mayor.

2. **Bus de mensajes real (Redis Streams/Kafka/RabbitMQ) desde el día uno, incluso para comunicación in-process**.
   - Descartada para v1.0: introduce infraestructura y latencia operativa (otro componente a monitorear, otro punto de fallo) para un problema que hoy se resuelve correctamente en memoria, dentro del mismo proceso. Se deja preparado el reemplazo (ver Consecuencias) para cuando el volumen o la necesidad de desacople físico lo justifique.

3. **Solo eventos, sin puertos síncronos** (arquitectura 100% orientada a eventos).
   - Descartada: forzar cada consulta de datos simple (p. ej. "¿este cliente existe?") a un flujo asíncrono de request/reply por eventos añade complejidad y latencia sin beneficio, cuando una llamada directa a una interfaz en el mismo proceso es igual de desacoplada y mucho más simple.

4. **Puertos síncronos + eventos in-process, reemplazables independientemente** (elegida).

## Consecuencias

**Positivas**
- El código de un módulo productor de eventos no cambia el día que el bus in-process se reemplace por un broker real — solo cambia el adaptador que implementa `DomainEventPublisher`.
- Las fronteras entre módulos quedan explícitas y verificables (Nx boundaries, [ADR-0006](0006-monorepo-nx.md)), facilitando onboarding de nuevos desarrolladores durante los próximos 10 años.
- Un futuro segundo producto (Taller) puede reaccionar a eventos de Rental (p. ej. un vehículo que termina su vida útil de alquiler entra a Taller) sin que ninguno de los dos módulos importe código del otro.

**Negativas / trade-offs aceptados**
- Consistencia entre módulos es eventual, no transaccional — aceptado explícitamente (ver [02-ARQUITECTURA.md §5.4](../02-ARQUITECTURA.md)); si una operación de negocio real exige atomicidad estricta cross-módulo, es señal de que el bounded context está mal cortado, y se resuelve rediseñando el corte, no forzando una transacción distribuida.
- El bus in-process no sobrevive a un reinicio del proceso a mitad de una cadena de eventos — aceptable en v1.0 dado el volumen; se revisita al introducir un broker persistente si la necesidad de garantías de entrega más fuertes aparece.

## Revisión
Se reevalúa el adaptador del bus de eventos (in-process → broker real) cuando: (a) se extrae el primer módulo a servicio independiente, o (b) el volumen de eventos o la necesidad de garantías de entrega/reintento supera lo que un `EventEmitter` in-process puede ofrecer de forma confiable.
