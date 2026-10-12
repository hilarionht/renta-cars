// docs/model/04-VALUE_OBJECTS.md SS3 - "Rango horario valido por dia de semana". Un dia
// ausente del arreglo significa cerrado ese dia - sin mas estructura especificada en los
// docs, se modela como el minimo que representa "un rango por dia, algunos dias pueden no
// tenerlo".
export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface DaySchedule {
  day: Weekday;
  open: string; // "HH:mm"
  close: string; // "HH:mm"
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class OperatingHours {
  private constructor(private readonly schedule: readonly DaySchedule[]) {}

  static from(raw: DaySchedule[]): OperatingHours {
    const seenDays = new Set<Weekday>();
    for (const entry of raw) {
      if (seenDays.has(entry.day)) {
        throw new TypeError(`OperatingHours tiene mas de una entrada para "${entry.day}".`);
      }
      seenDays.add(entry.day);

      if (!TIME_PATTERN.test(entry.open) || !TIME_PATTERN.test(entry.close)) {
        throw new TypeError(`OperatingHours: horario invalido para "${entry.day}".`);
      }
      if (entry.open >= entry.close) {
        throw new TypeError(`OperatingHours: "open" debe ser antes que "close" en "${entry.day}".`);
      }
    }
    return new OperatingHours(raw);
  }

  toSchedule(): readonly DaySchedule[] {
    return this.schedule;
  }
}
