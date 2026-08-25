// Fase 6/Hardening "load testing multi-tenant" (docs/01-ROADMAP.md SS8,
// docs/persistence/10-DECISIONES.md #107). No es un benchmark de performance generico -
// docs/09-SEGURIDAD.md SS5 llama al aislamiento entre tenants "el activo critico numero
// uno"; este script verifica especificamente que ninguna company vea datos de otra bajo
// concurrencia real (todas las companies sembradas por setup.ts golpeando el pool de
// conexiones/RLS al mismo tiempo, docs/persistence/06-RLS.md SS1).
//
// Patron rafaga-y-espera, no loop apretado: todos los VUs (uno por company) disparan al
// mismo instante y despues duermen - la concurrencia real que importa (todas las companies
// pegandole a la vez) no depende de RPS agregado alto, y mantiene la tasa bajo el
// presupuesto de throttle compartido por IP (perfil general, 20/60s por ruta - decision del
// usuario esta tanda: respetar el limite actual, no reabrir la decision #104).
//
// Requiere tooling/load-testing/.output/companies.json (generado por `npm run
// load-test:setup`).

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const companies = JSON.parse(open('../.output/companies.json'));

const API_BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';
// 3 rafagas, ~35s de espera entre cada una - con 6 companies (default de setup.ts) son 6
// requests instantaneos por endpoint por rafaga, bien por debajo del 20/60s general.
const BURSTS = Number(__ENV.BURSTS || 3);
const BURST_INTERVAL_SECONDS = Number(__ENV.BURST_INTERVAL_SECONDS || 35);

// Contador separado de los thresholds normales de latencia/error-rate - una violacion de
// aislamiento es un incidente de seguridad, no un problema de performance.
export const tenantIsolationViolations = new Counter('tenant_isolation_violations');

export const options = {
  scenarios: {
    tenant_isolation: {
      executor: 'per-vu-iterations',
      vus: companies.length,
      iterations: BURSTS,
      maxDuration: `${BURSTS * BURST_INTERVAL_SECONDS + 60}s`,
    },
  },
  thresholds: {
    // count==0 falla el run entero ante CUALQUIER fuga - la unica condicion de esta tanda
    // que importa mas que latencia/error-rate.
    tenant_isolation_violations: ['count==0'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  // __VU es 1-based en k6.
  const company = companies[(__VU - 1) % companies.length];
  const ownPrefix = `LoadTest-${company.companyIndex}-`;
  const headers = { Authorization: `Bearer ${company.accessToken}` };

  // GET /customers: el unico endpoint con datos taggeados por company - el check de
  // aislamiento real vive aca. GET /branches y /reservations solo suman presion real de
  // concurrencia sobre el pool/RLS de otras rutas, sin dato taggeado que verificar en ellas.
  const customersRes = http.get(`${API_BASE_URL}/api/v1/customers`, { headers });
  http.get(`${API_BASE_URL}/api/v1/branches`, { headers });
  http.get(`${API_BASE_URL}/api/v1/reservations`, { headers });

  const ok = check(customersRes, { 'GET /customers responde 200': (r) => r.status === 200 });

  if (ok) {
    const body = JSON.parse(customersRes.body);
    const leaked = body.data.filter(
      (customer) => customer.name.startsWith('LoadTest-') && !customer.name.startsWith(ownPrefix),
    );

    check(leaked, { 'sin fuga cross-tenant': (l) => l.length === 0 });

    if (leaked.length > 0) {
      tenantIsolationViolations.add(leaked.length);
      console.error(
        `FUGA CROSS-TENANT: VU de company ${company.companyIndex} (esperaba prefijo "${ownPrefix}") vio: ${leaked.map((c) => c.name).join(', ')}`,
      );
    }
  }

  sleep(BURST_INTERVAL_SECONDS);
}
