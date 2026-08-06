# 01 — Actores del Dominio

Este documento identifica **quién participa** en el negocio de alquiler de vehículos y **qué responsabilidad tiene cada uno**. No describe pantallas, roles técnicos de RBAC ni permisos granulares — eso pertenece a la Plataforma (ver [09-SEGURIDAD.md](../09-SEGURIDAD.md) y [08-BOUNDARY.md](08-BOUNDARY.md)). Aquí un "actor" es cualquier persona, sistema u organización que **inicia una acción, recibe una consecuencia, o toma una decisión** dentro de los procesos de negocio.

Un mismo actor de negocio puede corresponder a uno o más roles técnicos (RBAC), y un rol técnico puede agrupar capacidades de más de un actor de negocio si la empresa es pequeña (p. ej. el dueño de una empresa de una sola sucursal puede ser, a la vez, Administrador de Empresa y Operador de Sucursal). El modelado de actores es independiente de esa configuración operativa.

## 1. Clasificación general

| Categoría | Actores |
|---|---|
| Actores humanos internos | Administrador de Empresa, Operador de Sucursal, Agente de Reservas, Responsable de Mantenimiento, Responsable Comercial/Financiero |
| Actores humanos externos | Cliente, Conductor Adicional, Proveedor de Servicios |
| Actores de sistema (internos a la Plataforma) | Motor de Disponibilidad (Calendar), Motor de Notificaciones, Motor de Auditoría, Motor de Reportes |
| Actores de sistema (externos, vía integración) | Pasarela de Pago, WhatsApp Business, Proveedor de Email/SMS, Proveedor de OCR, Proveedor de Firma Digital, Proveedor de Geolocalización |

## 2. Actores humanos internos

### 2.1 Administrador de Empresa

Representa a quien es dueño o responsable último de la empresa de alquiler (la `Company`, en términos de Plataforma) o de una de sus operaciones a nivel corporativo.

**Responsabilidades de negocio:**
- Da de alta y da de baja sucursales (`Branch`).
- Define política comercial: tarifas base, categorías de vehículo, políticas de cancelación, políticas de depósito de garantía.
- Da de alta y gestiona operadores, agentes de reservas y demás personal interno.
- Es responsable último frente a reguladores, aseguradoras y auditorías externas.
- Toma decisiones que exceden la operación diaria de una sucursal: apertura de nuevas líneas de flota, alianzas con proveedores, condiciones contractuales marco con clientes corporativos.

**No hace:** operación diaria de check-in/check-out (delega en Operador de Sucursal), aunque puede hacerlo si la empresa es pequeña.

### 2.2 Operador de Sucursal

Es quien ejecuta la operación física del alquiler en una sucursal concreta.

**Responsabilidades de negocio:**
- Recibe al cliente presencialmente, verifica su identidad y documentación.
- Realiza la entrega del vehículo (check-out): inspección de estado, registro de kilometraje y nivel de combustible, entrega física de llaves.
- Realiza la devolución del vehículo (check-in): inspección de estado, registro de daños o faltantes, cierre del ciclo de la reserva.
- Reporta incidencias de flota (daños, necesidad de mantenimiento) al Responsable de Mantenimiento.
- Ejecuta cancelaciones, extensiones y cambios de vehículo dentro de las políticas autorizadas por el Administrador de Empresa.

**Por qué es un actor distinto del Administrador:** su alcance de decisión está limitado a su sucursal y a la operación del día, mientras que el Administrador decide política. Esta distinción de negocio es la que luego justifica un scoping de `branchId` en la capa de autorización, sin que este documento prescriba cómo implementarlo.

### 2.3 Agente de Reservas

Gestiona la relación comercial previa a la operación física del alquiler. Puede ser una persona dedicada (call center, ventas) o una responsabilidad adicional del Operador de Sucursal en empresas pequeñas.

