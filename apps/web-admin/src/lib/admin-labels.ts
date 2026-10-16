import type { BadgeToneName } from './reservation-status';

// Etiquetas del modulo Administracion (docs/persistence/10-DECISIONES.md #140). El catalogo de
// permisos viene del API (GET /permissions) como "modulo:accion"; aca solo se agrupa y se rotula.
export const PERMISSION_GROUP_LABELS: Record<string, string> = {
  users: 'Usuarios',
  roles: 'Roles',
  branches: 'Sucursales',
  settings: 'Configuración',
  companies: 'Empresa',
  audit: 'Auditoría',
  customers: 'Clientes',
  vehicles: 'Vehículos',
  'vehicle-categories': 'Categorías de vehículos',
  reservations: 'Reservas',
  invoices: 'Facturas',
  payments: 'Pagos',
  'security-deposits': 'Depósitos en garantía',
  files: 'Archivos',
  notifications: 'Notificaciones',
  reports: 'Reportes',
};

export interface PermissionGroup {
  key: string;
  label: string;
  permissions: string[];
}

export function groupPermissions(keys: readonly string[]): PermissionGroup[] {
  const groups = new Map<string, string[]>();
  for (const key of keys) {
    const prefix = key.split(':')[0];
    groups.set(prefix, [...(groups.get(prefix) ?? []), key]);
  }
  return [...groups.entries()]
    .map(([key, permissions]) => ({
      key,
      label: PERMISSION_GROUP_LABELS[key] ?? key,
      permissions: [...permissions].sort(),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

// "reservations:check-out" -> "Check out". El codigo completo se muestra como ayuda.
export function permissionActionLabel(key: string): string {
  const action = key.split(':')[1] ?? key;
  const words = action.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface DisplayStatus {
  label: string;
  tone: BadgeToneName;
}

export const USER_STATUS: Record<string, DisplayStatus> = {
  Active: { label: 'Activo', tone: 'success' },
  Disabled: { label: 'Deshabilitado', tone: 'danger' },
};

export const ROLE_STATUS: Record<string, DisplayStatus> = {
  Active: { label: 'Activo', tone: 'success' },
  Inactive: { label: 'Desactivado', tone: 'neutral' },
};

export const BRANCH_STATUS: Record<string, DisplayStatus> = {
  Active: { label: 'Abierta', tone: 'success' },
  Closed: { label: 'Cerrada', tone: 'neutral' },
};

export const WEEK_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export const WEEK_DAY_LABELS: Record<string, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

// Tipos de sujeto que registra la auditoria (aggregateType de los eventos).
export const AUDIT_SUBJECT_LABELS: Record<string, string> = {
  User: 'Usuario',
  Role: 'Rol',
  Branch: 'Sucursal',
  Company: 'Empresa',
  CompanySettings: 'Configuración',
  Session: 'Sesión',
  Customer: 'Cliente',
  Vehicle: 'Vehículo',
  VehicleCategory: 'Categoría de vehículo',
  Reservation: 'Reserva',
  Invoice: 'Factura',
  Payment: 'Pago',
  Notification: 'Notificación',
  File: 'Archivo',
};

// "UserRoleRevoked.v1" -> "UserRoleRevoked": el nombre del evento es el registro tecnico.
export function auditActionLabel(action: string): string {
  return action.replace(/\.v\d+$/, '');
}

const FALLBACK_TIME_ZONES = [
  'America/Argentina/Buenos_Aires',
  'America/Argentina/Cordoba',
  'America/Argentina/Mendoza',
  'America/Argentina/Salta',
  'America/Argentina/Ushuaia',
  'America/Mexico_City',
  'America/Santiago',
  'America/Sao_Paulo',
  'America/Bogota',
  'America/Lima',
  'America/Montevideo',
  'UTC',
];

// Zonas IANA que acepta el API (@IsTimeZone). Los navegadores listan los nombres canonicos
// ("America/Buenos_Aires") y no los alias que usa el proyecto ("America/Argentina/Buenos_Aires",
// el default de las sucursales): las de referencia van siempre primero, sin repetir.
export function availableTimeZones(current?: string): string[] {
  const supported =
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return [...new Set([...(current ? [current] : []), ...FALLBACK_TIME_ZONES, ...supported])];
}
