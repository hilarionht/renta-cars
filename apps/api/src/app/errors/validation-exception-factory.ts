import { BadRequestException, type ValidationError } from '@nestjs/common';

// docs/contracts/03-REQUEST-RESPONSE-STANDARDS.md SS3.1: `errors[]` con
// { field (dot-notation), code, message } para validacion de multiples campos.
interface FieldError {
  field: string;
  code: string;
  message: string;
}

function toScreamingSnakeCase(constraintName: string): string {
  return constraintName.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}

function flatten(errors: ValidationError[], parentPath = ''): FieldError[] {
  return errors.flatMap((error) => {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;
    const ownErrors = Object.entries(error.constraints ?? {}).map(([constraintName, message]) => ({
      field: path,
      code: toScreamingSnakeCase(constraintName),
      message,
    }));
    const childErrors =
      error.children && error.children.length > 0 ? flatten(error.children, path) : [];
    return [...ownErrors, ...childErrors];
  });
}

// Conectado a ValidationPipe.exceptionFactory (apps/api/src/main.ts) - produce el `errors[]`
// estructurado que AllExceptionsFilter reenvia tal cual en el envelope de error.
export function validationExceptionFactory(
  validationErrors: ValidationError[],
): BadRequestException {
  return new BadRequestException({
    message: 'Validation failed',
    code: 'VALIDATION_FAILED',
    errors: flatten(validationErrors),
  });
}
