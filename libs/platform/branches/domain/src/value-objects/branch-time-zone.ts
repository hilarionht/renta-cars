import { InvalidValueError } from '@platform/shared-kernel';

// VO agregado (docs/persistence/10-DECISIONES.md #135): zona horaria IANA de la sucursal. Las
// fechas de una reserva se muestran e ingresan en la zona de la sucursal del vehiculo. Se
// valida con Intl (sin dependencias) y se guarda el nombre tal como viene: NO el de
// resolvedOptions(), porque ICU lo reemplaza por su alias canonico (p.ej.
// America/Argentina/Buenos_Aires -> America/Buenos_Aires) y cambiaria el valor elegido.
export const DEFAULT_BRANCH_TIME_ZONE = 'America/Argentina/Buenos_Aires';

export class BranchTimeZone {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static from(raw: string): BranchTimeZone {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new InvalidValueError('BranchTimeZone no puede estar vacia');
    }
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: trimmed });
    } catch {
      throw new InvalidValueError(`BranchTimeZone no es una zona IANA valida: "${raw}"`);
    }
    return new BranchTimeZone(trimmed);
  }

  static default(): BranchTimeZone {
    return new BranchTimeZone(DEFAULT_BRANCH_TIME_ZONE);
  }

  toString(): string {
    return this.value;
  }
}
