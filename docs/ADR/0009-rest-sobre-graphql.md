# ADR-0009 — REST sobre GraphQL para la API Pública

## Estado
Aceptado

## Contexto
La API de la Plataforma es consumida por `web-admin` (Next.js) y `mobile` (Expo) hoy, y potencialmente por integraciones de terceros en el futuro. Es necesario decidir el estilo de API que se documenta y versiona en [08-API-CONTRACTS.md](../08-API-CONTRACTS.md).

## Decisión
**REST sobre HTTP/JSON**, documentado con OpenAPI generado desde el código (`@nestjs/swagger`), versionado por recurso en el path (`/api/v1/...`).

## Alternativas consideradas

| Opción | Evaluación |
|---|---|
| GraphQL | Ofrece agregación flexible de datos heterogéneos en una sola request, útil cuando los clientes tienen necesidades de forma de datos muy distintas entre sí. Descartado para v1.0: el consumo actual es mayoritariamente CRUD por recurso + acciones de negocio bien definidas (confirmar reserva, procesar pago), sin un caso real de agregación compleja que REST no resuelva con endpoints bien diseñados. Además, GraphQL introduce complejidad operativa propia (resolución de N+1, control de profundidad de queries, caching HTTP no trivial) que no se justifica sin el problema que la motiva |
| REST + un gateway BFF (Backend for Frontend) por cliente | Descartado para v1.0: añade una capa de indirección adicional (mantenimiento de N BFFs) sin que hoy exista divergencia real entre lo que web y mobile necesitan del backend — ambos consumen el mismo `data-access` compartido ([06-CONVENCIONES-FRONTEND.md](../06-CONVENCIONES-FRONTEND.md)) |
| **REST versionado por recurso** (elegida) | Contratos simples de documentar (OpenAPI), cacheables con semántica HTTP estándar, consistentes con el ecosistema NestJS (`@nestjs/swagger`), y suficientes para los patrones de consumo actuales y previstos a mediano plazo |

## Consecuencias

**Positivas**
- Documentación de API generada automáticamente desde el código, siempre sincronizada ([08-API-CONTRACTS.md §8](../08-API-CONTRACTS.md)).
- Caching HTTP estándar disponible sin infraestructura adicional.
- Curva de aprendizaje mínima para nuevos desarrolladores e integradores externos futuros.

**Negativas / trade-offs aceptados**
- Un cliente que necesite datos de múltiples recursos relacionados debe hacer múltiples requests (o el backend expone un endpoint compuesto puntual) — aceptable hoy; si aparece un patrón real de sobre-fetching/under-fetching que degrade la experiencia (particularmente en mobile con redes lentas), se evalúa introducir endpoints de agregación específicos antes que migrar el estilo completo de API.

## Revisión
Se reevalúa si aparece un consumidor real (interno o de un producto futuro) con necesidades de agregación de datos heterogéneos que REST no pueda resolver razonablemente con endpoints compuestos — en ese caso, se evalúa GraphQL como capa adicional específica para ese caso, no como reemplazo de la API REST existente.
