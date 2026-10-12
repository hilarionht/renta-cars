import { ConcurrentModificationError, type DomainErrorEntries } from '@platform/shared-kernel';
import {
  DepositRetentionExceedsHeldError,
  InvalidPaymentMethodError,
  PaymentAlreadyProcessedError,
  PaymentInvalidStateTransitionError,
  PaymentNotFoundError,
  SecurityDepositAlreadyResolvedError,
  SecurityDepositNotFoundError,
} from '@platform/payments/domain';
import {
  PaymentGatewayDeclinedError,
  PaymentGatewayUnavailableError,
} from '@platform/payments/application';

// docs/contracts/07-ERROR-CATALOG.md - mapeo code/status ya reservado, activado en esta
// tanda (primer consumidor real de Payments).
export const PAYMENTS_DOMAIN_ERROR_ENTRIES: DomainErrorEntries = [
  [
    PaymentAlreadyProcessedError,
    { status: 409, code: 'PAYMENT_ALREADY_PROCESSED', title: 'Idempotency key ya procesada' },
  ],
  [
    SecurityDepositAlreadyResolvedError,
    {
      status: 409,
      code: 'DEPOSIT_ALREADY_RESOLVED',
      title: 'El security deposit ya esta resuelto',
    },
  ],
  [
    DepositRetentionExceedsHeldError,
    {
      status: 422,
      code: 'DEPOSIT_RETENTION_EXCEEDS_HELD',
      title: 'El monto a retener excede el monto originalmente retenido',
    },
  ],
  [
    PaymentGatewayUnavailableError,
    {
      status: 503,
      code: 'PAYMENT_GATEWAY_UNAVAILABLE',
      title: 'La pasarela de pago no esta disponible',
    },
  ],
  [
    PaymentGatewayDeclinedError,
    { status: 402, code: 'PAYMENT_DECLINED', title: 'La pasarela rechazo el cobro' },
  ],
  [
    PaymentInvalidStateTransitionError,
    { status: 409, code: 'INVALID_STATE_TRANSITION', title: 'Transicion de estado invalida' },
  ],
  [
    InvalidPaymentMethodError,
    { status: 422, code: 'INVALID_PAYMENT_METHOD', title: 'Metodo de pago invalido' },
  ],
  [
    PaymentNotFoundError,
    { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'Payment no encontrado' },
  ],
  [
    SecurityDepositNotFoundError,
    { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'Security deposit no encontrado' },
  ],
  [
    ConcurrentModificationError,
    { status: 409, code: 'CONCURRENT_MODIFICATION', title: 'Modificacion concurrente' },
  ],
];
