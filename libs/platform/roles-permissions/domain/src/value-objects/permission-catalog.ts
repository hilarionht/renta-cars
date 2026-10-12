// Catalogo de permisos versionado en codigo, nunca una tabla (docs/persistence/
// 07-MIGRACIONES.md SS5.1) - agregar un permiso es un cambio de codigo revisado, no una
// fila que cualquiera pueda insertar en runtime. Identity & Access (Fase 0) mas el resto
// de modulos de negocio, agregados en Fase 4 item 2 (RBAC completo, docs/persistence/
// 10-DECISIONES.md) - derivados 1:1 de las rutas mutantes reales de cada controller, nunca
// un catalogo paralelo. Granularidad: fina por defecto (mismo nivel que users:*, ya
// establecido) - vehicles/vehicle-categories usan una clave amplia ":manage" porque
// docs/09-SEGURIDAD.md SS2 da "vehicles:manage" como ejemplo explicito (vs.
// "reservations:create"/"reservations:cancel", finos, mismo parrafo). settings:manage
// (una sola clave para las 9 politicas - todas son "definir politica comercial",
// responsabilidad unica del Administrador de Empresa, docs/domain/01-ACTORES.md SS2.1).
// customers separa clerical (manage-documents: subir/registrar) de aprobacion
// (verify-documents: verificar/validar/revocar - decision de pie, mismo nivel que
// block/unblock). audit:read es la unica clave de LECTURA de todo el catalogo - cierra el
// gap que la decision #102 dejo pendiente ("proteger audit-log requeriria RBAC completo").
// companies:suspend/reactivate NO tienen clave - esas 2 operaciones no estan expuestas por
// ninguna ruta (requieren un mecanismo platform-admin cross-tenant que no existe todavia,
// CompaniesController).
export const PERMISSION_CATALOG = [
  'users:create',
  'users:edit',
  'users:disable',
  'users:reactivate',
  'users:change-password',
  'users:assign-role',
  'users:revoke-role',
  'roles:create',
  'roles:edit-permissions',
  'roles:deactivate',
  'companies:edit',
  'branches:create',
  'branches:edit',
  'branches:close',
  'branches:reopen',
  'customers:create',
  'customers:edit',
  'customers:block',
  'customers:unblock',
  'customers:manage-documents',
  'customers:verify-documents',
  'vehicles:manage',
  'vehicle-categories:manage',
  'reservations:create',
  'reservations:confirm',
  'reservations:cancel',
  'reservations:mark-no-show',
  'reservations:check-out',
  'reservations:check-in',
  'reservations:reschedule',
  'reservations:request-extension',
  'reservations:approve-extension',
  'reservations:swap-vehicle',
  'payments:request',
  'payments:authorize',
  'payments:capture',
  'payments:refund',
  'security-deposits:release',
  'security-deposits:retain',
  'invoices:void',
  'files:upload',
  'files:delete',
  'settings:manage',
  'audit:read',
] as const;

export type PermissionKey = (typeof PERMISSION_CATALOG)[number];
