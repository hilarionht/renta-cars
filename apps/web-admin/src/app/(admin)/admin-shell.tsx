'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { useCurrentUser, usePermissions, useWebAuth } from '@frontend/data-access-web';
import { Button, Spinner } from '@frontend/ui-kit-web';

import { NAV_ITEMS, isActive, visibleNavItems } from '../../lib/navigation';
import styles from './admin-shell.module.css';

// Shell del area protegida (docs/persistence/10-DECISIONES.md #134). El proxy ya redirige sin
// la cookie indicadora; esto cubre el caso en que la cookie existe pero la sesion no se pudo
// recuperar (refresh fallido): vuelve a /login conservando la ruta.
export function AdminShell({ children }: { children: ReactNode }) {
  const { status, logout } = useWebAuth();
  const { data: user } = useCurrentUser();
  const permissions = usePermissions();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') {
      const next = pathname && pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${next}`);
    }
  }, [status, pathname, router]);

  if (status !== 'authenticated') {
    return (
      <div className={styles.centered}>
        <Spinner label="Cargando sesión" />
      </div>
    );
  }

  const items = visibleNavItems(NAV_ITEMS, permissions.hasAnyWithPrefix);

  const onLogout = async () => {
    await logout().catch(() => undefined);
    router.replace('/login');
  };

  return (
    <div className={styles.shell}>
      <nav className={styles.sidebar} aria-label="Navegación principal">
        <p className={styles.brand}>Renta · Administración</p>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={[styles.navLink, isActive(pathname, item.href) ? styles.active : '']
              .filter(Boolean)
              .join(' ')}
            aria-current={isActive(pathname, item.href) ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className={styles.main}>
        <header className={styles.topbar}>
          <span className={styles.user}>{user ? `${user.name} · ${user.email}` : ''}</span>
          <Button variant="secondary" onClick={() => void onLogout()}>
            Cerrar sesión
          </Button>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
