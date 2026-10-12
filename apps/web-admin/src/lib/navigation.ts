// Mapa modulo -> visibilidad del menu (docs/persistence/10-DECISIONES.md #134), en un solo
// lugar. El catalogo de permisos no tiene permisos de lectura (salvo audit:read): leer es
// libre para el personal, asi que Reservas, Flota y Clientes se muestran siempre y las
// ACCIONES dentro de cada modulo se habilitan por permiso. Administracion solo aparece si el
// usuario puede administrar algo. La autorizacion real la hace siempre el API.
export interface NavItem {
  href: string;
  label: string;
  // Si esta definido, el item se muestra solo si el usuario tiene algun permiso con alguno
  // de estos prefijos.
  requiredPermissionPrefixes?: readonly string[];
}

export const ADMINISTRATION_PERMISSION_PREFIXES = [
  'users:',
  'roles:',
  'branches:',
  'settings:',
  'companies:',
  'audit:',
] as const;

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Inicio' },
  { href: '/reservations', label: 'Reservas' },
  { href: '/fleet', label: 'Flota' },
  { href: '/customers', label: 'Clientes' },
  {
    href: '/admin',
    label: 'Administración',
    requiredPermissionPrefixes: ADMINISTRATION_PERMISSION_PREFIXES,
  },
];

export function visibleNavItems(
  items: readonly NavItem[],
  hasAnyWithPrefix: (prefixes: readonly string[]) => boolean,
): NavItem[] {
  return items.filter(
    (item) => !item.requiredPermissionPrefixes || hasAnyWithPrefix(item.requiredPermissionPrefixes),
  );
}

export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
