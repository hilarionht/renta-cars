import { SetMetadata } from '@nestjs/common';

// docs/technical/07-SECURITY.md SS1: JwtAuthGuard aplica por defecto a todo endpoint,
// "ausente solo en endpoints explicitamente publicos (@Public())".
export const IS_PUBLIC_KEY = 'isPublic';
// PascalCase intencional: convencion de Nest para decoradores custom (@Public, @Roles).
// eslint-disable-next-line @typescript-eslint/naming-convention
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
