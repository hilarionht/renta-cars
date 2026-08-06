# 07 — Security (arquitectura de implementación)

[09-SEGURIDAD.md](../09-SEGURIDAD.md) ya fija **qué** se decide en materia de seguridad (JWT corto + refresh rotativo, RBAC de dos niveles, `argon2id`, RLS, rate limiting, OWASP). Este documento fija **cómo se construye** cada una de esas decisiones — los componentes técnicos concretos, sin redefinir ninguna política.

## 1. Autenticación: implementación de JWT

- **Firma asimétrica RS256** (no HS256): el servicio de `identity` firma con una clave privada; la clave pública de verificación puede distribuirse a otros procesos sin exponer la capacidad de firmar — relevante para la ruta de evolución de [ADR-0001](../ADR/0001-modular-monolith.md) (extracción futura de un módulo a servicio independiente), donde un servicio extraído necesitaría *verificar* tokens sin poder *emitirlos*. Justificación completa en [10-DECISIONES.md](10-DECISIONES.md) #3.
- Estrategia Passport (`passport-jwt`) integrada como `JwtAuthGuard` (§7 de [03-BACKEND-ARCHITECTURE.md](03-BACKEND-ARCHITECTURE.md)): valida firma, expiración (`exp`), y estructura mínima del payload (`sub`, `companyId`, `roles`) — ya fijados como contenido del `access_token` en [09-SEGURIDAD.md §1](../09-SEGURIDAD.md).
- **Rotación de clave de firma**: la clave activa se identifica por `kid` en el header del JWT; el servicio conserva la clave anterior en estado "solo verificación" durante una ventana de gracia tras rotar, para no invalidar tokens ya emitidos antes de su expiración natural (máximo 15 minutos de vida, por lo que la ventana de gracia es corta por diseño).
- El `refresh_token` no es JWT — es un valor opaco de alta entropía; su hash (nunca el valor en claro) se persiste en `Session.RefreshTokenHash` ([model/02-AGGREGATES.md §3](../model/02-AGGREGATES.md)). La rotación de un solo uso y la detección de robo (`SessionSecurityService`) ya están completamente modeladas en [model/05-DOMAIN_SERVICES.md §3](../model/05-DOMAIN_SERVICES.md) — este documento no las repite, solo confirma que su implementación vive en `platform-identity-application`.

## 2. Autorización: implementación de RBAC

- Catálogo de `Permission` versionado junto al código (constante TypeScript, no tabla editable en runtime — ya fijado en [model/04-VALUE_OBJECTS.md §2](../model/04-VALUE_OBJECTS.md)): cada módulo declara sus propios permisos en su capa `domain`, y un registro central los agrega para validar, al arrancar, que ningún `Role` referencia un permiso inexistente.
- `@RequirePermission('reservations:create')` es un decorador de metadata leído por `PermissionGuard` (§7 de [03-BACKEND-ARCHITECTURE.md](03-BACKEND-ARCHITECTURE.md)) — el primer nivel de verificación, resuelto sin tocar la base de datos de negocio (los `roles[]` ya viajan en el `access_token`).
- El segundo nivel (dependiente de dato runtime, p. ej. "solo puede cancelar reservas de su propia `Branch`") se implementa como una verificación explícita al inicio del Command Handler correspondiente, nunca como un Guard genérico — porque depende del recurso concreto que el Guard no puede conocer sin cargarlo, y cargarlo en el Guard duplicaría el trabajo que el propio Handler ya hace.

## 3. Gestión de secretos

- Categorías de secreto: credenciales de base de datos, clave privada de firma JWT (§1), credenciales de cada proveedor de `integration-providers` ([11-INTEGRACIONES.md §2](../11-INTEGRACIONES.md)).
- Ningún secreto vive en el repositorio (ni en `.env` versionado, ni en `settings` de base de datos en texto plano — ya prohibido en [11-INTEGRACIONES.md §12](../11-INTEGRACIONES.md)).
- Inyección en runtime vía el mecanismo de secretos del entorno de despliegue (variables de entorno pobladas por el orquestador de contenedores desde un almacén de secretos — Docker Secrets, o el mecanismo equivalente del proveedor de hosting elegido en [08-DEVOPS.md §4](08-DEVOPS.md)); en desarrollo local, un `.env` no versionado con valores de sandbox.
- `ConfigModule` (§3 de [03-BACKEND-ARCHITECTURE.md](03-BACKEND-ARCHITECTURE.md)) es el único punto de lectura de secretos — ningún módulo lee `process.env` directamente.
- Rotación de secretos de proveedor: procedimiento operativo documentado por proveedor en el runbook correspondiente (fuera del alcance de este documento de arquitectura); la arquitectura solo garantiza que rotar un secreto es un cambio de configuración desplegado, nunca un cambio de código.

## 4. Cabeceras y transporte

