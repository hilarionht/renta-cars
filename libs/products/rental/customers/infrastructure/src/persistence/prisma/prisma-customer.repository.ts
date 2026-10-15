import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AdditionalDriver as PrismaAdditionalDriver,
  Customer as PrismaCustomer,
  IdentityDocument as PrismaIdentityDocument,
} from '@prisma/client';

import {
  ConcurrentModificationError,
  EntityId,
  type UnitOfWorkTransaction,
} from '@platform/shared-kernel';
import { asPrismaTransaction, ReadTransaction } from '@platform/persistence-kernel';
import {
  AdditionalDriver,
  Customer,
  type CustomerId,
  ContactInfo,
  CustomerName,
  DuplicateActiveIdentityDocumentError,
  DuplicateCustomerDocumentIdError,
  DuplicateCustomerPhoneError,
  IdentityDocument,
  type IdentityDocumentOwner,
  TaxIdOrDocumentId,
} from '@rental/customers/domain';
import type { CustomerRepository } from '@rental/customers/application';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';
// #139: unicidades de la raiz, distinguidas por nombre de indice (Prisma 7 no puebla
// meta.target; mismo criterio que prisma-vehicle.repository.ts).
const DOCUMENT_ID_UNIQUE = 'customers_company_id_tax_id_or_document_id_key';
const PHONE_UNIQUE = 'customers_company_id_contact_phone_key';
// #139: un Pending y un Verified por dueno y tipo (indices parciales de
// 20261015130100_rental_document_renewal_indexes).
const DOCUMENT_SLOT_UNIQUES = [
  'identity_documents_owner_document_type_pending_key',
  'identity_documents_owner_document_type_verified_key',
];
// #139: orden estable del historial de renovaciones (el dominio elige el vigente por estado,
// pero la respuesta y los specs no deben depender del orden fisico de las filas).
const DOCUMENT_ORDER: Prisma.IdentityDocumentOrderByWithRelationInput[] = [
  { createdAt: 'asc' },
  { id: 'asc' },
];

type CustomerWithChildren = PrismaCustomer & {
  identityDocuments: PrismaIdentityDocument[];
  additionalDrivers: (PrismaAdditionalDriver & { identityDocuments: PrismaIdentityDocument[] })[];
};

// Diseño de persistencia con dirty-tracking (docs/persistence/10-DECISIONES.md) - primer
// aggregate de la sesion con entidades internas en tablas propias. save() nunca reemplaza
// la coleccion completa (update:{set:[...]} de Prisma borra-y-recrea, incorrecto para
// identity_documents append-only) - solo escribe lo que Customer marco como "sucio"
// (pullDirtyIdentityDocuments()/pullDirtyAdditionalDrivers(), mismo idioma que
// pullDomainEvents()).
@Injectable()
export class PrismaCustomerRepository implements CustomerRepository {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async findById(id: CustomerId, companyId?: string): Promise<Customer | null> {
    const record = await this.readTransaction.run(
      (tx) =>
        tx.customer.findFirst({
          where: { id: id.toString() },
          include: {
            identityDocuments: { orderBy: DOCUMENT_ORDER },
            additionalDrivers: { include: { identityDocuments: { orderBy: DOCUMENT_ORDER } } },
          },
        }),
      companyId,
    );
    return record ? this.toDomain(record) : null;
  }

  // Match exacto por string (contactPhone es TEXT plano) - coherente con PhoneNumber.equals()
  // del dominio, ver el comentario del puerto.
  async findByCompanyIdAndPhone(companyId: string, phone: string): Promise<Customer | null> {
    const record = await this.readTransaction.run(
      (tx) =>
        tx.customer.findFirst({
          where: { contactPhone: phone },
          include: {
            identityDocuments: { orderBy: DOCUMENT_ORDER },
            additionalDrivers: { include: { identityDocuments: { orderBy: DOCUMENT_ORDER } } },
          },
        }),
      companyId,
    );
    return record ? this.toDomain(record) : null;
  }

