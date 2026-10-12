import { NAV_ITEMS, isActive, visibleNavItems } from '../src/lib/navigation';

// docs/persistence/10-DECISIONES.md #134: menu segun permisos.
describe('visibleNavItems', () => {
  const labels = (granted: string[]) =>
    visibleNavItems(NAV_ITEMS, (prefixes) =>
      granted.some((permission) => prefixes.some((prefix) => permission.startsWith(prefix))),
    ).map((item) => item.label);

  it('sin permisos de administracion: Reservas, Flota y Clientes siempre visibles', () => {
    expect(labels(['reservations:check-out'])).toEqual(['Inicio', 'Reservas', 'Flota', 'Clientes']);
    expect(labels([])).toEqual(['Inicio', 'Reservas', 'Flota', 'Clientes']);
  });

  it('con algun permiso administrativo aparece Administracion', () => {
    expect(labels(['settings:manage'])).toContain('Administración');
    expect(labels(['audit:read'])).toContain('Administración');
  });
});

describe('isActive', () => {
  it('Inicio solo en /, el resto por prefijo', () => {
    expect(isActive('/', '/')).toBe(true);
    expect(isActive('/reservations', '/')).toBe(false);
    expect(isActive('/reservations/123', '/reservations')).toBe(true);
    expect(isActive('/reservations-x', '/reservations')).toBe(false);
  });
});
