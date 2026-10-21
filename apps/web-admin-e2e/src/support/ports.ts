// docs/persistence/10-DECISIONES.md #146. Puertos del e2e autocontenido (CI): el API en el mismo
// puerto que apps/api-e2e (corren en serie en el job `e2e`) y la web en uno propio.
export const E2E_API_PORT = 3333;
export const E2E_WEB_PORT = 4300;
