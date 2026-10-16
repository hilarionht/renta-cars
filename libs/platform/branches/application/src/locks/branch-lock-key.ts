// docs/persistence/10-DECISIONES.md #141: clave del lock transaccional de una sucursal.
// Compartido: quien agrega reservas en ella (confirmar, cambiar de vehiculo). Exclusivo: el
// cierre, que verifica antes que no haya reservas activas. Siempre antes que el del vehiculo.
export function branchLockKey(branchId: string): string {
  return `branch:${branchId}`;
}
