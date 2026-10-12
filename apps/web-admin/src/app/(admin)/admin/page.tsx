'use client';

import { usePermissions } from '@frontend/data-access-web';
import { Alert, PageHeader } from '@frontend/ui-kit-web';

import { ADMINISTRATION_PERMISSION_PREFIXES } from '../../../lib/navigation';
import { ComingSoon } from '../coming-soon';

// Ademas de ocultarlo en el menu, la pagina misma se protege si alguien entra por URL. Igual
// la autorizacion real la hace el API en cada accion.
export default function AdministrationPage() {
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
  return <ComingSoon title="Administración" increment={5} />;
}
