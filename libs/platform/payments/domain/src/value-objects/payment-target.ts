// docs/persistence/10-DECISIONES.md #4 - Payment.target es polimorfico y siempre opaco,
// sin FK, incluso hacia security_deposits pese a compartir schema. Union type discriminado,
// mismo criterio que SlotKindValue en Calendar.
export type PaymentTargetTypeValue = 'Invoice' | 'SecurityDeposit';
