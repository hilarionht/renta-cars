# 03 — Procesos de Negocio

Este documento describe **cómo ocurren** los procesos operativos del negocio de alquiler de vehículos, de punta a punta, desde la perspectiva de quien los ejecuta — no desde la perspectiva del sistema que los soporta. Usa el lenguaje definido en [02-LENGUAJE-UBICUO.md](02-LENGUAJE-UBICUO.md) y los actores de [01-ACTORES.md](01-ACTORES.md).

Los diagramas usan Mermaid en formato de flujo simplificado (equivalente BPMN informal: rombos = decisión, rectángulos = actividad, óvalos = inicio/fin).

## 1. Alta de vehículo

**Objetivo:** incorporar una unidad a la Flota de una Branch para que pueda ofrecerse en alquiler.

**Actor principal:** Administrador de Empresa (decide incorporar la unidad), ejecutado operativamente por quien la empresa designe a nivel de sucursal.

```mermaid
flowchart TD
    Start([Nueva unidad adquirida/asignada]) --> Registrar[Registrar datos del vehículo:<br/>placa, VIN, categoría, branch]
    Registrar --> Documentar[Cargar documentación legal:<br/>tarjeta de propiedad, seguro, permisos]
    Documentar --> Fotografiar[Cargar fotografías del estado inicial]
    Fotografiar --> Inspeccionar{¿Pasa inspección<br/>inicial?}
    Inspeccionar -->|No| Corregir[Enviar a Mantenimiento<br/>antes de habilitar]
    Corregir --> Inspeccionar
    Inspeccionar -->|Sí| Habilitar[Marcar como Available]
    Habilitar --> End([Vehículo visible en Calendar/Disponibilidad])
```

**Notas de negocio:**
- Un vehículo nunca queda `Available` sin documentación legal vigente cargada — es una decisión de negocio, no solo un requisito de datos (ver [05-REGLAS-NEGOCIO.md](05-REGLAS-NEGOCIO.md)).
- Las fotografías del estado inicial son la línea base contra la que se compara cualquier Damage Report futuro.

## 2. Alta de cliente

**Objetivo:** registrar a un Customer con la información y documentación mínima necesaria para poder realizar una Reservation.

**Actor principal:** Cliente (autogestión) o Agente de Reservas (asistido), con apoyo de Proveedor de OCR.

```mermaid
flowchart TD
    Start([Cliente inicia registro]) --> TipoCliente{¿Persona natural<br/>o jurídica?}
    TipoCliente -->|Natural| DatosNaturales[Capturar datos personales<br/>+ documento de identidad]
    TipoCliente -->|Jurídica| DatosJuridica[Capturar datos de la empresa<br/>+ representante/contacto]
    DatosNaturales --> Licencia[Capturar licencia de conducir]
    DatosJuridica --> ConductoresIniciales[Registrar Conductores Adicionales<br/>autorizados]
    Licencia --> Validar{¿Documentos<br/>vigentes y legibles?}
    ConductoresIniciales --> Validar
    Validar -->|No| Rechazar[Solicitar corrección/nuevo documento]
    Rechazar --> Validar
    Validar -->|Sí| Activar[Cliente activo, puede reservar]
    Activar --> End([Fin])
```

**Notas de negocio:**
- El resultado de OCR (si se usa) es siempre una sugerencia editable; el Cliente o el Agente de Reservas confirma los datos antes de activarse (ver [11-INTEGRACIONES.md §8](../11-INTEGRACIONES.md)).
- Un Customer con documento de identidad o licencia vencida puede registrarse, pero no puede pasar a una Reservation `Confirmed` (invariante ya definido en [03-DOMINIO.md §3.3](../03-DOMINIO.md)).

## 3. Cotización y reserva

**Objetivo:** convertir una consulta de disponibilidad en una Reservation confirmada.

**Actor principal:** Cliente, Agente de Reservas, Motor de Disponibilidad.

