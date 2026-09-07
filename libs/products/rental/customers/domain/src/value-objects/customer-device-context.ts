// Espejo de libs/platform/identity/domain/src/value-objects/device-context.ts - duplicado a
// proposito, ver customer-session-status.ts. Metadata no sensible (user-agent, IP
// aproximada), fines de auditoria, nunca de negocio.
export class CustomerDeviceContext {
  private constructor(
    private readonly userAgent: string | undefined,
    private readonly ipAddress: string | undefined,
  ) {}

  static from(params: { userAgent?: string; ipAddress?: string }): CustomerDeviceContext {
    return new CustomerDeviceContext(params.userAgent, params.ipAddress);
  }

  toUserAgent(): string | undefined {
    return this.userAgent;
  }

  toIpAddress(): string | undefined {
    return this.ipAddress;
  }
}
