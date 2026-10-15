// Parseo de campos de formulario compartido por los modulos de la web (Reservas #135, Flota
// #137). Sin float para montos: se arman desde los digitos.

export function parseInteger(value: string): number | undefined {
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : undefined;
}

// "1500,50" o "1500.50" -> 150050 unidades minimas.
export function parseMoneyToMinorUnits(value: string): number | undefined {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) {
    return undefined;
  }
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}
