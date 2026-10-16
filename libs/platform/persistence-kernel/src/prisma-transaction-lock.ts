import { Injectable } from '@nestjs/common';

import {
  ConcurrentModificationError,
  type TransactionLock,
  type TransactionLockMode,
  type UnitOfWorkTransaction,
} from '@platform/shared-kernel';

import { asPrismaTransaction } from './prisma-unit-of-work';

// docs/persistence/10-DECISIONES.md #141: advisory lock de Postgres atado a la transaccion.
// hashtextextended (64 bits): una colision entre claves solo agregaria espera, nunca rompe la
// correccion. lock_timeout corto para que quien espera no agote el timeout de $transaction (5 s):
// si no lo obtiene a tiempo, 409 y el cliente reintenta.
const LOCK_TIMEOUT = '2s';
const LOCK_NOT_AVAILABLE = '55P03';
const DEADLOCK_DETECTED = '40P01';

function postgresCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  const meta = (error as { meta?: Record<string, unknown> }).meta;
  const driverAdapterError = meta?.['driverAdapterError'] as
    { cause?: { originalCode?: unknown; code?: unknown } } | undefined;
  const code =
    driverAdapterError?.cause?.originalCode ??
    driverAdapterError?.cause?.code ??
    (meta as { code?: unknown } | undefined)?.code;
  return typeof code === 'string' ? code : undefined;
}

function isLockConflict(error: unknown): boolean {
  const code = postgresCode(error);
  if (code === LOCK_NOT_AVAILABLE || code === DEADLOCK_DETECTED) {
    return true;
  }
  const message = error instanceof Error ? error.message : '';
  return /lock timeout|deadlock detected/i.test(message);
}

@Injectable()
export class PrismaTransactionLock implements TransactionLock {
  async acquire(tx: UnitOfWorkTransaction, key: string, mode: TransactionLockMode): Promise<void> {
    const prisma = asPrismaTransaction(tx);
    try {
      // set_config(..., true) = SET LOCAL, parametrizado (sin raw unsafe).
      await prisma.$executeRaw`SELECT set_config('lock_timeout', ${LOCK_TIMEOUT}, true)`;
      if (mode === 'shared') {
        await prisma.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock_shared(hashtextextended(${key}, 0))`;
      } else {
        await prisma.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
      }
    } catch (error) {
      if (isLockConflict(error)) {
        throw new ConcurrentModificationError('Lock', key);
      }
      throw error;
    }
  }
}