```mermaid
flowchart TD
    Start([Cliente consulta disponibilidad]) --> Buscar[Buscar Vehicles disponibles<br/>por categoría, branch y fechas]
    Buscar --> Cotizar[Calcular Quote:<br/>Rate x duración + cargos aplicables]
    Cotizar --> Decide{¿Cliente acepta<br/>la cotización?}
    Decide -->|No| End1([Fin sin reserva])
    Decide -->|Sí| CrearDraft[Crear Reservation en estado Draft]
    CrearDraft --> Reverificar{¿Vehicle sigue<br/>disponible?}
    Reverificar -->|No| Reofertar[Ofrecer alternativa u otra fecha]
    Reofertar --> Decide
    Reverificar -->|Sí| RequiereDeposito{¿Política exige<br/>garantía/anticipo?}
    RequiereDeposito -->|Sí| CobrarAnticipo[Procesar Security Deposit<br/>o anticipo]
    RequiereDeposito -->|No| Confirmar
    CobrarAnticipo --> Confirmar[Confirmar Reservation]
    Confirmar --> Notificar[Notificar confirmación al Cliente]
    Notificar --> End2([Reservation Confirmed])
```

**Notas de negocio:**
- La re-verificación de disponibilidad entre "aceptar cotización" y "confirmar" existe porque puede transcurrir tiempo suficiente para que otro Cliente tome el mismo Vehicle — es la manifestación de negocio del invariante de no-solapamiento.
- El requisito de garantía/anticipo es una política configurable por Company (ver [05-REGLAS-NEGOCIO.md](05-REGLAS-NEGOCIO.md)), no universal.

## 4. Entrega (Check-out)

**Objetivo:** transferir la posesión física del vehículo al Customer al inicio del período reservado.

**Actor principal:** Operador de Sucursal, Cliente, Conductor Adicional (si aplica).

```mermaid
flowchart TD
    Start([Cliente llega a retirar el vehículo]) --> Verificar[Verificar identidad y<br/>vigencia de documentos]
    Verificar --> ConductorAdicional{¿Hay Conductor<br/>Adicional?}
    ConductorAdicional -->|Sí| ValidarConductor[Validar licencia del<br/>Conductor Adicional]
    ConductorAdicional -->|No| Inspeccion
    ValidarConductor --> Inspeccion[Inspeccionar estado del vehículo<br/>y registrar Odometer/combustible]
    Inspeccion --> Firmar[Firmar contrato/acta de entrega]
    Firmar --> EntregarLlaves[Entregar llaves y documentación<br/>del vehículo]
    EntregarLlaves --> CambiarEstado[Reservation → CheckedOut<br/>Vehicle → en uso]
    CambiarEstado --> End([Fin])
```

**Notas de negocio:**
- La inspección de estado en Check-out es la línea base contra la que se compara el Check-in — sin ella, no existe forma legítima de imputar un daño al Cliente.
- Un Vehicle en `Maintenance` u `OutOfService` no puede completar este proceso, sin excepción (invariante crítico, ver [05-REGLAS-NEGOCIO.md](05-REGLAS-NEGOCIO.md)).

## 5. Devolución (Check-in)

**Objetivo:** recibir el vehículo de vuelta y cerrar el ciclo transaccional de la Reservation.

**Actor principal:** Operador de Sucursal, Cliente.

```mermaid
flowchart TD
    Start([Cliente regresa el vehículo]) --> InspeccionFinal[Inspeccionar estado del vehículo<br/>y registrar Odometer/combustible]
    InspeccionFinal --> ComparaBase[Comparar contra estado<br/>de Check-out]
    ComparaBase --> HayDano{¿Hay daño o<br/>faltante?}
    HayDano -->|Sí| RegistrarDano[Crear Damage Report]
    RegistrarDano --> EvaluarPenalidad[Evaluar Penalty aplicable]
    HayDano -->|No| Puntual
    EvaluarPenalidad --> Puntual{¿Devolución<br/>a tiempo?}
    Puntual -->|No| PenalidadTardanza[Aplicar Penalty por<br/>devolución tardía]
    Puntual -->|Sí| Liberar
    PenalidadTardanza --> Liberar[Liberar garantía<br/>según corresponda]
    Liberar --> CerrarReserva[Reservation → CheckedIn]
    CerrarReserva --> LiberarVehiculo[Vehicle → Available<br/>o → Maintenance si aplica]
    LiberarVehiculo --> DispararFacturacion[Disparar emisión de Invoice]
    DispararFacturacion --> End([Reservation → Closed])
```

