import { buildPermissions } from './current-user';
import { clearSessionIndicator, hasSessionIndicator, markSessionActive } from './session-indicator';

// docs/persistence/10-DECISIONES.md #134.
describe('cookie indicadora de sesion', () => {
  afterEach(() => clearSessionIndicator());

  it('marca, detecta y limpia la sesion', () => {
    expect(hasSessionIndicator()).toBe(false);
    markSessionActive();
    expect(hasSessionIndicator()).toBe(true);
    expect(document.cookie).toContain('renta_session=1');
    clearSessionIndicator();
    expect(hasSessionIndicator()).toBe(false);
  });
});

describe('buildPermissions', () => {
  const permissions = buildPermissions(['reservations:create', 'settings:manage'], false);

  it('has / hasAny', () => {
    expect(permissions.has('reservations:create')).toBe(true);
    expect(permissions.has('users:create')).toBe(false);
    expect(permissions.hasAny(['users:create', 'settings:manage'])).toBe(true);
    expect(permissions.hasAny(['users:create'])).toBe(false);
  });

  it('hasAnyWithPrefix (menu de Administracion)', () => {
    expect(permissions.hasAnyWithPrefix(['users:', 'settings:'])).toBe(true);
    expect(buildPermissions(['reservations:create'], false).hasAnyWithPrefix(['users:'])).toBe(
      false,
    );
  });

  it('sin datos todavia, no concede nada', () => {
    const empty = buildPermissions(undefined, true);
    expect(empty.isLoading).toBe(true);
    expect(empty.has('reservations:create')).toBe(false);
  });
});
