import type { ReactNode } from 'react';

import styles from './badge.module.css';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

// El mapeo estado de negocio -> tone lo decide la feature, no el componente (no sabe de
// reservas, docs/06 SS7).
export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={[styles.badge, styles[tone]].join(' ')}>{children}</span>;
}
