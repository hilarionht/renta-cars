// Mock de CSS Modules para Jest: `styles.button` devuelve "button", asi los tests pueden
// afirmar clases sin procesar CSS. docs/persistence/10-DECISIONES.md #134.
export default new Proxy(
  {},
  { get: (_target, key) => (key === '__esModule' ? false : String(key)) },
) as Record<string, string>;
