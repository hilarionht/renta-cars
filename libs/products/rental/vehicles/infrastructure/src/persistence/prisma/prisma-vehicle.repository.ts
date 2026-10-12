import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  MaintenanceRecord as PrismaMaintenanceRecord,
  Vehicle as PrismaVehicle,
  VehicleDocument as PrismaVehicleDocument,
} from '@prisma/client';

import { asPrismaTransaction, ReadTransaction } from '@platform/persistence-kernel';
import {
  ConcurrentModificationError,
  EntityId,
  type UnitOfWorkTransaction,
} from '@platform/shared-kernel';
import {
  DuplicateActiveVehicleDocumentError,
  DuplicateVehicleLicensePlateError,
  DuplicateVehicleVinError,
  LicensePlate,
  MaintenanceRecord,
  Vehicle,
  type VehicleId,
  VehicleDocument,
  VIN,
} from '@rental/vehicles/domain';
import type { VehicleRepository } from '@rental/vehicles/application';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

type VehicleWithChildren = PrismaVehicle & {
  vehicleDocuments: PrismaVehicleDocument[];
  maintenanceRecords: PrismaMaintenanceRecord[];
};

// Diseño de persistencia con dirty-tracking (docs/persistence/10-DECISIONES.md #36) - mismo
// patron que PrismaCustomerRepository. save() nunca reemplaza las colecciones completas,
// solo escribe lo que Vehicle marco como "sucio"
// (pullDirtyVehicleDocuments()/pullDirtyMaintenanceRecords()).
@Injectable()
export class PrismaVehicleRepository implements VehicleRepository {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async findById(id: VehicleId): Promise<Vehicle | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.vehicle.findFirst({
        where: { id: id.toString() },
        include: { vehicleDocuments: true, maintenanceRecords: true },
      }),
    );
    return record ? this.toDomain(record) : null;
  }

  async save(vehicle: Vehicle, tx: UnitOfWorkTransaction): Promise<void> {
    const prisma = asPrismaTransaction(tx);
    const rootData = {
      companyId: vehicle.companyId,
      branchId: vehicle.branchId,
      vehicleCategoryId: vehicle.vehicleCategoryId,
      licensePlate: vehicle.licensePlate.toString(),
      vin: vehicle.vin.toString(),
      status: vehicle.status,
    };

    if (vehicle.isNew) {
      try {
        await prisma.vehicle.create({
          data: { id: vehicle.id.toString(), ...rootData, version: vehicle.version },
        });
      } catch (error) {
        throw this.mapUniqueConstraintViolation(error, vehicle);
      }
      vehicle.markPersisted();
    } else {
      const result = await prisma.vehicle.updateMany({
        where: { id: vehicle.id.toString(), version: vehicle.version - 1 },
        data: { ...rootData, version: vehicle.version },
      });
      if (result.count === 0) {
        throw new ConcurrentModificationError('Vehicle', vehicle.id.toString());
      }
    }

    for (const document of vehicle.pullDirtyVehicleDocuments()) {
      try {
        await prisma.vehicleDocument.upsert({
          where: { id: document.id.toString() },
          create: {
            id: document.id.toString(),
            companyId: vehicle.companyId,
            vehicleId: vehicle.id.toString(),
            documentType: document.documentType,
            fileId: document.fileId,
            expiryDate: document.expiryDate,
            status: document.status,
          },
          // El resto es append-only (renovar crea una fila nueva) - solo `status` cambia
          // post-creacion (verify()).
          update: { status: document.status },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === UNIQUE_CONSTRAINT_VIOLATION
        ) {
          throw new DuplicateActiveVehicleDocumentError(document.documentType);
        }
        throw error;
      }
    }

    for (const record of vehicle.pullDirtyMaintenanceRecords()) {
      await prisma.maintenanceRecord.upsert({
        where: { id: record.id.toString() },
        create: {
          id: record.id.toString(),
          companyId: vehicle.companyId,
          vehicleId: vehicle.id.toString(),
          type: record.type,
          status: record.status,
          scheduledStart: record.scheduledStart,
          scheduledEnd: record.scheduledEnd,
          fitForService: record.fitForService ?? null,
          responsibleUserId: record.responsibleUserId ?? null,
        },
        // status/fitForService cambian post-creacion (start()/complete()) - la ventana
        // programada nunca se edita.
        update: { status: record.status, fitForService: record.fitForService ?? null },
      });
    }
  }

  private mapUniqueConstraintViolation(error: unknown, vehicle: Vehicle): Error {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_CONSTRAINT_VIOLATION
    ) {
      // `error.meta.target` no viene poblado como array de columnas en esta version de
      // Prisma (7.x, arquitectura de driver adapters) - llega "(not available)". El nombre
      // real del constraint solo esta en el mensaje crudo del driver subyacente
      // (error.meta.driverAdapterError.cause.originalMessage), mismo lugar que
      // isRateOverlapViolation ya usa para distinguir la exclusion constraint. Verificado
      // empiricamente contra un servidor real (no asumido de la documentacion de Prisma).
      const driverMessage = this.extractDriverErrorMessage(error);
      if (driverMessage.includes('vehicles_company_id_license_plate_key')) {
        return new DuplicateVehicleLicensePlateError(vehicle.licensePlate.toString());
      }
      if (driverMessage.includes('vehicles_company_id_vin_key')) {
        return new DuplicateVehicleVinError(vehicle.vin.toString());
      }
    }
    return error instanceof Error ? error : new Error(String(error));
  }

  private extractDriverErrorMessage(error: Prisma.PrismaClientKnownRequestError): string {
    const driverAdapterError = error.meta?.['driverAdapterError'];
    if (driverAdapterError && typeof driverAdapterError === 'object') {
      const cause = (driverAdapterError as { cause?: unknown }).cause;
      if (cause && typeof cause === 'object') {
        const originalMessage = (cause as { originalMessage?: unknown }).originalMessage;
        if (typeof originalMessage === 'string') {
          return originalMessage;
        }
      }
    }
    return error.message;
  }

  private toDomain(record: VehicleWithChildren): Vehicle {
    const vehicleDocuments = record.vehicleDocuments.map((document) =>
      this.documentToDomain(document),
    );
    const maintenanceRecords = record.maintenanceRecords.map((maintenance) =>
      this.maintenanceToDomain(maintenance),
    );

    return Vehicle.reconstitute(
      {
        id: EntityId.from<'Vehicle'>(record.id),
        companyId: record.companyId,
        branchId: record.branchId,
        vehicleCategoryId: record.vehicleCategoryId,
        licensePlate: LicensePlate.from(record.licensePlate),
        vin: VIN.from(record.vin),
        status: record.status,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        version: record.version,
      },
      vehicleDocuments,
      maintenanceRecords,
    );
  }

  private documentToDomain(record: PrismaVehicleDocument): VehicleDocument {
    return VehicleDocument.reconstitute({
      id: EntityId.from<'VehicleDocument'>(record.id),
      documentType: record.documentType,
      fileId: record.fileId,
      expiryDate: record.expiryDate,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  private maintenanceToDomain(record: PrismaMaintenanceRecord): MaintenanceRecord {
    return MaintenanceRecord.reconstitute({
      id: EntityId.from<'MaintenanceRecord'>(record.id),
      type: record.type,
      status: record.status,
      scheduledStart: record.scheduledStart,
      scheduledEnd: record.scheduledEnd,
      fitForService: record.fitForService ?? undefined,
      responsibleUserId: record.responsibleUserId ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
