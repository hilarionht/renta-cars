// Formato de montos y fechas (docs/06-CONVENCIONES-FRONTEND.md SS10). Montos desde el VO Money
// del API (unidad minima + moneda): la division es solo para mostrar, nunca se opera en float.
// Gap aceptado (#134): las fechas se muestran en la zona horaria del navegador; la de la
// Branch llega con el modulo de Reservas (Incremento 2).
export function formatMoney(minorUnits: number, currency: string): string {
  return new Intl.NumberFormat('es', { style: 'currency', currency }).format(minorUnits / 100);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

export function shortId(id: string): string {
  return id.slice(-6).toUpperCase();
}
