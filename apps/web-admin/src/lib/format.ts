import { formatInTimeZone } from '@frontend/data-access-core';

// Formato de montos y fechas (docs/06-CONVENCIONES-FRONTEND.md SS10). Montos desde el VO Money
// del API (unidad minima + moneda): la division es solo para mostrar, nunca se opera en float.
// Fechas de reservas: en la zona horaria de la sucursal del vehiculo (docs/persistence/
// 10-DECISIONES.md #135, cierra el gap de #134).
export function formatMoney(minorUnits: number, currency: string): string {
  return new Intl.NumberFormat('es', { style: 'currency', currency }).format(minorUnits / 100);
}

// Sin zona (sucursales todavia cargando, o un dato sin sucursal) cae a la del navegador.
export function formatDateTime(iso: string, timeZone?: string): string {
  if (timeZone) {
    return formatInTimeZone(iso, timeZone);
  }
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

export function shortId(id: string): string {
  return id.slice(-6).toUpperCase();
}
