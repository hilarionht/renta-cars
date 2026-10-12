// Puerto de Unit of Work - docs/technical/04-PERSISTENCE.md SS3. El tipo de transaccion es
// deliberadamente opaco (marker interface vacio): application/ invoca `unitOfWork.run(...)`
// sin conocer Prisma; solo el repositorio (infrastructure/) sabe que ese `tx` es en realidad
// un `Prisma.TransactionClient` y hace el cast puntual ahi, nunca en application/.
export interface UnitOfWorkTransaction {
  readonly __brand?: 'UnitOfWorkTransaction';
}

export interface UnitOfWork {
  // companyId es opcional: la mayoria de los casos lo toman de RequestContext (poblado por
  // TenantContextGuard a partir del JWT ya validado). Los comandos de platform-identity
  // (Login/RefreshSession/RevokeSession) corren en rutas @Public() - ahi nunca corrio
  // TenantContextGuard porque todavia no hay JWT que validar - pero el propio comando ya
  // conoce el companyId (del body de login, o de la Session/User encontrada por hash de
  // refresh token) y lo pasa explicito para que el adapter lo use en vez de RequestContext.
  run<T>(work: (tx: UnitOfWorkTransaction) => Promise<T>, companyId?: string): Promise<T>;
}

export const UNIT_OF_WORK = Symbol('UnitOfWork');
