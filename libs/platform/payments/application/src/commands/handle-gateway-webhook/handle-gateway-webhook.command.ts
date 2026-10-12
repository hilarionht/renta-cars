// El adaptador de integration-providers ya tradujo el payload crudo del proveedor a este
// comando (verificando firma y deduplicando por el event id del proveedor ANTES de invocar el
// handler) - docs/contracts/06-WEBHOOKS.md. El command handler nunca ve el payload original.
export interface HandleGatewayWebhookCommand {
  // Extraido de la metadata que AuthorizePaymentHandler adjunto en la pasarela
  // (PaymentGatewayPort.authorize()) - unica forma de resolver el tenant sin RequestContext
  // en una ruta @Public() (RLS fail-closed, docs/persistence/06-RLS.md SS6).
  companyId: string;
  gatewayReference: string;
  result: 'captured' | 'failed' | 'refunded';
  reason?: string;
}