**Responsabilidades de negocio:**
- Atiende consultas de disponibilidad y cotiza tarifas.
- Crea y confirma reservas en nombre del cliente (canal telefónico, WhatsApp, presencial) cuando el cliente no se autogestiona.
- Gestiona reprogramaciones y cancelaciones solicitadas antes de la entrega del vehículo.
- Es el punto de contacto humano cuando la autogestión del cliente (portal/app) falla o el cliente prefiere atención directa.

### 2.4 Responsable de Mantenimiento

Gestiona el estado mecánico y de disponibilidad estructural de la flota.

**Responsabilidades de negocio:**
- Programa mantenimientos preventivos según kilometraje o tiempo transcurrido.
- Registra mantenimientos correctivos derivados de averías o daños reportados.
- Decide cuándo un vehículo pasa a estado "en mantenimiento" o "fuera de servicio", bloqueando su disponibilidad para reservas.
- Decide cuándo un vehículo vuelve a estar disponible tras un mantenimiento.
- Coordina con Proveedores externos (talleres, repuestos) cuando el mantenimiento no se realiza con personal propio.

**Relación con Vehicle:** esta responsabilidad es, en términos del dominio ya modelado, quien opera las transiciones de estado del agregado `Vehicle` (ver [03-DOMINIO.md §3.2](../03-DOMINIO.md)) — el actor humano detrás de la regla "el cambio de estado es responsabilidad exclusiva de este agregado".

### 2.5 Responsable Comercial/Financiero

Gestiona la relación de la empresa con el dinero: cobros, facturación, cierre contable.

**Responsabilidades de negocio:**
- Supervisa que los cobros asociados a reservas se concreten (o gestiona la excepción cuando no).
- Emite o supervisa la emisión de comprobantes fiscales (facturas).
- Gestiona reclamos de cobro, contracargos y disputas con la pasarela de pago.
- Consume reportes financieros (ingresos por sucursal, por categoría de vehículo, morosidad) para la toma de decisiones.

## 3. Actores humanos externos

### 3.1 Cliente

Persona natural o jurídica que alquila un vehículo. Es el actor cuya necesidad justifica la existencia de todo el negocio.

**Responsabilidades/comportamientos de negocio:**
- Solicita cotizaciones y realiza reservas (directamente vía autogestión, o a través de un Agente de Reservas).
- Presenta documentación válida (identidad, licencia de conducir, en algunos países comprobante de domicilio o tarjeta de crédito) al momento de la entrega.
- Recibe el vehículo, lo usa durante el período pactado, y lo devuelve en las condiciones y plazo acordados.
- Paga el alquiler y, si aplica, cargos adicionales (combustible, daños, extensión, penalización).
- Puede ser Cliente recurrente (persona natural con historial) o Cliente corporativo (empresa con cuenta y condiciones contractuales propias — facturación consolidada, tarifas negociadas, múltiples conductores autorizados).

**Variantes que el negocio debe distinguir explícitamente:**
- **Cliente persona natural**: se identifica con documento de identidad y licencia de conducir propias.
- **Cliente persona jurídica (corporativo)**: la empresa es quien contrata y paga; el vehículo es conducido por uno o más Conductores Adicionales designados por esa empresa. Ver §3.2.

### 3.2 Conductor Adicional

Persona autorizada a conducir el vehículo alquilado sin ser necesariamente quien contrató ni quien paga la reserva.

**Responsabilidades de negocio:**
- Debe cumplir los mismos requisitos documentales de licencia de conducir válida que el Cliente titular.
- En la mayoría de las políticas de negocio, debe estar declarado y autorizado *antes* de la entrega del vehículo — conducir sin estar declarado suele invalidar la cobertura de seguro (regla dependiente de país/aseguradora, ver [05-REGLAS-NEGOCIO.md](05-REGLAS-NEGOCIO.md)).
- Es relevante especialmente en el caso de Cliente corporativo, donde el titular de la reserva (la empresa) casi nunca coincide con quien efectivamente conduce.

### 3.3 Proveedor de Servicios

Tercero externo que provee un servicio necesario para operar la flota, pero que no es un sistema integrado a la Plataforma (a diferencia de los actores de sistema de §4).

