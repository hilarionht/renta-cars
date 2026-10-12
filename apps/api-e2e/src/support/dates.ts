// Fechas relativas a "ahora" para los specs e2e (docs/persistence/10-DECISIONES.md #129).
//
// Los specs que crean reservas hacen check-out/check-in en el momento real de la corrida:
// con fechas fijas, en cuanto el endDate queda en el pasado el check-in suma LateReturnPenalty
// y cambian los montos (ya paso con cancel-reservation e invoices-lifecycle, #124/#126). Lo
// mismo para fechas de vencimiento "lejanas" escritas a mano (p.ej. 2030-01-01).
//
// Todas las fechas se anclan a un dia UTC a una hora fija, para que las aserciones que
// dependen de la posicion relativa (p.ej. utilizacion de flota en reports) den siempre igual.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Medianoche UTC del dia `offsetDays` desde hoy, mas `hourUtc` horas. */
export function utcDayFromNow(offsetDays: number, hourUtc = 0): Date {
  const date = new Date(Date.now() + offsetDays * DAY_MS);
  date.setUTCHours(hourUtc, 0, 0, 0);
  return date;
}

/** Desplaza una fecha `days` dias (puede ser negativo). */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Ventana de alquiler futura: empieza `offsetDays` dias desde hoy a las 10:00 UTC y dura
 * `durationDays` dias. Siempre en el futuro, asi check-out/check-in "ahora" nunca son tardios.
 */
export function futureRentalWindow(
  offsetDays = 30,
  durationDays = 3,
): { start: Date; startDate: string; endDate: string } {
  const start = utcDayFromNow(offsetDays, 10);
  return {
    start,
    startDate: start.toISOString(),
    endDate: addDays(start, durationDays).toISOString(),
  };
}

/** Vencimiento de documentos que nunca debe alcanzarse durante el test (hoy + 5 anios). */
export function farFutureExpiryDate(): string {
  return utcDayFromNow(5 * 365).toISOString();
}

/** Solo `{ startDate, endDate }` de una ventana futura, para esparcir directo en un body. */
export function futureRentalDates(
  offsetDays = 30,
  durationDays = 3,
): { startDate: string; endDate: string } {
  const { startDate, endDate } = futureRentalWindow(offsetDays, durationDays);
  return { startDate, endDate };
}
