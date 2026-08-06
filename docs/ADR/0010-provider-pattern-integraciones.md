# ADR-0010 — Provider Pattern para toda Integración Externa

## Estado
Aceptado

## Contexto
La Plataforma debe integrar múltiples servicios externos (WhatsApp, Email, SMS, Push, Stripe, Mercado Pago, Google Maps, OCR, IA, Firma Digital, Storage), con la certeza histórica de que proveedores concretos cambian con el tiempo (por costo, cobertura geográfica, o discontinuación del servicio) mientras la necesidad de negocio (enviar una notificación, cobrar un pago, almacenar un archivo) permanece estable durante los 10 años de vida esperados de la Plataforma.

## Decisión
Toda integración externa se modela como un **puerto** (interfaz) definido junto al módulo consumidor de Plataforma o Producto, con su **adaptador** concreto viviendo en `platform/integration-providers/infrastructure/providers/`. Ningún módulo de dominio o aplicación conoce el nombre de un SDK, formato de payload, o URL de un proveedor específico. Detalle por integración en [11-INTEGRACIONES.md](../11-INTEGRACIONES.md).

## Alternativas consideradas

1. **Llamar a los SDKs de proveedores directamente desde los casos de uso que los necesitan** (p. ej. `payments` importa el SDK de Stripe directamente en su Command Handler).
   - Descartada: acopla la capa de aplicación a un proveedor concreto; cambiar de proveedor (o agregar uno adicional, como ya se requiere con Stripe + Mercado Pago desde v1.0) obliga a modificar el caso de uso en lugar de agregar un adaptador nuevo. También dificulta testear el caso de uso sin llamar (o mockear pesadamente) el SDK real.

2. **Un módulo de integraciones "genérico" con un único método `send(config)` para todo tipo de integración.**
   - Descartada: diluye la seguridad de tipos y la semántica de cada integración (enviar un WhatsApp no es lo mismo que capturar un pago); un puerto específico por capacidad (`PaymentGatewayPort`, `NotificationSenderPort`, `StorageProviderPort`) mantiene contratos claros y verificables en tiempo de compilación.

3. **Puerto específico por capacidad + adaptador por proveedor, agrupados en `integration-providers`** (elegida).

## Consecuencias

**Positivas**
- Cambiar de proveedor de pago, email o storage es un cambio acotado a `infrastructure/`, sin tocar dominio ni aplicación de ningún módulo consumidor — validado ya en v1.0 al soportar dos gateways de pago (Stripe y Mercado Pago) desde el inicio sin duplicar lógica de negocio de `payments`.
- Los casos de uso se testean con fakes del puerto, sin necesidad de sandbox real del proveedor para tests unitarios/de aplicación ([10-TESTING.md §3](../10-TESTING.md)).
- Webhooks entrantes de proveedores se traducen a eventos de dominio propios antes de tocar cualquier lógica de negocio, evitando que el formato de un proveedor externo se filtre al modelo de dominio.

**Negativas / trade-offs aceptados**
- Cada integración nueva requiere definir explícitamente su puerto antes de integrar — ligeramente más trabajo inicial que "llamar al SDK y listo"; se acepta porque el costo de no hacerlo (reescribir lógica de negocio al cambiar de proveedor) es mayor a lo largo de 10 años.

## Revisión
Esta decisión no se revisa por proveedor (cada proveedor nuevo simplemente agrega un adaptador); se revisa solo si aparece una necesidad de integración que el patrón puerto/adaptador no pueda expresar razonablemente (no identificado ningún caso a la fecha).
