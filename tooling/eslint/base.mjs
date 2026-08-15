// Capas "Base TypeScript", "Import order", "Naming" y la regla personalizada de Prisma
// de docs/engineering/03-CODE-QUALITY.md SS1.1, SS1.3-5. Alcance: solo archivos TypeScript
// de proyectos Nx - los .mjs de tooling/ y de configuracion raiz no son codigo de dominio
// y no requieren chequeo de tipos.

import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';

const TS_FILES = ['**/*.ts', '**/*.tsx'];

// Archivos de configuracion sueltos en la raiz (sin proyecto Nx propio). Se excluyen del
// bloque type-aware de abajo y se linten aparte (SS de mas abajo): un patron sin `/` en
// `allowDefaultProject` matchea por basename a cualquier profundidad (choca con
// apps/api/jest.config.ts, que si tiene su propio tsconfig), y un archivo en la raiz no
// tiene forma de anclarse de otro modo porque su ruta relativa ya no tiene `/`.
const ROOT_CONFIG_FILES = ['jest.config.ts', 'prisma.config.ts'];

const importOrderRule = [
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
];

/** @type {import('eslint').Linter.Config[]} */
export const baseConfig = [
  ...tseslint.config({
    files: TS_FILES,
    ignores: ROOT_CONFIG_FILES,
    extends: [...tseslint.configs.recommendedTypeChecked, importX.flatConfigs.typescript],
    languageOptions: {
      parserOptions: {
        // tooling/jest/base.config.ts no tiene proyecto Nx propio (SS anterior) - unico
        // caso que si puede anclarse porque su ruta relativa conserva un `/`.
        projectService: {
          allowDefaultProject: ['tooling/jest/*.ts'],
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
      'import-x/order': importOrderRule,

      // docs/technical/09-CODING-STANDARDS.md SS1: naming de clases/tipos, funciones/variables
      // y tokens de inyeccion.
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE'], leadingUnderscore: 'allow' },
        // PascalCase agregado en el paso 13 (docs/engineering/10-BOOTSTRAP-PLAN.md): un
        // componente de React es una funcion, y la convencion universal del ecosistema
        // (docs/06-CONVENCIONES-FRONTEND.md) es PascalCase - no reemplaza camelCase, lo
        // amplia (una funcion de backend sigue validandose igual que antes).
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
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
  }),
  {
    // Tests unitarios/integracion (docs/engineering/04-TESTING-FOUNDATION.md): asertar sobre
    // un metodo de un objeto fake/mock tipado (`expect(fakeRepo.save).toHaveBeenCalledWith(...)`)
    // es el patron estandar de Jest para este tipo de test - unbound-method lo marca como
    // falso positivo sistematico (no detecta que Jest nunca invoca el metodo desligado de su
    // objeto, solo inspecciona las llamadas ya registradas). `expect.objectContaining`/
    // `expect.anything` (tipos de @types/jest) devuelven `any` - cualquier assertion anidada
    // sobre la forma de un payload dispara los no-unsafe-* aunque el test sea correcto; son
    // ruido especifico de las utilidades de Jest, no descuido de tipado en codigo de negocio.
    files: ['**/*.spec.ts', '**/*.integration.spec.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    // Config raiz suelta: solo sintaxis (sin type-aware linting, sin necesitar tsconfig).
    files: ROOT_CONFIG_FILES,
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'import-x': importX,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'import-x/order': importOrderRule,
    },
  },
];
