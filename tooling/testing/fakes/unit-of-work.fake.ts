// docs/engineering/04-TESTING-FOUNDATION.md SS4: ejecuta el callback sin transaccion real -
// para tests de aplicacion que no necesitan Postgres, solo que el Command Handler use
// UnitOfWork.run() correctamente. El puerto real
// (docs/technical/04-PERSISTENCE.md SS3: "publicado por una libreria de infraestructura
// comun, no por ningun modulo de negocio especifico") se define junto con el primer modulo
// que lo necesite (Fase 0); este fake ya tiene la misma forma (`run(work)`) para ser
// intercambiable ese dia.
export class FakeUnitOfWork {
  async run<T>(work: (tx: unknown) => Promise<T>): Promise<T> {
    return work(undefined);
  }
}