- **Backend** (`apps/api`): Helmet configurado con `Content-Security-Policy` explícita (sin `unsafe-inline` salvo excepción documentada), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS activo en todo entorno salvo desarrollo local — aplicado globalmente en el bootstrap (§2 de [03-BACKEND-ARCHITECTURE.md](03-BACKEND-ARCHITECTURE.md)), no opt-in por endpoint.
- **Frontend** (`web-admin`, Next.js): las mismas cabeceras se aplican a nivel de configuración de Next.js (middleware o configuración de headers), por defecto en toda ruta — ya fijado como requisito en [09-SEGURIDAD.md §7](../09-SEGURIDAD.md).
- **CORS**: lista explícita de orígenes permitidos leída de configuración por entorno (nunca `*`), gestionada por el mismo `ConfigModule` — un origen nuevo (p. ej. un futuro cliente autorizado) es un cambio de configuración, no de código.

## 5. Rate limiting

- `ThrottlerGuard` (§7 de [03-BACKEND-ARCHITECTURE.md](03-BACKEND-ARCHITECTURE.md)) respaldado por un *storage* de Redis compartido entre instancias — imprescindible porque el límite debe ser global a la Plataforma, no por proceso individual, dado que `apps/api` corre en múltiples réplicas detrás de un balanceador ([ADR-0008](../ADR/0008-autenticacion-jwt-refresh.md) ya asume un backend stateless multi-instancia).
- Perfiles de límite distintos por grupo de ruta: `auth` (login, refresh, recuperación de contraseña) con el límite más estricto; `write-heavy` (creación de reservas) con límite intermedio; el resto con el límite general de plataforma.
- Los valores numéricos de cada perfil no se fijan en este documento — se calibran en Fase 6 contra tráfico real, mismo criterio ya establecido en [09-SEGURIDAD.md §9](../09-SEGURIDAD.md).
- Toda respuesta `429` sigue el mismo formato de error de [08-API-CONTRACTS.md §4](../08-API-CONTRACTS.md) — el `ThrottlerGuard` se integra con `DomainExceptionFilter` (§6 de [03-BACKEND-ARCHITECTURE.md](03-BACKEND-ARCHITECTURE.md)) para no producir un formato de error distinto al resto de la API.

## 6. OWASP — mapeo a componentes técnicos concretos

Extiende la tabla de decisiones de [09-SEGURIDAD.md §8](../09-SEGURIDAD.md) con el componente exacto que la implementa:

| Riesgo OWASP | Componente técnico |
|---|---|
| Broken Access Control | `JwtAuthGuard` + `TenantContextGuard` + `PermissionGuard` (§7 de [03-BACKEND-ARCHITECTURE.md](03-BACKEND-ARCHITECTURE.md)) + Prisma Client Extension de `companyId` + RLS (§5 de [04-PERSISTENCE.md](04-PERSISTENCE.md)) |
| Cryptographic Failures | `argon2id` en `platform-users-domain` (VO `PasswordHash`), RS256 (§1), TLS terminado en el balanceador/reverse proxy del entorno de despliegue |
| Injection | Prisma parametrizado por diseño; `$queryRawUnsafe` prohibido por regla de lint personalizada (ver [09-CODING-STANDARDS.md §2](09-CODING-STANDARDS.md)) |
| Security Misconfiguration | Helmet + CORS explícito (§4), `ValidationPipe` con `forbidNonWhitelisted` (§5 de [03-BACKEND-ARCHITECTURE.md](03-BACKEND-ARCHITECTURE.md)), Swagger deshabilitado fuera de desarrollo |
| Vulnerable Components | Job de auditoría de dependencias en CI (§3 de [08-DEVOPS.md](08-DEVOPS.md)) |
| Auth Failures | `SessionSecurityService` (rotación + detección de robo, ya modelado), `ThrottlerGuard` en rutas de auth (§5) |
| Software/Data Integrity | Migraciones revisadas vía `CODEOWNERS` (§7 de [04-PERSISTENCE.md](04-PERSISTENCE.md)), build reproducible en CI (§2 de [08-DEVOPS.md](08-DEVOPS.md)) |
| Logging/Monitoring Failures | `AuditLogEntry` (negocio) + logging estructurado transversal (§1 de [06-OBSERVABILITY.md](06-OBSERVABILITY.md)) |
| SSRF | Todo acceso externo pasa por `platform-integration-providers-infrastructure`, con destinos de proveedor fijos en configuración — ningún caso de uso construye una URL externa a partir de input de usuario |

## 7. Qué se decide en otro documento

- Política de contraseñas, MFA, políticas de auditoría de negocio → [09-SEGURIDAD.md](../09-SEGURIDAD.md) (sin cambios).
- Calibración de parámetros de `argon2id` y umbrales de rate limiting con datos reales → Fase 6 de [01-ROADMAP.md](../01-ROADMAP.md).
- Gestión de secretos por entorno de CI/CD → [08-DEVOPS.md §5](08-DEVOPS.md).
