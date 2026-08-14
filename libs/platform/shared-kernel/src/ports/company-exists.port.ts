// Puerto que valida "el companyId referenciado existe" (docs/04-MODELO-DATOS.md SS3: "la
// integridad se garantiza a nivel de aplicacion... via el puerto correspondiente", ya que
// nunca hay FK fisica entre schemas). El contrato vive en shared-kernel porque cualquier
// modulo (hoy: users) necesita referenciarlo desde application/; el adaptador real (o el
// no-op mientras Companies, Fase 0 item 3, no exista) es composicion de apps/api, no un
// contrato de dominio.
export const COMPANY_EXISTS_PORT = Symbol('CompanyExistsPort');

export interface CompanyExistsPort {
  exists(companyId: string): Promise<boolean>;
}
