// Base comun de toda excepcion de dominio - docs/05-CONVENCIONES-BACKEND.md SS6: "el
// dominio lanza excepciones de dominio tipadas (ReservationOverlapError extends
// DomainError), sin conocer HTTP". Convencion de nombre: <Motivo>Error
// (docs/technical/09-CODING-STANDARDS.md SS3).
//
// Vive en shared-kernel porque es la unica libreria que cualquier `type:domain` de
// cualquier modulo puede importar sin violar el aislamiento entre modulos
// (docs/technical/01-MONOREPO.md SS5: type:domain solo depende de type:domain del mismo
// modulo o de scope:shared) - no hay otro lugar estructuralmente valido para una base que
// todo dominio de negocio debe extender.
export abstract class DomainError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
