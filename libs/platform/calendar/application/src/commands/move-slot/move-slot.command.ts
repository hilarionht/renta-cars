// docs/persistence/10-DECISIONES.md #136. Sin companyId, mismo criterio que ReleaseSlotCommand:
// solo se invoca via CALENDAR_PORT y RLS garantiza el tenant.
export interface MoveSlotCommand {
  slotId: string;
  startDate: Date;
  endDate: Date;
}
