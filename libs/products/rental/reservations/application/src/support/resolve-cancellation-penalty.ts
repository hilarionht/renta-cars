import { Money } from '@platform/shared-kernel';
import type { CancellationPolicyView } from '@platform/settings/application';

// Reimplementacion local de CancellationPolicy.penaltyPercentageFor() (platform-settings-
// domain) - reservations/application no puede importar type:domain de otro modulo
// (tooling/eslint/boundaries.mjs, INV-P03), asi que opera sobre el CancellationPolicyView
// plano que SETTINGS_LOOKUP_PORT ya expone, no sobre el VO. Usado por cancel()/
// markNoShow() (RN-26/RN-19 - "misma politica de cancelacion tardia").
export function resolveCancellationPenalty(
  policy: CancellationPolicyView,
  hoursBeforeStart: number,
  baseAmount: Money,
): Money | undefined {
  const applicable = [...policy.tiers]
    .filter((tier) => hoursBeforeStart >= tier.minHoursBeforeStart)
    .sort((a, b) => b.minHoursBeforeStart - a.minHoursBeforeStart)[0];
  const percentage = applicable?.penaltyPercentage ?? 100;
  if (percentage <= 0) {
    return undefined;
  }
  return Money.from(
    Math.round(baseAmount.minorUnits * (percentage / 100)),
    baseAmount.currencyCode,
  );
}
