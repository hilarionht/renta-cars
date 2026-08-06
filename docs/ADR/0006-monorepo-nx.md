# ADR-0006 — Monorepo con Nx y Fronteras de Módulo Impuestas en CI

## Estado
Aceptado

## Contexto
La Plataforma incluye tres aplicaciones (`api` NestJS, `web-admin` Next.js, `mobile` Expo) y decenas de librerías de dominio compartidas o específicas de producto. Es necesario decidir la estrategia de repositorio (mono vs. multi) y, si es monorepo, el tooling que la sostiene — en particular, cómo se **impone** (no solo se documenta) la regla de que un módulo no importe internals de otro ([02-ARQUITECTURA.md §1.2](../02-ARQUITECTURA.md)).

## Decisión
**Monorepo único** para backend, frontend web, mobile y todas las librerías compartidas, gestionado con **Nx**. Se usa `enforce-module-boundaries` de Nx (tags por librería: `scope:platform`, `scope:product-rental`, `type:domain`, `type:application`, `type:infrastructure`) para que un import inválido (p. ej. `products/rental` importando internals de `platform/identity`, o `domain/` importando `infrastructure/`) **rompa el build en CI**, no solo en code review.

## Alternativas consideradas

| Opción | Evaluación |
|---|---|
| Multi-repo (un repositorio por app/módulo) | Descartado: para una plataforma donde frontend y backend comparten tipos/contratos y evolucionan juntos en sus primeras fases, el costo de coordinar versiones entre N repositorios (publicar paquetes internos, sincronizar releases) supera el beneficio de aislamiento total, especialmente con un equipo pequeño en los primeros años |
| Monorepo sin tooling especializado (solo carpetas + ESLint manual) | Descartado: las reglas de frontera dependen de disciplina humana revisando cada PR; a 10 años y con rotación de equipo, esto falla silenciosamente — se necesita una herramienta que lo haga estructural |
| Monorepo con Turborepo | Turborepo es más liviano y su cache de builds es excelente, pero su soporte de **reglas de dependencia entre proyectos** (module boundaries) es más limitado que Nx; dado que la garantía "el dominio no depende de infraestructura, un producto no depende de otro producto" es la regla arquitectónica más importante de todo el proyecto, se prioriza la herramienta que la impone de forma nativa |
| **Monorepo con Nx** (elegida) | Graph de dependencias explícito, `enforce-module-boundaries` vía tags impone en CI exactamente las reglas de [02-ARQUITECTURA.md](../02-ARQUITECTURA.md) y [05-CONVENCIONES-BACKEND.md](../05-CONVENCIONES-BACKEND.md); generadores consistentes para scaffolding de nuevos módulos; cache de build/test comparable a Turborepo |

## Consecuencias

**Positivas**
- La regla "el dominio no depende de NestJS/Prisma/React" ([00-VISION.md §5](../00-VISION.md)) deja de ser una convención de code review y se vuelve un check de CI que falla el build.
- Un nuevo bounded context (propio o de un producto futuro) se crea con un generador que ya aplica la estructura y los tags correctos por defecto.
- Refactors grandes (renombrar un puerto, mover un módulo) se benefician del grafo de dependencias real de Nx para medir impacto antes de ejecutar el cambio.

**Negativas / trade-offs aceptados**
- Curva de aprendizaje de Nx para desarrolladores nuevos — mitigado documentando en [05-CONVENCIONES-BACKEND.md](../05-CONVENCIONES-BACKEND.md) la estructura esperada, de forma que Nx sea en gran medida transparente al trabajo diario.
- Tamaño del repositorio crece con el tiempo — aceptable dado el cache incremental de Nx y que es exactamente el trade-off que se acepta a cambio de coordinación simple entre apps y librerías compartidas.

## Revisión
Se reevalúa si el monorepo se vuelve un cuello de botella real de CI (tiempos de pipeline) que el cache incremental de Nx no logra mitigar, o si un producto futuro requiere un ciclo de release completamente independiente de los demás (candidato a salir a su propio repositorio en ese momento, no antes).
