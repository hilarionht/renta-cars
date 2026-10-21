// docs/persistence/10-DECISIONES.md #146 y #148. Puertos del e2e autocontenido (CI): el API en el
// mismo puerto que apps/api-e2e (corren en serie en el job `e2e`), la web y el storage en puertos
// propios. El storage va FIJO porque la web fija su origen en la CSP al compilar
// (NEXT_PUBLIC_STORAGE_ORIGIN), antes de que arranque el globalSetup. El host del origen tiene que
// ser el mismo que el del endpoint del storage (127.0.0.1, el de tooling/testing/testcontainers).
export const E2E_API_PORT = 3333;
export const E2E_WEB_PORT = 4300;
export const E2E_STORAGE_PORT = 9300;
export const E2E_WEB_ORIGIN = `http://localhost:${E2E_WEB_PORT}`;
export const E2E_STORAGE_ORIGIN = `http://127.0.0.1:${E2E_STORAGE_PORT}`;
