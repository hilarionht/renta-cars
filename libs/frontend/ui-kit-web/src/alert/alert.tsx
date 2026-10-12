import type { ReactNode } from 'react';

import styles from './alert.module.css';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

export function Alert({ tone = 'info', children }: { tone?: AlertTone; children: ReactNode }) {
  // role=alert para errores (anunciado de inmediato); status para el resto.
  return (
    <div
      className={[styles.alert, styles[tone]].join(' ')}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}
