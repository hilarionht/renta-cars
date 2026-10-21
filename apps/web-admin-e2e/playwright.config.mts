import { join } from 'node:path';

import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';

// docs/persistence/10-DECISIONES.md #146: primer recorrido e2e de la web (login, crear una
// reserva y confirmarla), solo en Chromium (decision del usuario).
// - CI (por defecto): `next build` + `next start` en el 4300 contra el API autocontenido del
//   globalSetup en el 3333. NEXT_PUBLIC_API_URL se fija al compilar (CSP connect-src), por eso
//   va en webServer.env y no se usa el web-admin:build cacheado.
// - Local (WEB_E2E_EXTERNAL=1, sin Docker): reusa el `next dev` del desarrollador en el 4200,
//   que ya apunta al API local (.env.local) y esta en CORS_ORIGINS.
// Sin efectos al cargarse: Nx evalua esta config al calcular el grafo.
// Los puertos coinciden con src/support/ports.ts.
const external = process.env['WEB_E2E_EXTERNAL'] === '1';
const webDir = join(import.meta.dirname, '..', 'web-admin');
const webUrl = external ? 'http://localhost:4200' : 'http://localhost:4300';

export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src', openHtmlReport: 'never' }),
  // Las fechas de la reserva se corren por intento (el reintento no choca con el vehiculo ya
  // ocupado por el intento anterior).
  retries: process.env['CI'] ? 1 : 0,
  // Cada test arma sus propios datos y cada worker tiene su usuario (#148).
  workers: process.env['CI'] ? 2 : undefined,
  globalSetup: './src/support/global-setup.ts',
  expect: { timeout: 10_000 },
  use: {
    baseURL: webUrl,
    trace: 'on-first-retry',
    timezoneId: 'America/Mexico_City',
    navigationTimeout: 30_000,
  },
  webServer: external
    ? {
        command: 'npx next dev -p 4200',
        cwd: webDir,
        url: `${webUrl}/login`,
        reuseExistingServer: true,
        timeout: 180_000,
      }
    : {
        command: 'npx next build && npx next start -p 4300',
        cwd: webDir,
        url: `${webUrl}/login`,
        // NODE_ENV explicito: Nx carga el .env raiz en el entorno de la tarea (NODE_ENV=development)
        // y `next build` con un NODE_ENV que no es production falla al prerenderizar (#146).
        env: {
          NODE_ENV: 'production',
          NEXT_PUBLIC_API_URL: 'http://localhost:3333',
          // Origen del RustFS del globalSetup (puerto fijo, src/support/ports.ts): la CSP lo
          // fija al compilar (#148).
          NEXT_PUBLIC_STORAGE_ORIGIN: 'http://127.0.0.1:9300',
          NEXT_PUBLIC_DEFAULT_COMPANY_ID: '',
        },
        reuseExistingServer: false,
        timeout: 300_000,
      },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
