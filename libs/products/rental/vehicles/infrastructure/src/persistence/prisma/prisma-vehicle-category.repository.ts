import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Rate as PrismaRate, VehicleCategory as PrismaVehicleCategory } from '@prisma/client';

import { asPrismaTransaction, ReadTransaction } from '@platform/persistence-kernel';
import {
  ConcurrentModificationError,
  EntityId,
  Money,
  type UnitOfWorkTransaction,
} from '@platform/shared-kernel';
import {
  CategoryName,
  Rate,
  RateOverlapError,
  VehicleCategory,
  type VehicleCategoryId,
} from '@rental/vehicles/domain';
import type { VehicleCategoryRepository } from '@rental/vehicles/application';

// Nombre de la exclusion constraint GiST (docs/persistence/07-MIGRACIONES.md SS3, migracion
// 20260818130709_rental_vehicles) - Postgres no tiene un codigo de error Prisma dedicado
// para EXCLUDE violations (a diferencia de P2002 para UNIQUE), asi que se distingue por el
// nombre de constraint en el mensaje crudo. Verificado empiricamente contra Postgres real
// en rate-overlap-exclusion.integration.spec.ts.
const RATE_OVERLAP_CONSTRAINT = 'rates_no_overlapping_validity';

type VehicleCategoryWithRates = PrismaVehicleCategory & { rates: PrismaRate[] };

@Injectable()
export class PrismaVehicleCategoryRepository implements VehicleCategoryRepository {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async findById(id: VehicleCategoryId): Promise<VehicleCategory | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.vehicleCategory.findFirst({
        where: { id: id.toString() },
        include: { rates: true },
      }),
    );
    return record ? this.toDomain(record) : null;
  }

  async save(category: VehicleCategory, tx: UnitOfWorkTransaction): Promise<void> {
    const prisma = asPrismaTransaction(tx);
    const rootData = {
      companyId: category.companyId,
      name: category.name.toString(),
      description: category.description ?? null,
    };

    if (category.isNew) {
      await prisma.vehicleCategory.create({
        data: { id: category.id.toString(), ...rootData, version: category.version },
      });
      category.markPersisted();
    } else {
      const result = await prisma.vehicleCategory.updateMany({
        where: { id: category.id.toString(), version: category.version - 1 },
        data: { ...rootData, version: category.version },
      });
      if (result.count === 0) {
        throw new ConcurrentModificationError('VehicleCategory', category.id.toString());
      }
    }

    for (const rate of category.pullDirtyRates()) {
      try {
        await prisma.rate.create({
          data: {
            id: rate.id.toString(),
            companyId: category.companyId,
            vehicleCategoryId: category.id.toString(),
            amountMinorUnits: rate.amount.minorUnits,
            currency: rate.amount.currencyCode,
            unit: rate.unit,
            validFrom: rate.validFrom,
            validTo: rate.validTo,
          },
        });
      } catch (error) {
        if (this.isRateOverlapViolation(error)) {
          throw new RateOverlapError(category.id.toString());
        }
        throw error;
      }
    }
  }

  private isRateOverlapViolation(error: unknown): boolean {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      return error.message.includes(RATE_OVERLAP_CONSTRAINT);
    }
    return false;
  }

  private toDomain(record: VehicleCategoryWithRates): VehicleCategory {
    const rates = record.rates.map((rate) => this.rateToDomain(rate));

    return VehicleCategory.reconstitute(
      {
        id: EntityId.from<'VehicleCategory'>(record.id),
        companyId: record.companyId,
        name: CategoryName.from(record.name),
        description: record.description ?? undefined,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        version: record.version,
      },
      rates,
    );
  }

  private rateToDomain(record: PrismaRate): Rate {
    return Rate.reconstitute({
      id: EntityId.from<'Rate'>(record.id),
      amount: Money.from(record.amountMinorUnits, record.currency),
      unit: record.unit,
      validFrom: record.validFrom,
      validTo: record.validTo,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
