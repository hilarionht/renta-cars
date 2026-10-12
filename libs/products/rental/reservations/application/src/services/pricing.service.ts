import { Inject, Injectable } from '@nestjs/common';

import { DateRange, Money } from '@platform/shared-kernel';
import {
  SETTINGS_LOOKUP_PORT,
  type LateReturnPolicyView,
  type SettingsLookupPort,
} from '@platform/settings/application';
import {
  VEHICLE_CATEGORY_LOOKUP_PORT,
  type VehicleCategoryLookupPort,
} from '@rental/vehicles/application';
import { NoActiveRateError } from '@rental/reservations/domain';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MILLISECONDS_PER_WEEK = 7 * MILLISECONDS_PER_DAY;

// PricingService (docs/model/05-DOMAIN_SERVICES.md SS2) - el precio depende de
// VehicleCategory.Rate (otro agregado) y CompanySettings.LateReturnPolicy (otro Bounded
// Context), ninguna de las dos fuentes es dueña exclusiva del calculo. Vive en
// application/ por coordinar ambos puertos - nunca muta Reservation directamente, solo
// calcula y retorna Money; el propio Command Handler incorpora el resultado al
// PriceBreakdown via los metodos de Reservation.
@Injectable()
export class PricingService {
  constructor(
    @Inject(VEHICLE_CATEGORY_LOOKUP_PORT)
    private readonly vehicleCategoryLookupPort: VehicleCategoryLookupPort,
    @Inject(SETTINGS_LOOKUP_PORT) private readonly settingsLookupPort: SettingsLookupPort,
  ) {}

  // RN-20: la Rate usada es siempre la vigente en la fecha de calculo (asOf=now, no la
  // fecha de la cotizacion inicial), congelada desde ese momento.
  async calculateBasePrice(vehicleCategoryId: string, range: DateRange): Promise<Money> {
    const rate = await this.vehicleCategoryLookupPort.getCurrentRate(vehicleCategoryId, new Date());
    if (!rate) {
      throw new NoActiveRateError(vehicleCategoryId);
    }
    const units = unitsFor(range, rate.unit);
    return Money.from(rate.amountMinorUnits * units, rate.currency);
  }

  async recalculateForExtension(vehicleCategoryId: string, newRange: DateRange): Promise<Money> {
    return this.calculateBasePrice(vehicleCategoryId, newRange);
  }

  // Normaliza la Rate vigente a un monto "por dia" - necesario para
  // calculateLateReturnPenalty (RN-15, "tarifa por hora/dia de exceso"), que no puede usar
  // el baseAmount total de la Reservation (cubre TODO el rango, no un solo dia) como
  // referencia sin sobrecobrar en alquileres de mas de un dia.
  async getDailyRate(vehicleCategoryId: string): Promise<Money> {
    const rate = await this.vehicleCategoryLookupPort.getCurrentRate(vehicleCategoryId, new Date());
    if (!rate) {
      throw new NoActiveRateError(vehicleCategoryId);
    }
    const dailyMinorUnits =
      rate.unit === 'Week' ? Math.round(rate.amountMinorUnits / 7) : rate.amountMinorUnits;
    return Money.from(dailyMinorUnits, rate.currency);
  }

  async getLateReturnPolicy(companyId: string): Promise<LateReturnPolicyView> {
    const policy = await this.settingsLookupPort.getLateReturnPolicy(companyId);
    if (!policy) {
      throw new Error(`No existe CompanySettings para la company "${companyId}".`);
    }
    return policy;
  }

  // Puro, sin I/O - la tolerancia de gracia (RN-16) se aplica antes de generar cualquier
  // monto: dentro de la tolerancia, el resultado es Money(0), no la ausencia de un cargo
  // (texto literal de docs/model/05-DOMAIN_SERVICES.md SS2).
  calculateLateReturnPenalty(
    actualReturn: Date,
    scheduledReturn: Date,
    policy: LateReturnPolicyView,
    dailyRate: Money,
  ): Money {
    const excessMinutes = Math.max(0, (actualReturn.getTime() - scheduledReturn.getTime()) / 60000);
    if (excessMinutes <= policy.graceMinutes) {
      return Money.from(0, dailyRate.currencyCode);
    }
    const excessHours = Math.ceil((excessMinutes - policy.graceMinutes) / 60);
    const penaltyMinorUnits = Math.round(
      dailyRate.minorUnits * (policy.penaltyPercentagePerHour / 100) * excessHours,
    );
    return Money.from(penaltyMinorUnits, dailyRate.currencyCode);
  }

  // Gap-fill: RN-18 no fija una tarifa por diferencia de combustible (no existe una
  // FuelPolicy en el catalogo de 9 politicas de CompanySettings, docs/model/
  // 02-AGGREGATES.md SS6) - se modela proporcional al deficit porcentual sobre la tarifa
  // de referencia (un tanque completo faltante cuesta el equivalente a referenceAmount).
  calculateFuelDifferenceCharge(
    fuelAtCheckOutPercentage: number,
    fuelAtCheckInPercentage: number,
    referenceAmount: Money,
  ): Money {
    const deficit = Math.max(0, fuelAtCheckOutPercentage - fuelAtCheckInPercentage);
    if (deficit === 0) {
      return Money.from(0, referenceAmount.currencyCode);
    }
    const chargeMinorUnits = Math.round(referenceAmount.minorUnits * (deficit / 100));
    return Money.from(chargeMinorUnits, referenceAmount.currencyCode);
  }
}

function unitsFor(range: DateRange, unit: string): number {
  const spanMs = range.end.getTime() - range.start.getTime();
  const divisor = unit === 'Week' ? MILLISECONDS_PER_WEEK : MILLISECONDS_PER_DAY;
  return Math.max(1, Math.ceil(spanMs / divisor));
}
