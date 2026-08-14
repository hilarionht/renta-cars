// Puerto de Unit of Work - docs/technical/04-PERSISTENCE.md SS3. El tipo de transaccion es
// deliberadamente opaco (marker interface vacio): application/ invoca `unitOfWork.run(...)`
// sin conocer Prisma; solo el repositorio (infrastructure/) sabe que ese `tx` es en realidad
// un `Prisma.TransactionClient` y hace el cast puntual ahi, nunca en application/.
export interface UnitOfWorkTransaction {
  readonly __brand?: 'UnitOfWorkTransaction';
}

export interface UnitOfWork {
  run<T>(work: (tx: UnitOfWorkTransaction) => Promise<T>): Promise<T>;
}

export const UNIT_OF_WORK = Symbol('UnitOfWork');