**Notas de negocio:**
- El Vehicle vuelve a `Available` solo si la inspección no detecta necesidad de Maintenance — la devolución puede, en sí misma, disparar el proceso de mantenimiento.
- El cierre de la Reservation (`Closed`) ocurre cuando la Invoice ya fue emitida, no antes — ver máquina de estados en [03-DOMINIO.md §3.1.2](../03-DOMINIO.md).

## 6. Cancelación

**Objetivo:** terminar una Reservation antes de que se complete, a solicitud del Cliente o por decisión operativa.

**Actor principal:** Cliente, Agente de Reservas, Operador de Sucursal.

```mermaid
flowchart TD
    Start([Solicitud de cancelación]) --> Estado{¿En qué estado<br/>está la Reservation?}
    Estado -->|Draft| CancelarLibre[Cancelar sin penalidad]
    Estado -->|Confirmed| EvaluarPolitica[Evaluar política de cancelación<br/>según anticipación]
    Estado -->|CheckedOut o posterior| Rechazar([No aplica cancelación,<br/>ver Extensión/Cierre anticipado])
    EvaluarPolitica --> DentroPlazo{¿Dentro del plazo<br/>sin penalidad?}
    DentroPlazo -->|Sí| CancelarLibre
    DentroPlazo -->|No| AplicarPenalidad[Aplicar Penalty de cancelación<br/>según política]
    CancelarLibre --> LiberarSlot[Liberar Availability Slot]
    AplicarPenalidad --> LiberarSlot
    LiberarSlot --> Notificar[Notificar cancelación]
    Notificar --> End([Reservation → Cancelled])
```

**Notas de negocio:**
- La política de cancelación (plazos, porcentaje de penalidad) es configurable por Company — ver [05-REGLAS-NEGOCIO.md](05-REGLAS-NEGOCIO.md).
- Una Reservation en `CheckedOut` no se cancela: el vehículo ya está en poder del Cliente. Ese escenario se gestiona como excepción (ver [07-EXCEPCIONES.md](07-EXCEPCIONES.md)).

## 7. Reprogramación y extensión

**Objetivo:** modificar el Date Range de una Reservation sin crear una nueva.

```mermaid
flowchart TD
    Start([Cliente solicita cambio de fechas]) --> TipoCambio{¿La reserva ya<br/>tuvo Check-out?}
    TipoCambio -->|No, es reprogramación| VerificarNuevaFecha[Verificar disponibilidad<br/>en el nuevo Date Range]
    TipoCambio -->|Sí, es extensión| VerificarContinuidad[Verificar que el vehículo<br/>siga disponible después de endDate actual]
    VerificarNuevaFecha --> Disponible1{¿Disponible?}
    VerificarContinuidad --> Disponible2{¿Disponible?}
    Disponible1 -->|No| Ofrecer[Ofrecer alternativa]
    Disponible2 -->|No| OfrecerSwap[Ofrecer Vehicle Swap<br/>o negar extensión]
    Disponible1 -->|Sí| Recalcular[Recalcular Rate/monto]
    Disponible2 -->|Sí| Recalcular
    Recalcular --> Confirmar[Actualizar Date Range<br/>y Availability Slot]
    Confirmar --> End([Fin])
```

**Notas de negocio:**
- Una extensión que colisiona con otra Reservation ya confirmada sobre el mismo Vehicle no puede aprobarse simplemente "porque el cliente ya lo tiene" — obliga a ofrecer Vehicle Swap o rechazar. Este es un caso explícito de tensión entre satisfacción del cliente y el invariante de no-solapamiento, y el negocio resuelve a favor del invariante.

## 8. Pago

**Objetivo:** cobrar al Customer los Charges asociados a una Reservation (alquiler, garantía, cargos adicionales).

```mermaid
flowchart TD
    Start([Se genera un Charge]) --> Metodo{¿Método de pago?}
    Metodo -->|Pasarela online| Autorizar[Solicitar autorización<br/>a Pasarela de Pago]
    Metodo -->|Efectivo/presencial| RegistrarManual[Registrar cobro manual<br/>en sucursal]
    Autorizar --> Resultado{¿Aprobado?}
    Resultado -->|Sí| Capturar[Capturar el pago]
    Resultado -->|No| Reintentar{¿Reintentar u<br/>otro método?}
    Reintentar -->|Sí| Metodo
    Reintentar -->|No| PagoFallido([Payment Failed:<br/>ver excepción])
    Capturar --> RegistrarManual
    RegistrarManual --> End([Charge saldado])
```

