import { ConcurrentModificationError, type DomainErrorEntries } from '@platform/shared-kernel';
import {
  InvoiceAlreadyIssuedError,
  InvoiceInvalidStateTransitionError,
  InvoiceNotFoundError,
} from '@rental/invoices/domain';

// docs/contracts/07-ERROR-CATALOG.md - mapeo code/status ya reservado, activado en esta
// tanda (primer consumidor real de Invoices). INVOICE_NOT_YET_ISSUED NO se registra aca -
// ya esta activada desde Fase 1 en RESERVATIONS_DOMAIN_ERROR_ENTRIES
// (InvoiceNotYetIssuedError, reservations-domain-error.registry.ts) y app.module.ts
// concatena todos los *_DOMAIN_ERROR_ENTRIES en un unico array global - repetirla exigiria
// ademas importar esa clase desde @rental/reservations/domain, lo que viola
// tooling/eslint/boundaries.mjs (module:invoices no puede depender de type:domain de otro
// modulo).
export const INVOICES_DOMAIN_ERROR_ENTRIES: DomainErrorEntries = [
  [
    InvoiceAlreadyIssuedError,
    { status: 409, code: 'INVOICE_ALREADY_ISSUED', title: 'Ya existe una invoice activa' },
  ],
  [
    InvoiceInvalidStateTransitionError,
    { status: 409, code: 'INVALID_STATE_TRANSITION', title: 'Transicion de estado invalida' },
  ],
  [
    InvoiceNotFoundError,
    { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'Invoice no encontrada' },
  ],
  [
    ConcurrentModificationError,
    { status: 409, code: 'CONCURRENT_MODIFICATION', title: 'Modificacion concurrente' },
  ],
];
