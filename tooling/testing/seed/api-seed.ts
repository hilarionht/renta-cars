import { randomInt, randomUUID } from 'node:crypto';

// docs/persistence/10-DECISIONES.md #148: seed por la API real, por entidad, para que cada e2e
// arme sus propios datos (sin depender de otro test ni chocar entre workers). Sin Playwright:
// lo puede usar cualquier e2e. Los fileId son ficticios: el API no valida que el archivo exista
// al cargar un documento por API.

export interface ApiClient {
  call<T>(method: string, path: string, body?: unknown): Promise<T>;
}

export function createApiClient(apiUrl: string, token?: string): ApiClient {
  return {
    async call<T>(method: string, path: string, body?: unknown): Promise<T> {
      const response = await fetch(`${apiUrl}/api/v1${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`${method} ${path} -> HTTP ${response.status}: ${text}`);
      }
      return (text ? (JSON.parse(text) as { data: T }).data : undefined) as T;
    },
  };
}

// 6 caracteres hex en mayuscula: sirve para patentes y VIN (sin I/O/Q).
export function uniqueSuffix(): string {
  return randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
}

// Movil de Mexico (CDMX) en E.164, aleatorio: el telefono es unico por company.
export function uniquePhone(): string {
  return `+5255${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

export async function loginStaff(
  apiUrl: string,
  credentials: { companyId: string; email: string; password: string },
): Promise<ApiClient> {
  const { accessToken } = await createApiClient(apiUrl).call<{ accessToken: string }>(
    'POST',
    '/auth/login',
    credentials,
  );
  return createApiClient(apiUrl, accessToken);
}

// Por la API (como los e2e del API): la company queda con el modulo Rental habilitado.
export async function createCompany(apiUrl: string, suffix = uniqueSuffix()): Promise<string> {
  const company = await createApiClient(apiUrl).call<{ id: string }>('POST', '/companies', {
    legalName: `Empresa E2E web ${suffix}`,
    taxId: `WEB-E2E-${suffix}-${Date.now()}`,
    billingContactEmail: `billing-${suffix.toLowerCase()}@example.com`,
  });
  return company.id;
}

export async function createBranch(
  api: ApiClient,
  suffix = uniqueSuffix(),
): Promise<{ id: string; name: string }> {
  const name = `Sucursal E2E ${suffix}`;
  const branch = await api.call<{ id: string }>('POST', '/branches', {
    name,
    address: { line1: 'Av. Siempre Viva 123', city: 'CDMX', country: 'MX' },
    operatingHours: [{ day: 'monday', open: '08:00', close: '20:00' }],
    timeZone: 'America/Mexico_City',
  });
  return { id: branch.id, name };
}

export async function createCategoryWithRate(
  api: ApiClient,
  suffix = uniqueSuffix(),
): Promise<{ id: string; name: string }> {
  const name = `Economico ${suffix}`;
  const category = await api.call<{ id: string }>('POST', '/vehicle-categories', { name });
  await api.call('POST', `/vehicle-categories/${category.id}/rates`, {
    amountMinorUnits: 50_000,
    currency: 'MXN',
    unit: 'Day',
    validFrom: '2026-01-01T00:00:00.000Z',
  });
  return { id: category.id, name };
}

export async function createEnabledVehicle(
  api: ApiClient,
  refs: { branchId: string; categoryId: string },
): Promise<{ id: string; licensePlate: string }> {
  const suffix = uniqueSuffix();
  const licensePlate = `E2E-${suffix}`;
  const vehicle = await api.call<{ id: string }>('POST', '/vehicles', {
    branchId: refs.branchId,
    vehicleCategoryId: refs.categoryId,
    licensePlate,
    vin: `1HGCM82633A${suffix}`,
  });
  const document = await api.call<{ id: string }>('POST', `/vehicles/${vehicle.id}/documents`, {
    documentType: 'PropertyCard',
    fileId: 'file-web-e2e-vehicle',
    expiryDate: daysFromNow(365),
  });
  await api.call('POST', `/vehicles/${vehicle.id}/documents/${document.id}/verify`);
  await api.call('POST', `/vehicles/${vehicle.id}/enable`);
  return { id: vehicle.id, licensePlate };
}

export async function createEligibleCustomer(
  api: ApiClient,
): Promise<{ id: string; name: string }> {
  const suffix = uniqueSuffix();
  const name = `Cliente E2E ${suffix}`;
  const customer = await api.call<{ id: string }>('POST', '/customers', {
    name,
    taxIdOrDocumentId: `E2E-${suffix}`,
    contactEmail: `cliente-${suffix.toLowerCase()}@example.com`,
    contactPhone: uniquePhone(),
    customerType: 'Individual',
  });
  const document = await api.call<{ id: string }>(
    'POST',
    `/customers/${customer.id}/identity-documents`,
    { documentType: 'NationalId', fileId: 'file-web-e2e-identity', expiryDate: daysFromNow(365) },
  );
  await api.call('POST', `/customers/${customer.id}/identity-documents/${document.id}/verify`);
  return { id: customer.id, name };
}

export async function createConfirmedReservation(
  api: ApiClient,
  refs: { customerId: string; vehicleId: string; startDate: Date; endDate: Date },
): Promise<string> {
  const reservation = await api.call<{ id: string }>('POST', '/reservations', {
    customerId: refs.customerId,
    vehicleId: refs.vehicleId,
    startDate: refs.startDate.toISOString(),
    endDate: refs.endDate.toISOString(),
  });
  await api.call('POST', `/reservations/${reservation.id}/confirm`);
  return reservation.id;
}

export async function createCustomRole(
  api: ApiClient,
  roleName: string,
  permissions: string[],
): Promise<string> {
  const role = await api.call<{ id: string }>('POST', '/roles', { roleName, permissions });
  return role.id;
}
