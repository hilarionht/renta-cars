// Metadata no sensible de la sesion (user-agent, IP aproximada) - fines de auditoria, nunca
// de negocio (docs/model/03-ENTITIES.md SS1.3).
export class DeviceContext {
  private constructor(
    private readonly userAgent: string | undefined,
    private readonly ipAddress: string | undefined,
  ) {}

  static from(params: { userAgent?: string; ipAddress?: string }): DeviceContext {
    return new DeviceContext(params.userAgent, params.ipAddress);
  }

  toUserAgent(): string | undefined {
    return this.userAgent;
  }

  toIpAddress(): string | undefined {
    return this.ipAddress;
  }
}