**Notas de negocio:**
- El estado de negocio de la Reservation nunca depende de que el pago se procese síncronamente: primero se confirma el compromiso, luego se concilia el cobro — coherente con el principio de integraciones de [11-INTEGRACIONES.md §12](../11-INTEGRACIONES.md) ("confirmar el estado de negocio primero, sincronizar externamente después").

## 9. Facturación

**Objetivo:** emitir el comprobante fiscal/comercial correspondiente a una Reservation cerrada.

```mermaid
flowchart TD
    Start([Reservation → CheckedIn]) --> Consolidar[Consolidar todos los Charges:<br/>alquiler + cargos + penalidades]
    Consolidar --> DatosFiscales{¿Datos fiscales<br/>del Customer completos?}
    DatosFiscales -->|No| SolicitarDatos[Solicitar datos fiscales<br/>faltantes]
    SolicitarDatos --> DatosFiscales
    DatosFiscales -->|Sí| Emitir[Emitir Invoice]
    Emitir --> Notificar[Notificar/enviar comprobante<br/>al Customer]
    Notificar --> End([Reservation → Closed])
```

**Notas de negocio:**
- Los requisitos fiscales exactos de una Invoice (tipo de comprobante, numeración, impuestos aplicables) varían por país — este proceso describe el flujo de negocio, no el formato legal, que se documenta como regla configurable/dependiente de país en [05-REGLAS-NEGOCIO.md](05-REGLAS-NEGOCIO.md).

## 10. Mantenimiento

**Objetivo:** mantener la flota en condiciones operativas y seguras, preventiva o correctivamente.

```mermaid
flowchart TD
    Start([Disparador de mantenimiento]) --> Tipo{¿Preventivo o<br/>correctivo?}
    Tipo -->|Preventivo| Umbral{¿Vehículo alcanzó<br/>umbral de km/tiempo?}
    Tipo -->|Correctivo| Reporte[Damage Report o<br/>falla reportada]
    Umbral -->|Sí| Programar[Programar Maintenance]
    Reporte --> Programar
    Programar --> Bloquear[Vehicle → Maintenance<br/>bloquea disponibilidad futura]
    Bloquear --> Ejecutar{¿Con personal propio<br/>o Proveedor externo?}
    Ejecutar -->|Propio| RealizarInterno[Ejecutar mantenimiento]
    Ejecutar -->|Externo| CoordinarProveedor[Coordinar con<br/>Proveedor de Servicios]
    RealizarInterno --> Verificar[Verificar vehículo<br/>apto para operar]
    CoordinarProveedor --> Verificar
    Verificar --> Apto{¿Apto?}
    Apto -->|No| Ejecutar
    Apto -->|Sí| Liberar[Vehicle → Available]
    Liberar --> End([Fin])
```

**Notas de negocio:**
- Un Vehicle bajo Maintenance bloquea su disponibilidad *futura* inmediatamente al programarse, no solo durante la intervención física — evita que se confirme una Reservation que luego colisione con el mantenimiento.
- El Responsable de Mantenimiento es el único actor de negocio habilitado para devolver un vehículo a `Available` tras una intervención (ver [01-ACTORES.md §2.4](01-ACTORES.md)).

## 11. Relación entre procesos

```mermaid
flowchart LR
    P1[Alta de vehículo] --> P3[Cotización y reserva]
    P2[Alta de cliente] --> P3
    P3 --> P4[Entrega / Check-out]
    P4 --> P5[Devolución / Check-in]
    P5 --> P9[Facturación]
    P3 -.-> P6[Cancelación]
    P4 -.-> P7[Reprogramación / Extensión]
    P4 --> P8[Pago]
    P5 --> P8
    P5 -.-> P10[Mantenimiento]
    P1 -.-> P10
```

Los procesos con línea punteada son condicionales (no ocurren en todo ciclo de alquiler); los de línea sólida son parte del camino principal del negocio.
