import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { Payment, PaymentId } from '@platform/payments/domain';

export const PAYMENT_REPOSITORY = Symbol('PaymentRepository');

export interface PaymentRepository {
  findById(id: PaymentId): Promise<Payment | null>;
  // Usado por HandleGatewayWebhookHandler para resolver el Payment a partir de la referencia
  // que el proveedor devuelve en la notificacion (docs/contracts/06-WEBHOOKS.md). companyId
  // explicito (no via RequestContext): la ruta de webhook es @Public(), sin tenant
  // autenticado - mismo mecanismo que UnitOfWork.run()/ReadTransaction.run() ya usan para
  // Login/RefreshSession.
  findByGatewayReference(gatewayReference: string, companyId: string): Promise<Payment | null>;
  save(payment: Payment, tx: UnitOfWorkTransaction): Promise<void>;
}
