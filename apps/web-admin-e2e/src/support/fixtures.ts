import { expect, type Page, test as base } from '@playwright/test';

import { type ApiClient, createApiClient } from '../../../../tooling/testing/seed/api-seed';
import { resetThrottler } from '../../../../tooling/testing/seed/reset-throttler';
import { seedUserForCompany } from '../../../../tooling/testing/seed/seed-identity';

// docs/persistence/10-DECISIONES.md #148. Cada test arma sus datos por la API y entra con su
// propia sesion. NO se comparte un storageState: el API rota el refresh token en cada uso y, si
// uno ya rotado se vuelve a presentar, revoca TODAS las sesiones del usuario (#134). Por eso:
// - `staff`: un usuario por worker (las revocaciones no cruzan entre workers);
// - `api`: login por la API en el contexto del test. Deja la cookie httpOnly de refresh en el
//   cookie jar del contexto (la comparte el navegador) y la cookie indicadora de la web; la
//   pagina arranca con un refresh silencioso. Devuelve un cliente con el access token para
//   sembrar datos;
// - `resetThrottle`: limpia los contadores del rate limiter al empezar cada test.
export function seeded(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} no esta definida (la define src/support/global-setup.ts).`);
  }
  return value;
}

interface Staff {
  email: string;
  password: string;
}

export const test = base.extend<{ api: ApiClient; resetThrottle: void }, { staff: Staff }>({
  staff: [
    async ({}, use) => {
      const user = await seedUserForCompany(
        seeded('WEB_E2E_COMPANY_ID'),
        seeded('WEB_E2E_SYSTEM_ROLE_ID'),
      );
      await use({ email: user.email, password: user.password });
    },
    { scope: 'worker' },
  ],
  resetThrottle: [
    async ({}, use) => {
      await resetThrottler(seeded('WEB_E2E_REDIS_URL'));
      await use();
    },
    { auto: true },
  ],
  api: async ({ page, context, baseURL, staff }, use) => {
    const apiUrl = seeded('WEB_E2E_API_URL');
    const response = await page.request.post(`${apiUrl}/api/v1/auth/login`, {
      data: {
        companyId: seeded('WEB_E2E_COMPANY_ID'),
        email: staff.email,
        password: staff.password,
      },
    });
    expect(response.ok(), `login por API: HTTP ${response.status()}`).toBeTruthy();
    const { data } = (await response.json()) as { data: { accessToken: string } };
    await context.addCookies([{ name: 'renta_session', value: '1', url: baseURL ?? '' }]);
    await use(createApiClient(apiUrl, data.accessToken));
  },
});

export { expect };

// Navega y espera el menu lateral: solo se dibuja con la sesion autenticada (admin-shell.tsx),
// asi que garantiza la hidratacion y que el refresh silencioso ya paso.
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible({
    timeout: 30_000,
  });
}

// Fecha YYYY-MM-DD dentro de N dias (inputs type=date).
export function dateInDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}
