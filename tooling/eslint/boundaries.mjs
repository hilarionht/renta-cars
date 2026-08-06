// Fronteras entre proyectos Nx: traduce a depConstraints ejecutables la matriz de
// docs/technical/01-MONOREPO.md SS4-5. No redefine la matriz, la expresa en configuracion.
//
// Nota de alcance (paso 2 del bootstrap, docs/engineering/10-BOOTSTRAP-PLAN.md): la unica
// celda de la matriz que el modelo de tags de 3 ejes de Nx (scope/type/module) no puede
// expresar con `onlyDependOnLibsWithTags`/`notDependOnLibsWithTags` de forma generica es
// "type:application del modulo Z no puede depender de type:infrastructure del MISMO
// modulo Z, pero si de la infraestructura de otro modulo" (SS5, fila type:application,
// columna 5 vs columna 4) - un mismo tag (`type:infrastructure`) no puede estar permitido
// y prohibido a la vez segun el modulo del destino con reglas basadas en un unico tag.
// Esa restriccion puntual se resuelve en el paso 4 (generadores), que si conoce su propio
// nombre de modulo en el momento de generar el proyecto `application` y puede emitir una
// regla `no-restricted-imports` local contra su propio alias de infraestructura.

import { ALL_MODULES } from './modules.mjs';

const moduleConstraints = ALL_MODULES.map((module) => ({
  sourceTag: `module:${module}`,
  onlyDependOnLibsWithTags: [`module:${module}`, 'scope:shared', 'type:application', 'type:infrastructure'],
}));

export const depConstraints = [
  // Eje scope - INV-P03 y regla 3 de 01-MONOREPO.md SS5 (la exigencia complementaria,
  // "product-rental solo puede depender de platform via application/infrastructure", ya
  // queda garantizada por el aislamiento de type:domain de abajo: ningun sourceTag permite
  // llegar al domain de otro modulo, sea cual sea su scope).
  { sourceTag: 'scope:platform', notDependOnLibsWithTags: ['scope:product-rental'] },
  { sourceTag: 'scope:frontend', notDependOnLibsWithTags: ['scope:platform', 'scope:product-rental'] },

  // Eje type - direccion de dependencia de Clean Architecture (mismo modulo, matriz SS5).
  { sourceTag: 'type:domain', onlyDependOnLibsWithTags: ['type:domain', 'scope:shared'] },
  {
    sourceTag: 'type:application',
    onlyDependOnLibsWithTags: ['type:domain', 'type:application', 'type:infrastructure', 'scope:shared'],
  },
  {
    sourceTag: 'type:infrastructure',
    onlyDependOnLibsWithTags: ['type:domain', 'type:application', 'type:infrastructure', 'scope:shared'],
  },

  // Eje type - type:feature lo llevan tanto apps/api (scope:platform) como web-admin/
  // mobile (scope:frontend) - docs/technical/02-PROYECTOS.md SS1. apps/api es la raiz de
  // composicion (docs/technical/03-BACKEND-ARCHITECTURE.md SS1: "AppModule importa los
  // modulos NestJS de cada libreria infrastructure"), asi que necesita alcanzar
  // domain/application/infrastructure - la regla de scope:frontend de arriba ya impide que
  // web-admin/mobile lleguen a scope:platform/scope:product-rental, asi que ensanchar esto
  // no les abre nada nuevo a ellos, solo a apps/api.
  {
    sourceTag: 'type:feature',
    onlyDependOnLibsWithTags: ['type:feature', 'type:ui', 'type:util', 'type:domain', 'type:application', 'type:infrastructure'],
  },
  { sourceTag: 'type:ui', onlyDependOnLibsWithTags: ['type:ui'] },

  // type:e2e es siempre hoja terminal del grafo - nadie lo importa (regla 5 de SS5).
  { sourceTag: '*', notDependOnLibsWithTags: ['type:e2e'] },

  // Eje module - aisla el domain de un modulo del domain de cualquier otro modulo;
  // el cruce entre modulos solo puede pasar por application/infrastructure publicos.
  ...moduleConstraints,
];

/** @type {import('eslint').Linter.Config[]} */
export const boundariesConfig = [
  {
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          // tooling/eslint/ y tooling/jest/ no son proyectos Nx (no tienen alias @platform/
          // @rental/@frontend, docs/technical/01-MONOREPO.md SS8) - todo proyecto los
          // referencia por ruta relativa desde su propio eslint.config.mjs/jest.config.ts,
          // que es exactamente el patron que este `allow` exceptua. El eslint.config.mjs
          // raiz tampoco es un proyecto Nx (es config, no codigo de dominio) - generadores
          // oficiales de Nx (@nx/nest, @nx/next, ...) lo referencian por ruta relativa.
          allow: ['tooling/eslint/', 'tooling/jest/', 'eslint\\.config\\.mjs$'],
          depConstraints,
        },
      ],
    },
  },
];
