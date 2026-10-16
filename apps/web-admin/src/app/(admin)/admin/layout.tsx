'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { usePermissions } from '@frontend/data-access-web';
import { Alert, PageHeader, Tabs } from '@frontend/ui-kit-web';

import { ADMINISTRATION_PERMISSION_PREFIXES } from '../../../lib/navigation';

// Modulo Administracion (docs/persistence/10-DECISIONES.md #140): pestanas Usuarios | Roles |
// Sucursales | Empresa | Auditoria. Ademas de ocultarlo en el menu, se protege si alguien entra
// por URL; la autorizacion real la hace el API en cada accion. Leer es libre para el personal
// salvo la auditoria (audit:read).
const TABS = [
  { key: 'users', label: 'Usuarios', href: '/admin/users' },
  { key: 'roles', label: 'Roles', href: '/admin/roles' },
  { key: 'branches', label: 'Sucursales', href: '/admin/branches' },
  { key: 'company', label: 'Empresa', href: '/admin/company' },
  { key: 'audit', label: 'Auditoría', href: '/admin/audit' },
] as const;

export default function AdministrationLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const permissions = usePermissions();
  if (permissions.isLoading) {
    return null;
  }
  if (!permissions.hasAnyWithPrefix(ADMINISTRATION_PERMISSION_PREFIXES)) {
    return (
      <>
        <PageHeader title="Administración" />
        <Alert tone="warning">No tenés permisos para administrar la empresa.</Alert>
      </>
    );
  }
  const items = TABS.filter((tab) => tab.key !== 'audit' || permissions.has('audit:read'));
  const activeKey = TABS.find((tab) => pathname.startsWith(tab.href))?.key ?? 'users';
  return (
    <>
      <Tabs
        items={items}
        activeKey={activeKey}
        label="Secciones de administración"
        linkComponent={Link}
      />
      {children}
    </>
  );
}
