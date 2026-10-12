import type { ReactNode } from 'react';

import { AdminShell } from './admin-shell';

// Area protegida: sidebar + header con el usuario (docs/persistence/10-DECISIONES.md #134).
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
