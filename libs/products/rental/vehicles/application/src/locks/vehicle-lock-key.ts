// docs/persistence/10-DECISIONES.md #141: clave del lock transaccional de un vehiculo.
// Compartido: quien le agrega o mueve reservas (confirmar, cambiar de vehiculo, reprogramar,
// extender). Exclusivo: mantenimiento, dano y fuera de servicio, que verifican antes que no
// queden reservas sin auto. Siempre despues del de la sucursal.
export function vehicleLockKey(vehicleId: string): string {
  return `vehicle:${vehicleId}`;
}
