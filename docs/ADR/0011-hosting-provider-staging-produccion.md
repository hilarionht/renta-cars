# ADR-0011 — Proveedor de Hosting/Orquestación para Staging y Producción

## Estado

Propuesto — bloquea la implementación completa de `main.yml` (paso 11 de [engineering/10-BOOTSTRAP-PLAN.md](../engineering/10-BOOTSTRAP-PLAN.md)).

## Contexto

[technical/08-DEVOPS.md §5](../technical/08-DEVOPS.md) fija el mecanismo de despliegue (rolling restart de contenedores, sin Kubernetes, `ADR-0001`) pero deja explícitamente abierto **qué** aloja esos contenedores: "almacén de secretos del proveedor de hosting/orquestación elegido en implementación". Ningún documento posterior (`05-CI-CD.md`, `06-DOCKER.md`) cierra esa decisión — a diferencia de la herramienta de versionado semántico ([05-CI-CD.md §4](../engineering/05-CI-CD.md), cerrada explícitamente a Changesets), esta quedó genuinamente pendiente.

Sin un proveedor elegido, no existe un entorno de staging real contra el cual: aplicar el job de migración de `main.yml` §3 punto 3, desplegar la imagen candidata (§3 punto 4), ni gatear el despliegue a producción por `environment: production` con _required reviewers_ (§3 punto 5, [05-CI-CD.md](../engineering/05-CI-CD.md)).

## Decisión

**No tomada.** Este ADR documenta el bloqueo, no lo resuelve — implementarlo unilateralmente violaría el mandato de esta fase de bootstrap (ejecutar arquitectura ya aprobada, no inventar decisiones nuevas). Mientras este ADR siga en estado "Propuesto":

- `main.yml` implementa únicamente lo que **no** depende de esta decisión: reinvocación del pipeline de PR (`workflow_call`), build y publicación de imágenes Docker a GitHub Container Registry (registro por defecto ya fijado en [05-CI-CD.md §3.2](../engineering/05-CI-CD.md), independiente del proveedor de hosting) taggeadas por SHA.
- Los jobs de migración-contra-staging, despliegue a staging y despliegue a producción quedan sin implementar — no como _stub_ ni _feature flag_ deshabilitado (eso simularía una capacidad que no existe), simplemente ausentes del workflow hasta que este ADR se acepte.

## Alternativas a evaluar (sin evaluar todavía)

| Opción                                                                                               | Nota                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| PaaS de contenedores gestionado (Render, Railway, Fly.io)                                            | Menor operación propia, coherente con "sin Kubernetes" de ADR-0001; variará el mecanismo exacto de _rolling restart_ y de inyección de secretos |
| VPS propio + Docker Compose/systemd                                                                  | Control total, más operación manual; requiere definir balanceador y healthcheck-gating (§6 de `08-DEVOPS.md`) a mano                            |
| Servicio de contenedores de un hyperscaler (AWS ECS/Fargate, Google Cloud Run, Azure Container Apps) | Buen soporte de `environment`/secretos/health-gating nativo; mayor superficie de configuración inicial                                          |

Ninguna se descarta ni se prefiere aquí — es la discusión que este ADR debe resolver cuando se acepte.

## Consecuencias

**Mientras el ADR siga propuesto**

- El criterio de salida completo del paso 11 ("un PR de prueba... y el cache remoto reporta un hit") es alcanzable; el criterio de salida de `main.yml` para migración/despliegue no lo es.
- `apps/web-admin` (paso 13) tampoco tendrá pipeline de despliegue hasta que se resuelva, pero eso no bloquea su desarrollo (`nx serve` local no depende de esto).

## Revisión

Se resuelve eligiendo un proveedor concreto antes de que exista un primer release real que necesite desplegarse a staging (Fase 0, [01-ROADMAP.md](../01-ROADMAP.md)) — no bloquea el bootstrap de la Engineering Foundation, sí bloquea el primer despliegue real.
