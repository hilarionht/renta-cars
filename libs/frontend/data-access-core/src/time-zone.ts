// Fechas en la zona horaria de una sucursal (docs/persistence/10-DECISIONES.md #135). Sin
// dependencias: solo Intl. El API guarda y devuelve instantes UTC (ISO 8601); la web los
// muestra e ingresa en la zona IANA de la sucursal del vehiculo, no en la del navegador.

// Valor de un <input type="datetime-local">: "YYYY-MM-DDTHH:mm".
export type ZonedLocalDateTime = string;

export class NonexistentLocalTimeError extends Error {
  constructor(local: string, timeZone: string) {
    super(`La hora ${local} no existe en ${timeZone} (cambio de horario).`);
    this.name = 'NonexistentLocalTimeError';
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatterCache.get(timeZone);
  if (!formatter) {
    // hourCycle h23: con hour12:false algunos motores devuelven "24" a medianoche.
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    partsFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

// Hora de pared en `timeZone` del instante `epochMs`, expresada como si fuera UTC.
function wallClockAsUtc(epochMs: number, timeZone: string): number {
  const parts: Record<string, number> = {};
  for (const part of partsFormatter(timeZone).formatToParts(new Date(epochMs))) {
    if (part.type !== 'literal') {
      parts[part.type] = Number(part.value);
    }
  }
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Instante UTC (ISO) -> hora de pared en la zona, en formato de datetime-local. */
export function utcIsoToZonedLocal(iso: string, timeZone: string): ZonedLocalDateTime {
  const wall = new Date(wallClockAsUtc(new Date(iso).getTime(), timeZone));
  return `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}T${pad(
    wall.getUTCHours(),
  )}:${pad(wall.getUTCMinutes())}`;
}

/**
 * Hora de pared en la zona -> instante UTC (ISO). Los offsets posibles de la zona alrededor
 * de esa fecha son los de un dia antes y un dia despues (un cambio de horario por dia como
 * mucho); cada uno da un candidato, y se queda con los que efectivamente muestran esa hora.
 * Lanza NonexistentLocalTimeError si la hora cae en el salto de un cambio de horario; en la
 * hora repetida del retroceso, elige la primera ocurrencia.
 */
export function zonedLocalToUtcIso(local: ZonedLocalDateTime, timeZone: string): string {
  const match = LOCAL_PATTERN.exec(local);
  if (!match) {
    throw new TypeError(`Fecha local invalida: "${local}" (se espera YYYY-MM-DDTHH:mm).`);
  }
  const [, year, month, day, hour, minute] = match.map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);

  const offsets = new Set(
    [target - DAY_MS, target, target + DAY_MS].map(
      (probe) => wallClockAsUtc(probe, timeZone) - probe,
    ),
  );
  const candidates = [...offsets]
    .map((offset) => target - offset)
    .filter((candidate) => wallClockAsUtc(candidate, timeZone) === target)
    .sort((a, b) => a - b);
  if (candidates.length === 0) {
    throw new NonexistentLocalTimeError(local, timeZone);
  }
  return new Date(candidates[0]).toISOString();
}

/** Fecha y hora legibles en la zona de la sucursal; con withZoneName agrega la abreviatura. */
export function formatInTimeZone(
  iso: string,
  timeZone: string,
  options: { locale?: string; withZoneName?: boolean } = {},
): string {
  const { locale = 'es', withZoneName = false } = options;
  const date = new Date(iso);
  const formatted = new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
  if (!withZoneName) {
    return formatted;
  }
  const zoneName = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'short' })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value;
  return zoneName ? `${formatted} (${zoneName})` : formatted;
}
