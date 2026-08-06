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

  // Eje type - frontend (06-CONVENCIONES-FRONTEND.md, "un boton no sabe de reservas").
  { sourceTag: 'type:feature', onlyDependOnLibsWithTags: ['type:feature', 'type:ui', 'type:util'] },
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
          depConstraints,
        },
      ],
    },
  },
];
