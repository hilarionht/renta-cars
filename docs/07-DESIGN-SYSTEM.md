# 07 — Design System (filosofía, no pantallas)

Este documento define **reglas** que gobiernan cualquier interfaz construida sobre la Plataforma, para cualquier producto futuro. No contiene pantallas, wireframes ni mockups — eso es responsabilidad de cada producto, construido sobre estas reglas.

## 1. Por qué el Design System es de Plataforma, no de producto

Igual que Identity o Payments, el sistema de diseño es una capacidad transversal: Taller, Hotel o Clínica deben poder construir sus pantallas con los mismos tokens, primitivas y reglas de interacción que Rental, para que (a) el costo de construir un nuevo producto baje con el tiempo y (b) la experiencia de usuario sea reconociblemente parte de la misma plataforma sin importar el producto.

## 2. Capas del sistema

```mermaid
graph TB
    Tokens[1. Design Tokens<br/>color, espaciado, tipografía, radios, elevación]
    Primitives[2. Primitivas<br/>Button, Input, Select, Table, Modal, Card]
    Patterns[3. Patrones compuestos<br/>Formulario con validación, Tabla con filtros/paginación, Flujo de confirmación]
    ProductUI[4. UI de producto<br/>Pantalla "Nueva Reserva", "Ficha de Vehículo"]

    Tokens --> Primitives --> Patterns --> ProductUI
```

- **Capas 1-3** viven en `libs/frontend/ui-kit` (Plataforma). Ningún producto las reimplementa.
- **Capa 4** vive en cada producto (`apps/web-admin/features/rental/...`). Compone las capas inferiores; no define nuevos tokens ni primitivas salvo necesidad real y, en ese caso, la primitiva se promueve a `ui-kit` si es genérica.

## 3. Design Tokens

Fuente única de verdad para todo valor visual atómico: color, espaciado, tipografía, radios, sombras/elevación, duración de animación. Se definen una vez, en un formato neutral (no atado a CSS-in-JS ni a una librería específica), y se consumen tanto en web (CSS variables / Tailwind config) como en mobile (StyleSheet/tema de RN) desde la misma fuente.

- **Prohibido** un valor de color, espaciado o tipografía "mágico" (`#3a7bd5`, `padding: 13px`) dentro de una feature. Todo valor visual sale de un token.
- Los tokens tienen **capas semánticas** sobre las primitivas (`color.brand.primary` en vez de `blue.500` directamente en un componente de negocio), para poder re-temizar por producto/marca sin tocar features.
- Soporte de modo claro/oscuro es una propiedad del token, no una decisión ad-hoc por componente.

## 4. Primitivas

- Cada primitiva (`Button`, `Input`, `Table`, `Modal`...) tiene **una** implementación de lógica/estado y **dos** implementaciones de renderizado cuando el sustrato lo exige (DOM en web, nativo en mobile) — la API de props es idéntica en ambas plataformas siempre que sea posible, para que una feature "piense" igual en web y mobile.
- Toda primitiva es **accesible por defecto**: navegación por teclado, roles ARIA (web), tamaños de touch target (mobile), contraste mínimo AA — no es responsabilidad de cada feature reimplementar accesibilidad.
- Toda primitiva soporta estados explícitos: `default`, `hover/focus` (web), `pressed`, `disabled`, `loading`, `error` — sin excepciones, porque un formulario de negocio (Reservations, futuro Workshop) siempre necesita estos estados.

## 5. Patrones compuestos

Combinaciones recurrentes que **todo** producto necesita, resueltas una vez:

- Formulario con validación + mensajes de error inline (integrado con `react-hook-form`/`zod`, ver [06-CONVENCIONES-FRONTEND.md](06-CONVENCIONES-FRONTEND.md)).
- Tabla con paginación, filtros y ordenamiento, alineada 1:1 con el contrato de listados de [08-API-CONTRACTS.md](08-API-CONTRACTS.md) (misma forma de paginación en toda la plataforma).
- Flujo de confirmación destructiva (cancelar reserva, eliminar registro) con un único componente de diálogo de confirmación reutilizado en todos los productos.
- Estado vacío, estado de carga y estado de error como componentes de primer nivel, no como `if` disperso en cada pantalla.

## 6. Principios de interacción

1. **Predecibilidad sobre originalidad.** Un usuario que aprendió a usar el módulo de Reservations en Rental debe poder operar el módulo de Turnos en un futuro Taller sin reaprender patrones de interacción.
2. **Feedback inmediato, verdad diferida.** La UI puede reaccionar optimistamente (§11 de [06-CONVENCIONES-FRONTEND.md](06-CONVENCIONES-FRONTEND.md)), pero la confirmación final siempre viene del backend.
3. **Densidad de administración, no densidad de consumidor.** Las pantallas de `web-admin` priorizan densidad de información y velocidad de operación (uso profesional, diario) sobre estética minimalista de producto de consumo.
4. **Mobile no es "web pequeño".** Las pantallas móviles se diseñan para los flujos que un operador o cliente ejecuta en movimiento (check-in de vehículo, confirmación rápida), no como una versión reducida 1:1 de cada pantalla web.

## 7. Gobernanza del sistema de diseño

- Ningún producto crea una primitiva paralela a una ya existente en `ui-kit` "porque es más rápido". Si una primitiva no cubre un caso, se extiende la primitiva (con su nuevo estado/variante documentada), no se bifurca.
- Cambios a tokens o primitivas son revisados como cambios de Plataforma (mismo rigor que un cambio en `identity` o `payments`), porque su radio de impacto cruza todos los productos presentes y futuros.
- Un componente usado por dos o más productos dentro de una feature deja de ser "de producto" y se promueve a `ui-kit` en la siguiente iteración, no de inmediato por especulación (evita sobreingeniería — ver [00-VISION.md §5](00-VISION.md)).

## 8. Qué NO define este documento

- Paleta de colores de marca concreta, tipografía específica, ni valores exactos de tokens — decisión de branding/producto, no de arquitectura.
- Wireframes o flujos de pantalla del módulo de Reservations u otro módulo de negocio.
- Librería final de componentes base (a decidir en implementación: p. ej. Radix/shadcn para web, y su contraparte para RN) — este documento fija las reglas que esa librería debe cumplir, no el nombre del paquete npm.
