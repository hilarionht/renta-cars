import { SetMetadata } from '@nestjs/common';

// docs/technical/07-SECURITY.md SS1: JwtAuthGuard aplica por defecto a todo endpoint,
// "ausente solo en endpoints explicitamente publicos (@Public())". Vive aca (no en
// apps/api/src/app/auth, donde vive JwtAuthGuard que LEE esta metadata) porque los
// controllers que lo aplican (AuthController de platform-identity-infrastructure: login/
// refresh/logout) son libs/ - libs/ no puede importar apps/api (tooling/eslint/
// boundaries.mjs). JwtAuthGuard sigue en apps/api (atado a la estrategia Passport
// concreta), solo la metadata/decorador que ambos lados necesitan compartir se movio aca.
export const IS_PUBLIC_KEY = 'isPublic';
// PascalCase intencional: convencion de Nest para decoradores custom (@Public, @Roles).
// eslint-disable-next-line @typescript-eslint/naming-convention
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
