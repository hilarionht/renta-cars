import { BadRequestException } from '@nestjs/common';

// Paginacion por cursor (docs/08-API-CONTRACTS.md SS5, docs/persistence/10-DECISIONES.md
// #112) - cursor opaco, nunca un numero de pagina ni un offset legible. Codifica el id del
// ultimo elemento devuelto (UUID v7, ordenable cronologicamente por construccion - ver
// EntityId en shared-kernel). BadRequestException (no ApiException de apps/api - libs/ no
// puede importar apps/api, tooling/eslint/boundaries.mjs) - AllExceptionsFilter ya mapea
// cualquier HttpException 400 a VALIDATION_FAILED automaticamente, sin codigo de catalogo
// nuevo. Primer precedente del repo de una excepcion Nest cruda lanzada desde libs/.
export function encodeCursor(id: string): string {
  return Buffer.from(JSON.stringify({ id }), 'utf-8').toString('base64url');
}

export function decodeCursor(cursor: string): string {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      typeof (decoded as { id?: unknown }).id !== 'string'
    ) {
      throw new Error('invalid cursor shape');
    }
    return (decoded as { id: string }).id;
  } catch {
    throw new BadRequestException('Cursor de paginacion invalido.');
  }
}
