# ADR-0001 — Monolito Modular en lugar de Microservicios

## Estado
Aceptado

## Contexto
La Plataforma debe soportar múltiples productos de negocio (Rental, y a futuro Taller, Hotel, Clínica, etc.) durante al menos 10 años, con un equipo que crecerá gradualmente desde un tamaño pequeño. Es necesario decidir la granularidad de despliegue del backend: un único desplegable modular, o servicios independientes por bounded context desde el inicio.

## Decisión
Se construye un **Monolito Modular**: un único desplegable NestJS (`apps/api`) que compone módulos con fronteras de código estrictas (una por bounded context), sin llamadas de red entre ellos. La comunicación entre módulos es en-proceso, vía puertos de aplicación (síncrona) y bus de eventos in-process (asíncrona) — ver [ADR-0005](0005-comunicacion-modulos.md).

## Alternativas consideradas

1. **Microservicios desde el día uno**: cada bounded context como servicio desplegable independiente, con su propia base de datos.
   - Ventaja: escalado y despliegue independiente por servicio, aislamiento de fallos.
   - Descartada: la complejidad operativa (orquestación, service discovery, observabilidad distribuida, manejo de transacciones distribuidas/sagas, versionado de contratos entre servicios) es un costo que se paga desde el primer día, sin que exista todavía la carga o el equipo que lo justifique. Para un equipo pequeño construyendo el primer producto, esto ralentiza la entrega sin beneficio medible.

2. **Monolito sin fronteras internas explícitas**: un único proyecto NestJS sin disciplina de módulos ni límites de importación.
   - Ventaja: velocidad máxima al inicio.
   - Descartada: es exactamente el patrón que degrada en 2-3 años a un sistema donde nadie entiende las dependencias reales, y donde separar código en el futuro (a servicios, o incluso a módulos) se vuelve un proyecto de meses. Contradice directamente el objetivo de longevidad de 10 años.

3. **Monolito Modular** (elegida): fronteras de bounded context reales, impuestas en tiempo de compilación (Nx module boundaries, ver [ADR-0006](0006-monorepo-nx.md)), sin llamadas de red internas.

## Consecuencias

**Positivas**
- Velocidad de desarrollo cercana a un monolito clásico: sin latencia de red entre módulos, sin necesidad de orquestar múltiples despliegues para un cambio que toca dos módulos.
- Cualquier bounded context puede extraerse a un servicio independiente en el futuro con costo acotado: sus fronteras de código y de datos (schema de Postgres propio, ver [04-MODELO-DATOS.md](../04-MODELO-DATOS.md)) ya están definidas.
- Transacciones dentro de un módulo permanecen ACID simples; no se paga el costo de consistencia eventual donde no se necesita.

**Negativas / trade-offs aceptados**
- No hay aislamiento de fallos ni escalado independiente por módulo hasta que se decida extraer alguno — aceptable porque no existe hoy una necesidad de escalado diferenciado real.
- Requiere disciplina activa (enforced por herramienta, no solo por convención) para que "modular" no degrade a "monolito con carpetas" — mitigado por Nx boundaries en CI.

## Revisión
Se revisa esta decisión si: (a) un módulo específico requiere escalado independiente demostrado por métricas reales, o (b) el equipo crece a un tamaño donde el despliegue conjunto se vuelve el cuello de botella de entrega, no antes.
