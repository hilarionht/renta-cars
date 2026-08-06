// Lista cerrada de modulos de negocio ya fijada en docs/engineering/01-WORKSPACE.md SS1
// y docs/technical/02-PROYECTOS.md SS2-3. Un modulo nuevo requiere aprobacion de ese
// documento antes de agregarse aqui - este archivo no decide la lista, la refleja.

export const PLATFORM_MODULES = [
  'identity',
  'users',
  'roles-permissions',
  'companies',
  'branches',
  'settings',
  'calendar',
  'payments',
  'files',
  'notifications',
  'audit',
  'integration-providers',
];

export const RENTAL_MODULES = [
  'customers',
  'vehicles',
  'reservations',
  'invoices',
  'reports',
];

export const ALL_MODULES = [...PLATFORM_MODULES, ...RENTAL_MODULES];
