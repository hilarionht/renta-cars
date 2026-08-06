# Architecture Decision Records

Registro de decisiones arquitectónicas significativas tomadas durante el diseño de la Plataforma. Cada ADR documenta el contexto, la decisión, las alternativas consideradas y las consecuencias aceptadas — para que un desarrollador o modelo de IA futuro entienda **por qué** la arquitectura es como es, no solo qué es.

| ADR | Decisión |
|---|---|
| [0001](0001-modular-monolith.md) | Monolito Modular en lugar de Microservicios |
| [0002](0002-ddd-pragmatico.md) | DDD Pragmático (táctico completo, estratégico selectivo) |
| [0003](0003-postgresql-prisma.md) | PostgreSQL + Prisma ORM como capa de persistencia |
| [0004](0004-multitenancy.md) | Estrategia de Multi-tenancy (columna + RLS) |
| [0005](0005-comunicacion-modulos.md) | Comunicación entre Módulos: Puertos Síncronos + Eventos In-Process |
| [0006](0006-monorepo-nx.md) | Monorepo con Nx y Fronteras de Módulo Impuestas en CI |
| [0007](0007-cqrs-selectivo.md) | CQRS Selectivo (separación conceptual, no stores separados) |
| [0008](0008-autenticacion-jwt-refresh.md) | JWT de Acceso Corto + Refresh Token Rotativo |
| [0009](0009-rest-sobre-graphql.md) | REST sobre GraphQL para la API Pública |
| [0010](0010-provider-pattern-integraciones.md) | Provider Pattern para toda Integración Externa |

## Formato

Cada ADR sigue: Estado, Contexto, Decisión, Alternativas consideradas (con evaluación explícita), Consecuencias (positivas y negativas/trade-offs aceptados), Revisión (bajo qué condición se reabre la decisión).

## Cuándo crear un nuevo ADR

Cuando una decisión: (a) es difícil o costosa de revertir, (b) afecta a más de un módulo o a la Plataforma completa, o (c) fue elegida entre alternativas genuinamente viables y alguien podría razonablemente preguntar "¿por qué no se hizo de la otra forma?". No se documentan como ADR decisiones de implementación local a un módulo sin impacto arquitectónico.
