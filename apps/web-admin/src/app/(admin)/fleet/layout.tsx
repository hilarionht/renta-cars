'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { Tabs } from '@frontend/ui-kit-web';

// Modulo Flota (docs/persistence/10-DECISIONES.md #137): pestanas Vehiculos | Categorias.
const TABS = [
  { key: 'vehicles', label: 'Vehículos', href: '/fleet' },
  { key: 'categories', label: 'Categorías', href: '/fleet/categories' },
] as const;

export default function FleetLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeKey = pathname.startsWith('/fleet/categories') ? 'categories' : 'vehicles';
  return (
    <>
      <Tabs items={TABS} activeKey={activeKey} label="Secciones de flota" linkComponent={Link} />
      {children}
    </>
  );
}
