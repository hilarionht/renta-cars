# 09 — Seguridad

## 1. Modelo de autenticación

- **JWT de acceso de vida corta** (`access_token`, 15 minutos) + **Refresh Token de vida larga** (`refresh_token`, rotativo, 7-30 días según política de producto).
- El `access_token` contiene únicamente lo necesario para autorizar sin round-trip a base de datos en el camino caliente: `sub` (userId), `companyId`, `branchId` (si aplica), `roles`, `iat`/`exp`. **No** contiene permisos granulares completos (ver §2) para evitar tokens infladas y evitar que un cambio de permisos tarde hasta la expiración del token en aplicarse sin mecanismo adicional.
- **Refresh Token rotativo**: cada uso de un refresh token lo invalida y emite uno nuevo; el refresh token es de un solo uso. Reutilización de un refresh token ya usado se trata como señal de robo de token → se invalidan todas las sesiones del usuario.
- Refresh tokens almacenados server-side (hash, no texto plano) para poder revocarlos (logout, cambio de contraseña, deshabilitación de usuario).
- **Web**: `access_token` en memoria, `refresh_token` en cookie `httpOnly`, `Secure`, `SameSite=Strict`. **Mobile**: ambos en almacenamiento seguro del dispositivo (SecureStore/Keychain). Nunca en `localStorage`.

## 2. Autorización: RBAC + scoping por tenant

- **Roles** agrupan **Permissions** granulares (`reservations:create`, `reservations:cancel`, `vehicles:manage`). Los roles son configurables por Company (roles del sistema como base, más roles custom por empresa cuando el plan lo permite) — ver módulo `roles-permissions` en [02-ARQUITECTURA.md](02-ARQUITECTURA.md).
- Verificación de permiso en dos niveles, ambos obligatorios:
  1. **Guard de NestJS** (`@RequirePermission('reservations:create')`) a nivel de endpoint — rechazo temprano, antes de tocar el caso de uso.
  2. **Chequeo a nivel de agregado/caso de uso** cuando el permiso depende de dato runtime (p. ej. "puede cancelar reservas, pero solo las de su propia sucursal") — el Guard no puede expresar esta regla porque depende del recurso concreto, no solo del tipo de acción.
- **Scoping de tenant** (§7 de [05-CONVENCIONES-BACKEND.md](05-CONVENCIONES-BACKEND.md)) es ortogonal a RBAC: un usuario con permiso `reservations:create` solo puede ejercerlo dentro de su propia `companyId`/`branchId`, reforzado por RLS ([04-MODELO-DATOS.md §4](04-MODELO-DATOS.md)) como última línea de defensa.

## 3. Contraseñas y credenciales

- Hashing con `argon2id` (parámetros calibrados a hardware de producción, revisados en Fase 6/Hardening).
- Políticas mínimas: longitud mínima 12, sin composición forzada arbitraria (siguiendo NIST 800-63B: preferir longitud y verificación contra listas de contraseñas filtradas antes que reglas de complejidad artificial).
- Rate limiting específico y más agresivo en endpoints de autenticación (login, refresh, recuperación de contraseña) que en el resto de la API — ver §6.
- MFA (TOTP) soportado a nivel de plataforma desde v1.0 para roles administrativos; opcional para el resto, evaluable por política de Company.

## 4. Auditoría

- Todo evento de seguridad relevante (login exitoso/fallido, cambio de permisos, cambio de contraseña, revocación de sesión, acceso a datos sensibles de otro tenant intentado y bloqueado) se registra en `audit` vía evento de dominio (§7 de [04-MODELO-DATOS.md](04-MODELO-DATOS.md)), no vía log de aplicación descartable.
- Los registros de auditoría son **append-only e inmutables** desde la aplicación (sin `UPDATE`/`DELETE` expuestos); su retención y expurgo, si aplica por normativa, se gestiona por proceso administrativo separado, no por código de negocio.

## 5. Aislamiento multi-tenant (resumen de seguridad)

Ver diseño completo en [ADR-0004](ADR/0004-multitenancy.md) y [04-MODELO-DATOS.md §4](04-MODELO-DATOS.md). Desde la óptica de seguridad, el aislamiento entre tenants se trata como **el activo crítico número uno** del sistema: una fuga de datos entre companies es, por definición, la falla de seguridad más grave posible en una plataforma SaaS multi-tenant. Por eso existe defensa en profundidad (filtro de aplicación + RLS), y por eso todo test de seguridad de Fase 6 prioriza escenarios de fuga cross-tenant sobre cualquier otro vector.

## 6. Rate limiting y protección de abuso

- Rate limiting global por IP/usuario a nivel de gateway/middleware (`@nestjs/throttler` o equivalente respaldado por Redis para funcionar correctamente detrás de múltiples instancias).
- Límites más estrictos y con backoff en: login, refresh token, recuperación de contraseña, creación de recursos costosos (reservas) — para mitigar tanto fuerza bruta como abuso de negocio (spam de reservas).
- Respuestas `429` siguen el mismo formato de error de [08-API-CONTRACTS.md §4](08-API-CONTRACTS.md).

## 7. Cabeceras y transporte

- HTTPS/TLS obligatorio en todo entorno excepto desarrollo local; HSTS habilitado en producción.
- Cabeceras de seguridad estándar (`Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`) aplicadas a nivel de `web-admin` (Next.js) por defecto, no opt-in por página.
- CORS restringido explícitamente a los orígenes conocidos de la Plataforma (web-admin, futuros clientes autorizados); nunca `*` en producción.

## 8. OWASP Top 10 — mapeo a decisiones ya tomadas

| Riesgo OWASP | Mitigación en esta arquitectura |
|---|---|
| Broken Access Control | RBAC de dos niveles (§2) + RLS + scoping de tenant obligatorio en repositorios (§7 de [05-CONVENCIONES-BACKEND.md](05-CONVENCIONES-BACKEND.md)) |
| Cryptographic Failures | `argon2id` para contraseñas, TLS obligatorio, secretos fuera de código (gestor de secretos, no `.env` en repo) |
| Injection | Prisma parametriza queries por diseño; prohibido SQL crudo interpolado (`$queryRawUnsafe` prohibido salvo excepción documentada y revisada) |
| Insecure Design | Este documento y [02-ARQUITECTURA.md](02-ARQUITECTURA.md) son, en sí mismos, la respuesta a este ítem — seguridad modelada desde el diseño, no parchada después |
| Security Misconfiguration | CORS/CSP explícitos (§7), sin defaults permisivos, Swagger deshabilitado/protegido en producción |
| Vulnerable Components | Actualización de dependencias auditada en CI (`npm audit`/equivalente), política de parcheo definida en Fase 6 |
| Auth Failures | Refresh rotativo con detección de reutilización (§1), rate limiting agresivo en auth (§6), MFA disponible |
| Software/Data Integrity | Migraciones versionadas y revisadas ([04-MODELO-DATOS.md §6](04-MODELO-DATOS.md)), CI con build reproducible |
| Logging/Monitoring Failures | Auditoría estructurada (§4) + logging estructurado transversal (interceptor, [05-CONVENCIONES-BACKEND.md §6](05-CONVENCIONES-BACKEND.md)) |
| SSRF | Todo acceso a servicios externos pasa por adaptadores de `integration-providers` con destinos conocidos y validados, nunca URLs arbitrarias provistas por el usuario final |

## 9. Qué se define en Fase 6, no aquí

- Resultados y remediación de pentest externo.
- Calibración final de parámetros de `argon2id` y de umbrales de rate limiting contra tráfico real.
- Política formal de retención/expurgo de auditoría según jurisdicción de cada Company.
