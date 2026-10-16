// docs/persistence/10-DECISIONES.md #141 (decision del usuario): los eventos de dominio se emiten
// in-process DESPUES del commit. Antes OutboxWriter emitia al escribir la fila de outbox, dentro
// de la transaccion: si despues se revertia, los listeners (auditoria, notificaciones) ya habian
// visto un evento de algo que no paso, y corrian tomando una segunda conexion del pool mientras la
// transaccion seguia abierta (y con locks). La fila de outbox_event no cambia: se escribe en la
// misma transaccion que el agregado.
//
// El buffer se asocia al objeto `tx` (WeakMap): PrismaUnitOfWork lo abre al empezar y lo vacia al
// confirmar. Una transaccion que no viene del UnitOfWork no tiene buffer y emite enseguida, como
// antes.
type PendingEmit = () => void;

const buffers = new WeakMap<object, PendingEmit[]>();

export function openAfterCommitBuffer(tx: object): void {
  buffers.set(tx, []);
}

// true si quedo encolado (hay buffer para ese tx); false si el caller tiene que emitir ya.
export function deferUntilCommit(tx: object, emit: PendingEmit): boolean {
  const buffer = buffers.get(tx);
  if (!buffer) {
    return false;
  }
  buffer.push(emit);
  return true;
}

// Solo despues de que $transaction resolvio. Un listener que falla nunca debe afectar al caller
// (el negocio ya confirmo): se aisla cada emit.
export function flushAfterCommit(tx: object): void {
  const buffer = buffers.get(tx) ?? [];
  buffers.delete(tx);
  for (const emit of buffer) {
    try {
      emit();
    } catch {
      // EventEmitter2.emit() con listeners async no lanza; uno sincrono que falle no se propaga.
    }
  }
}

export function discardAfterCommit(tx: object): void {
  buffers.delete(tx);
}
