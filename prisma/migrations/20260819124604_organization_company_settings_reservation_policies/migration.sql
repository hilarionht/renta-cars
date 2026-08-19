-- Reservations, docs/persistence/10-DECISIONES.md #59: 5 politicas gap-filled agregadas a
-- CompanySettings (CancellationPolicy, LateReturnPolicy, DepositPolicy,
-- DraftExpirationPolicy, MinimumBookingLeadTime). ADD COLUMN con DEFAULT (no solo backfill
-- puntual) para que las columnas queden con un valor sano ante cualquier INSERT futuro que
-- no pase por CompanySettings.create() - mismos defaults neutrales que cada VO expone via
-- *.default(). El default queda en la columna (no se DROP DEFAULT despues) a diferencia de
-- otras migraciones Expand de esta tanda, porque aca sirve como red de seguridad legitima,
-- no como un valor de negocio que el dominio deba decidir.
ALTER TABLE "organization"."company_settings"
  ADD COLUMN "cancellation_policy_tiers" JSONB NOT NULL
    DEFAULT '[{"minHoursBeforeStart":0,"penaltyPercentage":0}]',
  ADD COLUMN "late_return_grace_minutes" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "late_return_penalty_pct_per_hour" DOUBLE PRECISION NOT NULL DEFAULT 10,
  ADD COLUMN "deposit_applies" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deposit_percentage_of_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "draft_expiration_minutes" INTEGER NOT NULL DEFAULT 1440,
  ADD COLUMN "minimum_booking_lead_time_minutes" INTEGER NOT NULL DEFAULT 0;