  async save(customer: Customer, tx: UnitOfWorkTransaction): Promise<void> {
    const prisma = asPrismaTransaction(tx);
    const rootData = {
      companyId: customer.companyId,
      name: customer.name.toString(),
      taxIdOrDocumentId: customer.taxIdOrDocumentId.toString(),
      contactEmail: customer.contactInfo.toEmail().toString(),
      contactPhone: customer.contactInfo.toPhone().toString(),
      customerType: customer.customerType,
      status: customer.status,
      blockStatus: customer.blockStatus,
      blockReason: customer.blockReason ?? null,
      pushDeviceToken: customer.pushDeviceToken ?? null,
    };

    // #139: create Y updateMany (el telefono se edita por PATCH) pueden violar las unicidades.
    try {
      if (customer.isNew) {
        await prisma.customer.create({
          data: { id: customer.id.toString(), ...rootData, version: customer.version },
        });
        customer.markPersisted();
      } else {
        const result = await prisma.customer.updateMany({
          where: { id: customer.id.toString(), version: customer.version - 1 },
          data: { ...rootData, version: customer.version },
        });
        if (result.count === 0) {
          throw new ConcurrentModificationError('Customer', customer.id.toString());
        }
      }
    } catch (error) {
      throw this.mapRootUniqueViolation(error, rootData);
    }

    // #139: los que pasan a Replaced se escriben primero, para liberar su lugar en los indices
    // parciales antes de que el documento nuevo lo ocupe.
    const dirtyDocuments = [...customer.pullDirtyIdentityDocuments()].sort(
      (a, b) => Number(b.status === 'Replaced') - Number(a.status === 'Replaced'),
    );
    for (const document of dirtyDocuments) {
      try {
        await prisma.identityDocument.upsert({
          where: { id: document.id.toString() },
          create: {
            id: document.id.toString(),
            companyId: customer.companyId,
            customerId: document.owner.type === 'Customer' ? document.owner.id : null,
            additionalDriverId:
              document.owner.type === 'AdditionalDriver' ? document.owner.id : null,
            documentType: document.documentType,
            fileId: document.fileId,
            expiryDate: document.expiryDate,
            status: document.status,
            extractedByOcr: document.extractedByOcr,
          },
          // El resto es append-only (renovar crea una fila nueva) - solo `status` cambia
          // post-creacion (verify()).
          update: { status: document.status },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === UNIQUE_CONSTRAINT_VIOLATION &&
          DOCUMENT_SLOT_UNIQUES.some((index) =>
            this.extractDriverErrorMessage(error).includes(index),
          )
        ) {
          // Solo en una carrera (dos verificaciones o cargas simultaneas del mismo lugar).
          throw new DuplicateActiveIdentityDocumentError(document.documentType);
        }
        throw error;
      }
    }

    for (const driver of customer.pullDirtyAdditionalDrivers()) {
      if (driver.isNew) {
        await prisma.additionalDriver.create({
          data: {
            id: driver.id.toString(),
            companyId: customer.companyId,
            customerId: customer.id.toString(),
            name: driver.name,
            status: driver.status,
            version: driver.version,
          },
        });
        driver.markPersisted();
      } else {
        const result = await prisma.additionalDriver.updateMany({
          where: { id: driver.id.toString(), version: driver.version - 1 },
          data: { status: driver.status, version: driver.version },
        });
        if (result.count === 0) {
          throw new ConcurrentModificationError('AdditionalDriver', driver.id.toString());
        }
      }
    }
  }

  private toDomain(record: CustomerWithChildren): Customer {
    const identityDocuments = record.identityDocuments.map((document) =>
      this.documentToDomain(document),
    );
    const additionalDrivers = record.additionalDrivers.map((driver) => {
      identityDocuments.push(
        ...driver.identityDocuments.map((document) => this.documentToDomain(document)),
      );
      return AdditionalDriver.reconstitute({
        id: EntityId.from<'AdditionalDriver'>(driver.id),
        customerId: driver.customerId,
        name: driver.name,
        status: driver.status,
        createdAt: driver.createdAt,
        updatedAt: driver.updatedAt,
        version: driver.version,
      });
    });

    return Customer.reconstitute(
      {
        id: EntityId.from<'Customer'>(record.id),
        companyId: record.companyId,
        name: CustomerName.from(record.name),
        taxIdOrDocumentId: TaxIdOrDocumentId.from(record.taxIdOrDocumentId),
        contactInfo: ContactInfo.from({ email: record.contactEmail, phone: record.contactPhone }),
        customerType: record.customerType,
        status: record.status,
        blockStatus: record.blockStatus,
        blockReason: record.blockReason ?? undefined,
        pushDeviceToken: record.pushDeviceToken ?? undefined,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        version: record.version,
      },
      identityDocuments,
      additionalDrivers,
    );
  }

  private documentToDomain(record: PrismaIdentityDocument): IdentityDocument {
    const owner: IdentityDocumentOwner = record.customerId
      ? { type: 'Customer', id: record.customerId }
      : { type: 'AdditionalDriver', id: record.additionalDriverId as string };

    return IdentityDocument.reconstitute({
      id: EntityId.from<'IdentityDocument'>(record.id),
      owner,
      documentType: record.documentType,
      fileId: record.fileId,
      expiryDate: record.expiryDate,
      status: record.status,
      extractedByOcr: record.extractedByOcr,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  private mapRootUniqueViolation(
    error: unknown,
    rootData: { taxIdOrDocumentId: string; contactPhone: string },
  ): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_CONSTRAINT_VIOLATION
    ) {
      const message = this.extractDriverErrorMessage(error);
      if (message.includes(DOCUMENT_ID_UNIQUE)) {
        return new DuplicateCustomerDocumentIdError(rootData.taxIdOrDocumentId);
      }
      if (message.includes(PHONE_UNIQUE)) {
        return new DuplicateCustomerPhoneError(rootData.contactPhone);
      }
    }
    return error;
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
}
