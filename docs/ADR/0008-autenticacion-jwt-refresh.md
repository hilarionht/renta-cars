# ADR-0008 — JWT de Acceso Corto + Refresh Token Rotativo

## Estado
Aceptado

## Contexto
La Plataforma sirve a un backend stateless (NestJS, múltiples instancias detrás de balanceador) y a tres tipos de cliente (web admin, mobile, y potencialmente integraciones de terceros a futuro). Se necesita una estrategia de autenticación que no dependa de sesión pegajosa en memoria del servidor y que permita revocación real cuando es necesario (logout, cambio de contraseña, compromiso de cuenta).

## Decisión
**JWT de acceso de vida corta (15 min) + Refresh Token rotativo de un solo uso, almacenado server-side (hasheado) para permitir revocación.** Detalle completo en [09-SEGURIDAD.md §1](../09-SEGURIDAD.md).

## Alternativas consideradas

| Opción | Evaluación |
|---|---|
| Sesión de servidor (cookie + store en Redis) | Válida y common, pero acopla cada request a un lookup de sesión; se prefiere JWT por el camino caliente sin round-trip a Redis en cada request autenticado, relevante para la latencia de mobile en redes variables |
| JWT de vida larga sin refresh | Descartado: un JWT de vida larga no es revocable sin mantener una lista de revocación (que anula la ventaja de statelessness) — combina lo peor de ambos mundos |
| JWT de acceso corto sin mecanismo de refresh (relogin frecuente) | Descartado: fricción de UX inaceptable, en particular en mobile, donde forzar relogin cada 15 minutos es inviable |
| **JWT corto + Refresh rotativo de un solo uso** (elegida) | Balance correcto: camino caliente stateless y rápido (validación de JWT sin I/O), revocación real disponible (invalidar refresh token en DB), y detección de robo de token vía reutilización de refresh token ya usado |

## Consecuencias

**Positivas**
- Revocación efectiva de sesión (logout, deshabilitación de usuario, cambio de contraseña) sin sacrificar el rendimiento del camino caliente de autorización.
- Detección de robo de refresh token mediante la regla de un solo uso — una señal de seguridad que un JWT de larga duración simple no puede dar.

**Negativas / trade-offs aceptados**
- Un cambio de permisos de un usuario tarda hasta 15 minutos en reflejarse en su `access_token` vigente — aceptado como trade-off de statelessness; si un caso de negocio exige revocación de permiso inmediata (p. ej. despido), se resuelve invalidando también el refresh token asociado y, si es crítico, con una lista corta de revocación de `access_token` consultada solo en operaciones sensibles (no en cada request).
- Mayor complejidad de implementación que un JWT simple — justificada por ser un requisito de seguridad de plataforma, no un detalle opcional.

## Revisión
Se reevalúa si aparece necesidad de revocación de `access_token` verdaderamente instantánea a escala (en cuyo caso se introduce un caché de revocación de corta duración consultado en operaciones sensibles específicas, no en todo el tráfico).
