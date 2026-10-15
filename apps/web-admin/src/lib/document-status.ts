import type { BadgeToneName } from './reservation-status';

// Estado de un documento (de cliente o de vehiculo) en la web, docs/persistence/
// 10-DECISIONES.md #139. La validez se calcula por fecha: ningun proceso pasa los documentos a
// Expired (fuera de alcance de #139), igual que isCurrentlyValid() en el dominio, que vence
// cuando expiryDate <= ahora. Replaced es historial: lo reemplazo una renovacion.
export interface DocumentLike {
  expiryDate: string;
  status: string;
}

export function isDocumentExpired(document: Pick<DocumentLike, 'expiryDate'>, now = new Date()) {
  return new Date(document.expiryDate).getTime() <= now.getTime();
}

export function displayDocumentStatus(
  document: DocumentLike,
  now = new Date(),
): { label: string; tone: BadgeToneName } {
  if (document.status === 'Replaced') {
    return { label: 'Reemplazado', tone: 'neutral' };
  }
  if (document.status === 'Expired' || isDocumentExpired(document, now)) {
    return { label: 'Vencido', tone: 'danger' };
  }
  return document.status === 'Verified'
    ? { label: 'Verificado', tone: 'success' }
    : { label: 'Pendiente', tone: 'warning' };
}

// El API rechaza verificar uno vencido (…_DOCUMENT_EXPIRED) o reemplazado (…_DOCUMENT_REPLACED).
export function canVerifyDocument(document: DocumentLike, now = new Date()): boolean {
  return document.status === 'Pending' && !isDocumentExpired(document, now);
}

// Texto comun de los dialogos de carga: renovar no invalida el vigente hasta verificar.
export const RENEWAL_HINT =
  'Si ya hay uno del mismo tipo, el nuevo lo reemplaza recién cuando se verifica. Hasta entonces sigue valiendo el anterior.';
