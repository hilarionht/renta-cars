import { HttpException } from '@nestjs/common';

// Excepcion tecnica (no de dominio) con `code` propio - docs/contracts/07-ERROR-CATALOG.md
// SS4. AllExceptionsFilter lee `code` desde el cuerpo de la excepcion (getResponse()), por
// eso el body se pasa como objeto y no como string plano.
export class ApiException extends HttpException {
  constructor(status: number, code: string, message: string) {
    super({ message, code }, status);
  }
}
