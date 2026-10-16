import {
  auditActionLabel,
  availableTimeZones,
  groupPermissions,
  permissionActionLabel,
} from '../src/lib/admin-labels';

// docs/persistence/10-DECISIONES.md #140.
describe('groupPermissions', () => {
  it('agrupa por modulo, con etiqueta y permisos ordenados', () => {
    const groups = groupPermissions([
      'users:create',
      'reservations:confirm',
      'users:assign-role',
      'reservations:check-out',
    ]);
    expect(groups.map((group) => group.label)).toEqual(['Reservas', 'Usuarios']);
    expect(groups[1].permissions).toEqual(['users:assign-role', 'users:create']);
  });

  it('un modulo sin etiqueta usa su clave', () => {
    expect(groupPermissions(['nuevo:leer'])[0].label).toBe('nuevo');
  });
});

describe('etiquetas', () => {
  it('permissionActionLabel humaniza la accion', () => {
    expect(permissionActionLabel('reservations:check-out')).toBe('Check out');
  });

  it('auditActionLabel quita la version del evento', () => {
    expect(auditActionLabel('UserRoleRevoked.v1')).toBe('UserRoleRevoked');
  });

  it('availableTimeZones incluye la zona actual aunque no este en la lista', () => {
    expect(availableTimeZones('Marte/Olimpo')[0]).toBe('Marte/Olimpo');
    // El default de las sucursales es un alias que los navegadores no listan.
    expect(availableTimeZones()).toContain('America/Argentina/Buenos_Aires');
    const zones = availableTimeZones('America/Argentina/Buenos_Aires');
    expect(zones.filter((zone) => zone === 'America/Argentina/Buenos_Aires')).toHaveLength(1);
  });
});
