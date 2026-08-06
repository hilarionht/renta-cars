// Capas "Base TypeScript", "Import order", "Naming" y la regla personalizada de Prisma
// de docs/engineering/03-CODE-QUALITY.md SS1.1, SS1.3-5. Alcance: solo archivos TypeScript
// de proyectos Nx - los .mjs de tooling/ y de configuracion raiz no son codigo de dominio
// y no requieren chequeo de tipos.

import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';

const TS_FILES = ['**/*.ts', '**/*.tsx'];

/** @type {import('eslint').Linter.Config[]} */
export const baseConfig = tseslint.config({
  files: TS_FILES,
  extends: [...tseslint.configs.recommendedTypeChecked, importX.flatConfigs.typescript],
  languageOptions: {
    parserOptions: {
      // Archivos .ts sueltos fuera de cualquier proyecto Nx (config raiz de Jest, presets
      // compartidos de tooling/) no tienen tsconfig.json propio - se typechequean con el
      // "default project" en vez de fallar el parseo.
      projectService: {
        allowDefaultProject: ['jest.config.ts', 'prisma.config.ts', 'tooling/jest/*.ts'],
      },
      tsconfigRootDir: process.cwd(),
    },
  },
  rules: {
    // docs/technical/09-CODING-STANDARDS.md SS4: prohibido `any` para evadir un error de tipos.
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/consistent-type-imports': 'error',

    // docs/technical/09-CODING-STANDARDS.md SS2: 3 bloques de import con linea en blanco.
    'import-x/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
        pathGroups: [
          {
            pattern: '{@platform/**,@rental/**,@frontend/**}',
            group: 'internal',
            position: 'before',
          },
        ],
        pathGroupsExcludedImportTypes: ['builtin'],
        'newlines-between': 'always',
      },
    ],

    // docs/technical/09-CODING-STANDARDS.md SS1: naming de clases/tipos, funciones/variables
    // y tokens de inyeccion.
    '@typescript-eslint/naming-convention': [
      'error',
      { selector: 'typeLike', format: ['PascalCase'] },
      { selector: 'variable', format: ['camelCase', 'UPPER_CASE'], leadingUnderscore: 'allow' },
      { selector: 'function', format: ['camelCase'] },
      { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
      {
        selector: 'variable',
        modifiers: ['const', 'global'],
        types: ['boolean', 'string', 'number'],
        format: ['UPPER_CASE', 'camelCase'],
      },
    ],

    // docs/engineering/03-CODE-QUALITY.md SS1.5: prohibido Prisma "raw unsafe" fuera de
    // una excepcion explicita y documentada (docs/technical/07-SECURITY.md SS6). La
    // excepcion se declara con un `eslint-disable-next-line` justificado en el propio
    // comentario, exigido ya como politica general en 03-CODE-QUALITY.md SS6.
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "MemberExpression[property.name='$queryRawUnsafe'], MemberExpression[property.name='$executeRawUnsafe']",
        message:
          'Prisma $queryRawUnsafe/$executeRawUnsafe prohibido fuera de una excepcion documentada (docs/technical/07-SECURITY.md SS6).',
      },
    ],
  },
});
