# 08 — DevOps

Fija Docker, CI/CD, versionado, entornos, secretos, deploy y rollback, coherente con la decisión raíz de [ADR-0001](../ADR/0001-modular-monolith.md): un monolito modular, sin microservicios ni orquestación Kubernetes. Todo lo definido aquí opera dentro de esa restricción deliberada — no se introduce infraestructura de orquestación que ADR-0001 ya descartó.

## 1. Contenedores (Docker)

- **Build multi-stage** por app desplegable (`apps/api`, `apps/web-admin`): etapa de dependencias (instala solo lo necesario para build), etapa de build (`nx build <app>`, aprovechando el cache de Nx, [01-MONOREPO.md §9](01-MONOREPO.md)), etapa de runtime (imagen mínima, solo artefactos compilados + dependencias de producción). `apps/mobile` no se containeriza — se distribuye vía Expo/stores, fuera del alcance de este documento.
- Imagen base `node:<LTS>-alpine` (o equivalente mínimo), usuario no-root en tiempo de ejecución, sin herramientas de build en la imagen final.
- `.dockerignore` excluye `node_modules`, `.git`, artefactos de otras apps del monorepo — cada imagen contiene únicamente lo que su app necesita (Nx permite build de un solo proyecto sin arrastrar el resto del workspace).
- **Docker Compose** para entorno de desarrollo local: PostgreSQL, Redis, MinIO (S3-compatible, ya fijado en [11-INTEGRACIONES.md §11](../11-INTEGRACIONES.md)), y opcionalmente un perfil de observabilidad local (OTel Collector, Prometheus, Grafana, Loki) activable aparte para no forzar su arranque en el ciclo diario de desarrollo. Ningún desarrollador necesita Kubernetes local (`kind`/`minikube`) — sería contradecir ADR-0001 incluso en desarrollo, ver [10-DECISIONES.md](10-DECISIONES.md) #11.

## 2. CI/CD (GitHub Actions)

### 2.1 Pipeline de Pull Request

Disparado en cada PR, usando `nx affected` (nunca el grafo completo, [01-MONOREPO.md §9](01-MONOREPO.md)) para no pagar el costo de recompilar/retestear proyectos no tocados:

1. Lint + type-check (`nx affected --target=lint,typecheck`).
2. Tests unitarios y de aplicación (`nx affected --target=test`) — rápidos, corren siempre.
3. Tests de integración (Testcontainers: Postgres, Redis) — corren en cada PR, coherente con [10-TESTING.md §8](../10-TESTING.md).
4. Build (`nx affected --target=build`).
5. Tests E2E de los golden paths — en cada PR si el tiempo total de pipeline lo permite, o en un job diferido/nocturno si no, decisión a tomar en Fase 0 con datos reales de duración (ya dejado abierto en [10-TESTING.md §8](../10-TESTING.md); este documento no lo cierra).
6. Auditoría de dependencias (`npm audit` o equivalente) — bloqueante solo ante vulnerabilidades de severidad alta/crítica con parche disponible.

Build de imagen Docker en el pipeline de PR **sin publicar** (valida que la imagen construye, no la despliega) — publicar solo ocurre en el pipeline de rama principal (§2.2).

### 2.2 Pipeline de rama principal

Al hacer merge a la rama principal: repite §2.1 sobre el estado final, luego:

1. Build y publicación de imágenes Docker de los proyectos afectados, taggeadas con el SHA del commit (tag inmutable) y, si corresponde a un release, con la versión semántica (§3).
2. Ejecución de migraciones de base de datos contra el entorno de staging, como job separado del despliegue de la app (§4 — nunca la propia app ejecuta migraciones en su arranque, para evitar carreras entre réplicas).
3. Despliegue a staging.
4. Despliegue a producción — manual (aprobación explícita) o automático según política de release vigente, configurable sin cambiar la arquitectura del pipeline.

### 2.3 Ownership y revisión

`CODEOWNERS` mapea cada archivo `.prisma` (§1 de [04-PERSISTENCE.md](04-PERSISTENCE.md)), cada proyecto Nx `module:*` ([01-MONOREPO.md §4](01-MONOREPO.md)) y cada workflow de CI a su equipo dueño — un cambio a un módulo o su schema exige revisión del equipo dueño como *status check* obligatorio, no como convención.

## 3. Versionado

- Cada app desplegable (`api`, `web-admin`) se versiona de forma independiente con versionado semántico, derivado de *Conventional Commits* (herramienta tipo `changesets`/`release-please`, a elegir en implementación) — coherente con que son desplegables independientes aunque compartan monorepo.
- Tag de imagen Docker = SHA del commit (inmutable, trazable) más un tag móvil por entorno (`staging`, `latest`) que apunta a la imagen actualmente desplegada en ese entorno — nunca se sobrescribe un tag de SHA.
- Los eventos de dominio y los contratos de API versionan de forma independiente del versionado de despliegue (`.v1`/`.v2` de evento, `/api/v1/` de ruta) — ya fijado en [model/06-DOMAIN_EVENTS.md §11](../model/06-DOMAIN_EVENTS.md) y [08-API-CONTRACTS.md §1](../08-API-CONTRACTS.md); no se confunde con la versión de release del desplegable.

