// Puerto que valida "el companyId referenciado existe" (docs/04-MODELO-DATOS.md SS3: "la
// integridad se garantiza a nivel de aplicacion... via el puerto correspondiente", ya que
// nunca hay FK fisica entre schemas). Vive en apps/api (no en shared-kernel) porque su
// implementacion real dependera de Companies (Fase 0 item 3, todavia no construido) - el
// puerto en si es infra de composicion de la app, no del dominio de ningun modulo.
export const COMPANY_EXISTS_PORT = Symbol('CompanyExistsPort');

export interface CompanyExistsPort {
  exists(companyId: string): Promise<boolean>;
}