**Ejemplos:** taller mecánico externo, proveedor de repuestos, proveedor de combustible, grúa/asistencia en ruta, aseguradora.

**Responsabilidades de negocio:**
- Ejecuta trabajos de mantenimiento o reparación por encargo del Responsable de Mantenimiento.
- Provee cobertura o gestiona siniestros cuando ocurre un daño o accidente durante el alquiler.
- Su interacción con el negocio es hoy mayormente manual/offline (orden de trabajo, factura del proveedor) — no implica necesariamente una integración de sistema, aunque una integración futura no está descartada (ver [09-FUTURAS-CAPACIDADES.md](09-FUTURAS-CAPACIDADES.md)).

## 4. Actores de sistema (internos a la Plataforma)

Estos actores no son personas ni terceros: son capacidades de la Plataforma (ya definidas en [03-DOMINIO.md](../03-DOMINIO.md)) que participan activamente en los procesos de negocio y por eso deben entenderse como actores, no como detalles de implementación.

| Actor de sistema | Rol en el negocio |
|---|---|
| Motor de Disponibilidad (Calendar) | Determina si un vehículo está libre en un rango de fechas; es quien "dice sí o no" a una reserva antes de que se confirme |
| Motor de Notificaciones | Informa proactivamente a Cliente y personal interno de eventos relevantes (confirmación, recordatorio, comprobante) |
| Motor de Auditoría | Registra de forma inmutable qué actor hizo qué y cuándo, sirviendo de fuente de verdad ante disputas |
| Motor de Reportes | Traduce la operación transaccional en información agregada para la toma de decisión del Administrador y del Responsable Comercial/Financiero |

## 5. Actores de sistema (externos, vía integración)

Ver el detalle técnico de cómo se integran en [11-INTEGRACIONES.md](../11-INTEGRACIONES.md). Desde la óptica del negocio, cada uno de estos es un actor porque **actúa y responde**, no es un dato pasivo.

| Actor externo | Qué hace en el negocio |
|---|---|
| Pasarela de Pago (Stripe / Mercado Pago) | Autoriza, captura o rechaza un cobro; notifica asincrónicamente el resultado |
| WhatsApp Business | Canal por el cual el Cliente recibe confirmaciones/recordatorios y, potencialmente, inicia conversación (consulta, reprogramación) |
| Proveedor de Email/SMS | Canal alternativo de notificación, usado según preferencia del Cliente o criticidad del mensaje |
| Proveedor de OCR | Extrae datos de un documento de identidad/licencia fotografiado; su resultado siempre requiere confirmación humana (ver [11-INTEGRACIONES.md §8](../11-INTEGRACIONES.md)) |
| Proveedor de Firma Digital | Recoge la aceptación formal del contrato de alquiler por parte del Cliente |
| Proveedor de Geolocalización | Apoya logística de entrega/recogida y cálculo de distancias entre sucursales/direcciones |

## 6. Matriz de interacción actor–proceso (resumen)

| Proceso (ver [03-PROCESOS.md](03-PROCESOS.md)) | Actor(es) principal(es) |
|---|---|
| Alta de vehículo | Administrador de Empresa, Responsable de Mantenimiento |
| Alta de cliente | Cliente, Agente de Reservas, Proveedor de OCR |
| Cotización y reserva | Cliente, Agente de Reservas, Motor de Disponibilidad |
| Entrega (check-out) | Operador de Sucursal, Cliente, Conductor Adicional |
| Devolución (check-in) | Operador de Sucursal, Cliente |
| Cancelación / Reprogramación | Cliente, Agente de Reservas, Operador de Sucursal |
| Pago | Cliente, Pasarela de Pago, Responsable Comercial/Financiero |
| Facturación | Responsable Comercial/Financiero, Motor de Notificaciones |
| Mantenimiento | Responsable de Mantenimiento, Proveedor de Servicios |

Esta matriz es de referencia rápida; el detalle completo de cada flujo está en [03-PROCESOS.md](03-PROCESOS.md).
