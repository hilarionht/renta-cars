import { DateRange, EntityId, Money } from '@platform/shared-kernel';

import { BranchClosedError } from '../errors/branch-closed.error';
import { CustomerNotEligibleError } from '../errors/customer-not-eligible.error';
import { DriverNotValidatedError } from '../errors/driver-not-validated.error';
import { ExtensionCollidesError } from '../errors/extension-collides.error';
import { InspectionRequiredError } from '../errors/inspection-required.error';
import { InvoiceNotYetIssuedError } from '../errors/invoice-not-yet-issued.error';
import { ReservationInvalidStateTransitionError } from '../errors/reservation-invalid-state-transition.error';
import { VehicleNotAvailableError } from '../errors/vehicle-not-available.error';
import { FuelLevel } from '../value-objects/fuel-level';
import { Odometer } from '../value-objects/odometer';
import { Reservation } from './reservation';

function range(start = '2026-09-01T10:00:00Z', end = '2026-09-05T10:00:00Z'): DateRange {
  return DateRange.from(new Date(start), new Date(end));
}

function amount(minorUnits = 10000): Money {
  return Money.from(minorUnits, 'USD');
}

function createDraft(): Reservation {
  const reservation = Reservation.create({
    companyId: 'company-1',
    customerId: 'customer-1',
    vehicleId: 'vehicle-1',
    dateRange: range(),
    baseAmount: amount(),
  });
  reservation.pullDomainEvents();
  return reservation;
}

function createConfirmed(): Reservation {
  const reservation = createDraft();
  reservation.confirm({
    baseAmount: amount(),
    isCustomerEligible: true,
    areDriversValidated: true,
  });
  reservation.pullDomainEvents();
  return reservation;
}

function createCheckedOut(): Reservation {
  const reservation = createConfirmed();
  reservation.checkOut({
    odometer: Odometer.from(1000),
    fuelLevel: FuelLevel.from(100),
    photoFileIds: ['file-1'],
    inspectedBy: 'user-1',
    isVehicleOperational: true,
    isBranchActive: true,
    branchId: 'branch-1',
    areDriversValidated: true,
  });
  reservation.pullDomainEvents();
  return reservation;
}

