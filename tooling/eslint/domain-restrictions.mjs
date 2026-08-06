// Capa "overrides por tipo de proyecto" de docs/engineering/03-CODE-QUALITY.md SS1.6:
// type:domain no importa framework ni infraestructura (docs/05-CONVENCIONES-BACKEND.md SS3).
// El generador de tooling/generators/bounded-context (paso 4) aplica este fragmento en el
// eslint.config.mjs de cada proyecto `domain` que produce.

/** @type {import('eslint').Linter.Config} */
export const domainLayerRestrictions = {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@nestjs/*'],
            message: 'type:domain no depende de NestJS - ver docs/05-CONVENCIONES-BACKEND.md SS3.',
          },
          {
            group: ['@prisma/client'],
            message: 'type:domain no depende de Prisma - ver docs/05-CONVENCIONES-BACKEND.md SS3.',
          },
          {
            group: ['axios'],
            message: 'type:domain no depende de axios - ver docs/05-CONVENCIONES-BACKEND.md SS3.',
          },
        ],
      },
    ],
  },
};
