// docs/model/08-STATE_MACHINES.md SS4 - 2 estados, terminal en ambos (Voided nunca vuelve a
// Issued; Issued nunca vuelve a nada, solo transiciona a Voided).
export type InvoiceStatusValue = 'Issued' | 'Voided';
