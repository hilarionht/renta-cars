import type { ReactNode } from 'react';

import styles from './auth-layout.module.css';

// Rutas publicas (login, olvide mi contrasena, reset): sin sidebar, tarjeta centrada.
// docs/persistence/10-DECISIONES.md #134.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.brand}>Renta · Administración</p>
        {children}
      </div>
    </main>
  );
}
