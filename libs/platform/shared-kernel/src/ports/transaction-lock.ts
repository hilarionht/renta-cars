import type { UnitOfWorkTransaction } from './unit-of-work';

// docs/persistence/10-DECISIONES.md #141: lock de aplicacion atado a la transaccion (se libera
// solo al confirmar o revertir). Cierra las carreras chequeo/accion entre modulos: quien agrega
// reservas toma el lock compartido; quien chequea "no hay reservas" antes de bloquear (mantenimiento,
// cierre de sucursal) toma el exclusivo. Vive en shared-kernel para que platform y los productos lo
// usen sin depender entre si (INV-P03). Orden fijo para no generar deadlocks: sucursal antes que
// vehiculo. Si no se obtiene a tiempo responde ConcurrentModificationError (409).
export type TransactionLockMode = 'shared' | 'exclusive';

export interface TransactionLock {
  acquire(tx: UnitOfWorkTransaction, key: string, mode: TransactionLockMode): Promise<void>;
}

export const TRANSACTION_LOCK = Symbol('TransactionLock');