describe('Reservation', () => {
  describe('create', () => {
    it('crea en Draft, version 1, y emite ReservationCreated.v1', () => {
      const reservation = Reservation.create({
        companyId: 'company-1',
        customerId: 'customer-1',
        vehicleId: 'vehicle-1',
        dateRange: range(),
        baseAmount: amount(),
      });

      expect(reservation.status).toBe('Draft');
      expect(reservation.version).toBe(1);
      expect(reservation.isNew).toBe(true);
      const events = reservation.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ eventType: 'ReservationCreated.v1', status: 'Draft' });
    });
  });

  describe('confirm', () => {
    it('Draft -> Confirmed, bumpea version, fija baseAmount y emite ReservationConfirmed.v1', () => {
      const reservation = createDraft();
      const versionBefore = reservation.version;

      reservation.confirm({
        baseAmount: amount(20000),
        isCustomerEligible: true,
        areDriversValidated: true,
      });

      expect(reservation.status).toBe('Confirmed');
      expect(reservation.version).toBe(versionBefore + 1);
      expect(reservation.baseAmount.minorUnits).toBe(20000);
      const events = reservation.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ eventType: 'ReservationConfirmed.v1' });
    });

    it('lanza CustomerNotEligibleError si isCustomerEligible=false', () => {
      const reservation = createDraft();
      expect(() =>
        reservation.confirm({
          baseAmount: amount(),
          isCustomerEligible: false,
          areDriversValidated: true,
        }),
      ).toThrow(CustomerNotEligibleError);
    });

    it('lanza DriverNotValidatedError si areDriversValidated=false', () => {
      const reservation = createDraft();
      expect(() =>
        reservation.confirm({
          baseAmount: amount(),
          isCustomerEligible: true,
          areDriversValidated: false,
        }),
      ).toThrow(DriverNotValidatedError);
    });

    it('lanza ReservationInvalidStateTransitionError si no esta Draft', () => {
      const reservation = createConfirmed();
      expect(() =>
        reservation.confirm({
          baseAmount: amount(),
          isCustomerEligible: true,
          areDriversValidated: true,
        }),
      ).toThrow(ReservationInvalidStateTransitionError);
    });
  });

  describe('cancel', () => {
    it('Draft -> Cancelled sin penalidad', () => {
      const reservation = createDraft();
      reservation.cancel({ cancelledBy: 'customer-1' });
      expect(reservation.status).toBe('Cancelled');
      const events = reservation.pullDomainEvents();
      expect(events[0]).toMatchObject({
        eventType: 'ReservationCancelled.v1',
        penaltyApplied: undefined,
      });
    });

    it('Confirmed -> Cancelled con penalidad registra un PriceAdjustment CancellationPenalty', () => {
      const reservation = createConfirmed();
      reservation.cancel({ cancelledBy: 'agent-1', penalty: amount(500), penaltyReason: 'tardia' });
      expect(reservation.allPriceAdjustments).toHaveLength(1);
      expect(reservation.allPriceAdjustments[0].kind).toBe('CancellationPenalty');
      const events = reservation.pullDomainEvents();
      expect(events[0]).toMatchObject({
        eventType: 'ReservationCancelled.v1',
        penaltyApplied: { kind: 'CancellationPenalty', amountMinorUnits: 500 },
      });
    });

    it('lanza ReservationInvalidStateTransitionError si esta CheckedOut (excepcion operativa, docs/domain/07-EXCEPCIONES.md SS2)', () => {
      const reservation = createCheckedOut();
      expect(() => reservation.cancel({ cancelledBy: 'operator-1' })).toThrow(
        ReservationInvalidStateTransitionError,
      );
    });
  });

  describe('markNoShow', () => {
    it('Confirmed -> Cancelled y emite NoShowRegistered.v1', () => {
      const reservation = createConfirmed();
      reservation.markNoShow({ penalty: amount(1000) });
      expect(reservation.status).toBe('Cancelled');
      const events = reservation.pullDomainEvents();
      expect(events[0]).toMatchObject({ eventType: 'NoShowRegistered.v1' });
    });

    it('lanza ReservationInvalidStateTransitionError si no esta Confirmed', () => {
      const reservation = createDraft();
      expect(() => reservation.markNoShow({})).toThrow(ReservationInvalidStateTransitionError);
    });
  });

  describe('checkOut', () => {
    const validParams = {
      odometer: Odometer.from(1000),
      fuelLevel: FuelLevel.from(100),
      photoFileIds: ['file-1'],
      inspectedBy: 'user-1',
      isVehicleOperational: true,
      isBranchActive: true,
      branchId: 'branch-1',
      areDriversValidated: true,
    };

    it('Confirmed -> CheckedOut, registra Inspection CheckOut y emite ReservationCheckedOut.v1', () => {
      const reservation = createConfirmed();
      const inspectionId = reservation.checkOut(validParams);

      expect(reservation.status).toBe('CheckedOut');
      expect(reservation.allInspections).toHaveLength(1);
      expect(reservation.allInspections[0].type).toBe('CheckOut');
      expect(reservation.pullDirtyInspections()).toHaveLength(1);
      const events = reservation.pullDomainEvents();
      expect(events[0]).toMatchObject({
        eventType: 'ReservationCheckedOut.v1',
        inspectionId: inspectionId.toString(),
        odometer: 1000,
      });
    });

    it('lanza BranchClosedError si isBranchActive=false (INV-112)', () => {
      const reservation = createConfirmed();
      expect(() => reservation.checkOut({ ...validParams, isBranchActive: false })).toThrow(
        BranchClosedError,
      );
    });

    it('lanza VehicleNotAvailableError si isVehicleOperational=false (INV-103)', () => {
      const reservation = createConfirmed();
      expect(() => reservation.checkOut({ ...validParams, isVehicleOperational: false })).toThrow(
        VehicleNotAvailableError,
      );
    });

    it('lanza DriverNotValidatedError si areDriversValidated=false (INV-105)', () => {
      const reservation = createConfirmed();
      expect(() => reservation.checkOut({ ...validParams, areDriversValidated: false })).toThrow(
        DriverNotValidatedError,
      );
    });

    it('lanza ReservationInvalidStateTransitionError si no esta Confirmed (p. ej. Draft)', () => {
      const reservation = createDraft();
      expect(() => reservation.checkOut(validParams)).toThrow(
        ReservationInvalidStateTransitionError,
      );
    });
  });

  describe('checkIn', () => {
    const validParams = {
      odometer: Odometer.from(1200),
      fuelLevel: FuelLevel.from(80),
      photoFileIds: ['file-2'],
      inspectedBy: 'user-1',
      isBranchActive: true,
      branchId: 'branch-1',
    };

    it('CheckedOut -> CheckedIn, registra Inspection CheckIn y emite ReservationCheckedIn.v1', () => {
      const reservation = createCheckedOut();
      const inspectionId = reservation.checkIn(validParams);

      expect(reservation.status).toBe('CheckedIn');
      expect(reservation.allInspections).toHaveLength(2);
      const events = reservation.pullDomainEvents();
      expect(events[0]).toMatchObject({
        eventType: 'ReservationCheckedIn.v1',
        inspectionId: inspectionId.toString(),
      });
    });

    it('registra DamageReport y PriceAdjustment cuando se detecta dano (RN-17)', () => {
      const reservation = createCheckedOut();
      reservation.checkIn({
        ...validParams,
        damages: [
          {
            description: 'rayón puerta',
            severity: 'Minor',
            imputableToCustomer: true,
            photoFileIds: [],
          },
        ],
        adjustments: [{ amount: amount(300), kind: 'DamagePenalty' }],
      });

      expect(reservation.allDamageReports).toHaveLength(1);
      expect(reservation.pullDirtyDamageReports()).toHaveLength(1);
      expect(reservation.allPriceAdjustments).toHaveLength(1);
      expect(reservation.allPriceAdjustments[0].kind).toBe('DamagePenalty');
    });

    it('lanza BranchClosedError si isBranchActive=false (INV-112)', () => {
      const reservation = createCheckedOut();
      expect(() => reservation.checkIn({ ...validParams, isBranchActive: false })).toThrow(
        BranchClosedError,
      );
    });

    it('lanza ReservationInvalidStateTransitionError si no esta CheckedOut', () => {
      const reservation = createConfirmed();
      expect(() => reservation.checkIn(validParams)).toThrow(
        ReservationInvalidStateTransitionError,
      );
    });

    it('lanza InspectionRequiredError (defensivo) si esta CheckedOut sin una Inspection CheckOut previa', () => {
      const reservation = Reservation.reconstitute(
        {
          id: EntityId.generate<'Reservation'>(),
          companyId: 'company-1',
          customerId: 'customer-1',
          vehicleId: 'vehicle-1',
          dateRange: range(),
          status: 'CheckedOut',
          authorizedDriverIds: [],
          baseAmount: amount(),
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          version: 3,
        },
        [],
        [],
        [],
      );

      expect(() => reservation.checkIn(validParams)).toThrow(InspectionRequiredError);
    });
  });

  describe('reschedule', () => {
    it('Draft/Confirmed reemplaza el DateRange y recalcula baseAmount', () => {
      const reservation = createConfirmed();
      const newRange = range('2026-09-10T10:00:00Z', '2026-09-15T10:00:00Z');

      reservation.reschedule({ newRange, newBaseAmount: amount(50000), isNewRangeAvailable: true });

      expect(reservation.dateRange.equals(newRange)).toBe(true);
      expect(reservation.baseAmount.minorUnits).toBe(50000);
      const events = reservation.pullDomainEvents();
      expect(events[0]).toMatchObject({ eventType: 'ReservationRescheduled.v1' });
    });

    it('lanza VehicleNotAvailableError si isNewRangeAvailable=false', () => {
      const reservation = createConfirmed();
      expect(() =>
        reservation.reschedule({
          newRange: range(),
          newBaseAmount: amount(),
          isNewRangeAvailable: false,
        }),
      ).toThrow(VehicleNotAvailableError);
    });

    it('lanza ReservationInvalidStateTransitionError si esta CheckedOut', () => {
      const reservation = createCheckedOut();
      expect(() =>
        reservation.reschedule({
          newRange: range(),
          newBaseAmount: amount(),
          isNewRangeAvailable: true,
        }),
      ).toThrow(ReservationInvalidStateTransitionError);
    });
  });

  describe('requestExtension / approveExtension', () => {
    it('requestExtension bumpea version y emite ExtensionRequested.v1 sin cambiar el DateRange', () => {
      const reservation = createCheckedOut();
      const rangeBefore = reservation.dateRange;
      const versionBefore = reservation.version;

      reservation.requestExtension({ requestedNewEndDate: new Date('2026-09-10T10:00:00Z') });

      expect(reservation.dateRange).toBe(rangeBefore);
      expect(reservation.version).toBe(versionBefore + 1);
      expect(reservation.pullDomainEvents()[0]).toMatchObject({
        eventType: 'ExtensionRequested.v1',
      });
    });

    it('approveExtension reemplaza endDate, agrega PriceAdjustment Extension y emite ExtensionApproved.v1', () => {
      const reservation = createCheckedOut();
      reservation.approveExtension({
        newEndDate: new Date('2026-09-10T10:00:00Z'),
        adjustmentAmount: amount(4000),
        isNewRangeAvailable: true,
      });

      expect(reservation.dateRange.end.toISOString()).toBe('2026-09-10T10:00:00.000Z');
      expect(reservation.allPriceAdjustments[0].kind).toBe('Extension');
      expect(reservation.pullDomainEvents()[0]).toMatchObject({
        eventType: 'ExtensionApproved.v1',
      });
    });

    it('approveExtension lanza ExtensionCollidesError si isNewRangeAvailable=false (INV-106)', () => {
      const reservation = createCheckedOut();
      expect(() =>
        reservation.approveExtension({
          newEndDate: new Date('2026-09-10T10:00:00Z'),
          adjustmentAmount: amount(),
          isNewRangeAvailable: false,
        }),
      ).toThrow(ExtensionCollidesError);
    });
  });

  describe('swapVehicle', () => {
    it('reemplaza vehicleId y emite VehicleSwapped.v1', () => {
      const reservation = createCheckedOut();
      const previousVehicleId = reservation.vehicleId;

      reservation.swapVehicle({
        newVehicleId: 'vehicle-2',
        reason: 'averia',
        isNewVehicleAvailable: true,
      });

      expect(reservation.vehicleId).toBe('vehicle-2');
      expect(reservation.pullDomainEvents()[0]).toMatchObject({
        eventType: 'VehicleSwapped.v1',
        previousVehicleId,
        newVehicleId: 'vehicle-2',
      });
    });

    it('lanza VehicleNotAvailableError si isNewVehicleAvailable=false', () => {
      const reservation = createCheckedOut();
      expect(() =>
        reservation.swapVehicle({ newVehicleId: 'vehicle-2', isNewVehicleAvailable: false }),
      ).toThrow(VehicleNotAvailableError);
    });
  });

  describe('close', () => {
    it('CheckedIn -> Closed cuando hasInvoiceIssued=true', () => {
      const reservation = createCheckedOut();
      reservation.checkIn({
        odometer: Odometer.from(1200),
        fuelLevel: FuelLevel.from(80),
        photoFileIds: [],
        inspectedBy: 'user-1',
        isBranchActive: true,
        branchId: 'branch-1',
      });
      reservation.pullDomainEvents();

      reservation.close({ hasInvoiceIssued: true });

      expect(reservation.status).toBe('Closed');
      expect(reservation.pullDomainEvents()[0]).toMatchObject({
        eventType: 'ReservationClosed.v1',
      });
    });

    it('lanza InvoiceNotYetIssuedError si hasInvoiceIssued=false (INV-108/RN-22)', () => {
      const reservation = createCheckedOut();
      reservation.checkIn({
        odometer: Odometer.from(1200),
        fuelLevel: FuelLevel.from(80),
        photoFileIds: [],
        inspectedBy: 'user-1',
        isBranchActive: true,
        branchId: 'branch-1',
      });
      expect(() => reservation.close({ hasInvoiceIssued: false })).toThrow(
        InvoiceNotYetIssuedError,
      );
    });

    it('lanza ReservationInvalidStateTransitionError si no esta CheckedIn', () => {
      const reservation = createCheckedOut();
      expect(() => reservation.close({ hasInvoiceIssued: true })).toThrow(
        ReservationInvalidStateTransitionError,
      );
    });
  });

  describe('transiciones terminales (Cancelled/Closed)', () => {
    it('Cancelled no admite ningun comando (terminal)', () => {
      const reservation = createDraft();
      reservation.cancel({ cancelledBy: 'customer-1' });
      expect(() => reservation.cancel({ cancelledBy: 'customer-1' })).toThrow(
        ReservationInvalidStateTransitionError,
      );
    });
  });
});