## 4. Entornos

| Entorno | Propósito | Datos |
|---|---|---|
| Local | Desarrollo individual | Docker Compose, datos sintéticos/seed |
| CI | Verificación de PR | Efímero, Testcontainers, destruido al finalizar el job |
| Staging | Validación pre-producción con la imagen candidata a release | Datos sintéticos/anonimizados únicamente — nunca una copia de datos reales de un tenant, coherente con el compromiso de aislamiento de [ADR-0004](../ADR/0004-multitenancy.md) |
| Producción | Servicio real | Datos reales |

Principio de paridad: la **misma imagen Docker** se promueve de staging a producción sin reconstruir — toda diferencia de comportamiento entre entornos es exclusivamente configuración (variables de entorno), nunca código distinto (12-factor).

## 5. Secretos por entorno

- CI: secretos de GitHub Actions (scoped al repositorio/entorno), usados solo para credenciales de sandbox de proveedores externos en tests de integración.
- Staging/Producción: almacén de secretos del proveedor de hosting/orquestación elegido en implementación, inyectado como variable de entorno al contenedor en el momento del despliegue — nunca embebido en la imagen (una imagen sin secretos puede promoverse libremente entre entornos, reforzando §4).
- Detalle de qué es secreto y cómo se consume desde `ConfigModule` → [07-SECURITY.md §3](07-SECURITY.md).

## 6. Deploy

- Sin Kubernetes ni orquestación compleja (ADR-0001): despliegue por *rolling restart* de contenedores sobre un pequeño conjunto de hosts o un servicio de contenedores gestionado simple, detrás de un balanceador de carga.
- Migraciones como paso de despliegue **previo** y separado al reinicio de las réplicas de la app (§2.2) — evita que dos réplicas intenten migrar concurrentemente o que una réplica vieja corra contra un schema ya migrado de forma incompatible; el patrón *expand/contract* de [04-PERSISTENCE.md §7](04-PERSISTENCE.md) es precisamente lo que hace esto seguro (una réplica vieja sigue funcionando contra un schema con una columna nueva nullable no usada todavía).
- El balanceador no enruta tráfico a una réplica nueva hasta que `/health/ready` responde `ok` (§10 de [03-BACKEND-ARCHITECTURE.md](03-BACKEND-ARCHITECTURE.md)) — despliegue gateado por salud, no por tiempo fijo de espera.
- Apagado ordenado: la réplica saliente deja de recibir tráfico nuevo, drena workers de BullMQ en curso y cierra el pool de Prisma antes de terminar (ya fijado en §2 de [03-BACKEND-ARCHITECTURE.md](03-BACKEND-ARCHITECTURE.md)).

## 7. Rollback

- **Código**: redeploy del tag de imagen inmutable anterior — posible en minutos precisamente porque las imágenes son inmutables y versionadas por SHA (§3).
- **Base de datos**: las migraciones son forward-only por diseño ([04-MODELO-DATOS.md §6](../04-MODELO-DATOS.md), [04-PERSISTENCE.md §7](04-PERSISTENCE.md)) — no existe un script de "downgrade" de schema como mecanismo estándar. El patrón *expand/contract* es precisamente lo que hace que un rollback de código común **no** requiera rollback de base de datos: una columna nueva nullable no rota código viejo que no la conoce.
- **Caso excepcional** (migración no aditiva que sí rompe compatibilidad hacia atrás, situación que ya debería haberse evitado por diseño): se resuelve con una migración correctiva hacia adelante (*hotfix* forward), nunca revirtiendo el schema — coherente con la disciplina ya fijada, no una excepción nueva de esta fase.
- Los *feature toggles* de alcance de producto (`EnabledProductModules` de `CompanySettings`, ya modelado) sirven como mecanismo de mitigación rápida a nivel de negocio (desactivar un módulo para un tenant) sin necesitar rollback de despliegue — no se introduce una plataforma de *feature flags* de terceros adicional, para no sobre-construir un mecanismo que la Plataforma ya tiene a nivel de dominio.

## 8. Qué se decide en otro documento

- Qué es secreto y cómo lo consume la aplicación en runtime → [07-SECURITY.md](07-SECURITY.md).
- Estrategia de testing en cada etapa del pipeline → [10-TESTING.md](../10-TESTING.md) (sin cambios).
- Convención de nombre de proyecto/imagen → [01-MONOREPO.md](01-MONOREPO.md), [02-PROYECTOS.md](02-PROYECTOS.md).
