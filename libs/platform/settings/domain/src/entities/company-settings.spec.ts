import { EnabledProductModulesEmptyError } from '../errors/enabled-product-modules-empty.error';
import { PaymentMethodsEmptyError } from '../errors/payment-methods-empty.error';
import { CancellationPolicy } from '../value-objects/cancellation-policy';
import { DepositPolicy } from '../value-objects/deposit-policy';
import { DraftExpirationPolicy } from '../value-objects/draft-expiration-policy';
import { LateReturnPolicy } from '../value-objects/late-return-policy';
import { MinimumBookingLeadTime } from '../value-objects/minimum-booking-lead-time';
import { PaymentMethod } from '../value-objects/payment-method';
import { CompanySettings } from './company-settings';

function createSettings(): CompanySettings {
  return CompanySettings.create({ companyId: 'company-a' });
}

describe('CompanySettings', () => {
  describe('create', () => {
    it('fija los defaults de Plataforma (Rental habilitado, los 4 metodos de pago) sin emitir ningun evento', () => {
      const settings = createSettings();

      expect(settings.enabledProductModules).toEqual(['Rental']);
      expect(settings.paymentMethodsEnabled.map((method) => method.toString()).sort()).toEqual(
        ['Card', 'Cash', 'DigitalWallet', 'Transfer'].sort(),
      );
      expect(settings.isNew).toBe(true);
      // create() no emite evento - solo los metodos de update lo hacen (mismo criterio que
      // Company.reactivate()).
      expect(settings.pullDomainEvents()).toHaveLength(0);
    });

    it('fija los defaults neutrales de las 5 politicas de Reservation', () => {
      const settings = createSettings();

      expect(settings.cancellationPolicy.tiers).toEqual([
        { minHoursBeforeStart: 0, penaltyPercentage: 0 },
      ]);
      expect(settings.lateReturnPolicy.graceMinutes).toBe(30);
      expect(settings.lateReturnPolicy.penaltyPercentagePerHour).toBe(10);
      expect(settings.depositPolicy.applies).toBe(false);
      expect(settings.draftExpirationPolicy.expirationMinutes).toBe(1440);
      expect(settings.minimumBookingLeadTime.leadTimeMinutes).toBe(0);
    });
  });

  describe('updateCancellationPolicy/updateLateReturnPolicy/updateDepositPolicy/updateDraftExpirationPolicy/updateMinimumBookingLeadTime', () => {
    it('reemplazan la politica, bumpean version y emiten CompanySettingsUpdated.v1 con su policyName', () => {
      const settings = createSettings();

      settings.updateCancellationPolicy(
        CancellationPolicy.from([{ minHoursBeforeStart: 48, penaltyPercentage: 50 }]),
      );
      settings.updateLateReturnPolicy(
        LateReturnPolicy.from({ graceMinutes: 15, penaltyPercentagePerHour: 20 }),
      );
      settings.updateDepositPolicy(DepositPolicy.from({ applies: true, percentageOfTotal: 30 }));
      settings.updateDraftExpirationPolicy(DraftExpirationPolicy.from(60));
      settings.updateMinimumBookingLeadTime(MinimumBookingLeadTime.from(30));

      const events = settings.pullDomainEvents();
      expect(events.map((event) => event.policyName)).toEqual([
        'cancellation-policy',
        'late-return-policy',
        'deposit-policy',
        'draft-expiration-policy',
        'minimum-booking-lead-time',
      ]);
      expect(settings.version).toBe(6);
    });
  });

  describe('updateEnabledProductModules', () => {
    it('reemplaza el conjunto, hace trim, bump de version y emite CompanySettingsUpdated.v1', () => {
      const settings = createSettings();
      const versionBefore = settings.version;

      settings.updateEnabledProductModules(['Rental', ' Workshop ']);

      expect(settings.enabledProductModules).toEqual(['Rental', 'Workshop']);
      expect(settings.version).toBe(versionBefore + 1);
      const events = settings.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventType: 'CompanySettingsUpdated.v1',
        companyId: 'company-a',
        policyName: 'enabled-product-modules',
        newValueSummary: JSON.stringify(['Rental', 'Workshop']),
      });
    });

    it('acepta un modulo no conocido (conjunto abierto por diseño, sin catalogo cerrado)', () => {
      const settings = createSettings();
      expect(() => settings.updateEnabledProductModules(['SomethingNew'])).not.toThrow();
    });

    it('lanza EnabledProductModulesEmptyError si el arreglo queda vacio tras filtrar blancos', () => {
      const settings = createSettings();
      expect(() => settings.updateEnabledProductModules(['  ', ''])).toThrow(
        EnabledProductModulesEmptyError,
      );
    });
  });

  describe('updatePaymentMethods', () => {
    it('reemplaza el conjunto, bump de version y emite CompanySettingsUpdated.v1', () => {
      const settings = createSettings();
      const versionBefore = settings.version;
      const methods = [PaymentMethod.from('Card')];

      settings.updatePaymentMethods(methods);

      expect(settings.paymentMethodsEnabled).toBe(methods);
      expect(settings.version).toBe(versionBefore + 1);
      const events = settings.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventType: 'CompanySettingsUpdated.v1',
        companyId: 'company-a',
        policyName: 'payment-methods-enabled',
        newValueSummary: JSON.stringify(['Card']),
      });
    });

    it('lanza PaymentMethodsEmptyError si el arreglo queda vacio', () => {
      const settings = createSettings();
      expect(() => settings.updatePaymentMethods([])).toThrow(PaymentMethodsEmptyError);
    });
  });
});
