import {
  formatFiles,
  joinPathFragments,
  logger,
  offsetFromRoot,
  readProjectConfiguration,
  runTasksInSerial,
  updateProjectConfiguration,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { libraryGenerator } from '@nx/js';

import type { BoundedContextGeneratorSchema } from './schema';

// Arbol interno por capa - docs/05-CONVENCIONES-BACKEND.md SS1, referenciado desde
// docs/engineering/01-WORKSPACE.md SS5.1.
const LAYER_FOLDERS = {
  domain: ['entities', 'value-objects', 'events', 'services', 'ports'],
  application: ['commands', 'queries', 'ports'],
  infrastructure: ['persistence/prisma', 'http', 'events', 'providers'],
} as const;

type Layer = keyof typeof LAYER_FOLDERS;

const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export default async function boundedContextGenerator(
  tree: Tree,
  schema: BoundedContextGeneratorSchema,
): Promise<GeneratorCallback> {
  const { name, scope, skipDomain = false } = schema;

  if (!KEBAB_CASE.test(name)) {
    throw new Error(`El nombre del modulo debe ser kebab-case (recibido: "${name}").`);
  }

  const scopeTag = scope === 'platform' ? 'scope:platform' : 'scope:product-rental';
  const scopeShort = scope === 'platform' ? 'platform' : 'rental';
  const aliasPrefix = scope === 'platform' ? '@platform' : '@rental';
  const basePath = scope === 'platform' ? `libs/platform/${name}` : `libs/products/rental/${name}`;

  // Excepcion "sin domain" - docs/technical/01-MONOREPO.md SS3.1 (unico caso hoy: reports).
  const layers: Layer[] = skipDomain
    ? ['application', 'infrastructure']
    : ['domain', 'application', 'infrastructure'];

  const tasks: GeneratorCallback[] = [];

  for (const layer of layers) {
    const projectName = `${scopeShort}-${name}-${layer}`;
    const projectRoot = `${basePath}/${layer}`;
    const importPath = `${aliasPrefix}/${name}/${layer}`;

    const task = await libraryGenerator(tree, {
      directory: projectRoot,
      name: projectName,
      tags: [scopeTag, `type:${layer}`, `module:${name}`].join(','),
      importPath,
      unitTestRunner: 'jest',
      linter: 'eslint',
      bundler: 'none',
      minimal: true,
      useProjectJson: true,
      skipFormat: true,
    });
    tasks.push(task);

    // @nx/js:library deja un archivo/spec de ejemplo en src/lib/ - no forma parte del
    // arbol de 05-CONVENCIONES-BACKEND.md SS1, se reemplaza por las carpetas propias del
    // paso 4 de docs/engineering/10-BOOTSTRAP-PLAN.md.
    tree.delete(joinPathFragments(projectRoot, 'src/lib', `${projectName}.ts`));
    tree.delete(joinPathFragments(projectRoot, 'src/lib', `${projectName}.spec.ts`));

    for (const folder of LAYER_FOLDERS[layer]) {
      tree.write(joinPathFragments(projectRoot, 'src', folder, '.gitkeep'), '');
    }

    // docs/technical/09-CODING-STANDARDS.md SS2: index.ts exporta explicitamente, nunca `export *`.
    tree.write(
      joinPathFragments(projectRoot, 'src', 'index.ts'),
      [
        `// Superficie publica de "${projectName}".`,
        "// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido",
        '// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.',
        '// Ver docs/technical/09-CODING-STANDARDS.md SS2.',
        '',
      ].join('\n'),
    );

    // docs/engineering/03-CODE-QUALITY.md SS1: config unica de tooling/eslint/, heredada sin
    // excepcion (reemplaza el eslint.config.mjs por defecto de @nx/js:library).
    const eslintConfigPath = joinPathFragments(
      offsetFromRoot(projectRoot),
      'tooling/eslint/index.mjs',
    );
    tree.write(
      joinPathFragments(projectRoot, 'eslint.config.mjs'),
      layer === 'domain'
        ? [
            `import { sharedConfig, domainLayerRestrictions } from '${eslintConfigPath}';`,
            '',
            'export default [...sharedConfig, domainLayerRestrictions];',
            '',
          ].join('\n')
        : [
            `import { sharedConfig } from '${eslintConfigPath}';`,
            '',
            'export default [...sharedConfig];',
            '',
          ].join('\n'),
    );

    // docs/engineering/04-TESTING-FOUNDATION.md SS1: preset unico en tooling/jest/base.config.ts.
    // @nx/js:library genera por defecto jest.config.cts (con `module.exports`, que falla al
    // typecheckearse con ts-jest en este workspace) - se reemplaza por un jest.config.ts que
    // apunta al preset unico.
    tree.delete(joinPathFragments(projectRoot, 'jest.config.cts'));
    const jestPresetPath = joinPathFragments(
      offsetFromRoot(projectRoot),
      'tooling/jest/base.config.ts',
    );
    tree.write(
      joinPathFragments(projectRoot, 'jest.config.ts'),
      [
        'export default {',
        `  displayName: '${projectName}',`,
        `  preset: '${jestPresetPath}',`,
        "  testEnvironment: 'node',",
        // Un modulo recien generado no tiene tests todavia - `nx test` no debe fallar solo
        // por ausencia de specs (distinto de un test que existe y falla).
        '  passWithNoTests: true,',
        '};',
        '',
      ].join('\n'),
    );

    // El binding puerto -> adaptador de docs/05-CONVENCIONES-BACKEND.md SS3-4 (`<modulo>.module.ts`,
    // NestJS) no se genera aqui: NestJS recien se agrega al workspace en el paso 7 del bootstrap
    // (docs/engineering/10-BOOTSTRAP-PLAN.md) y un import a `@nestjs/common` hoy no resolveria.
    // Se crea junto con el primer caso de uso real del modulo.

    // `typecheck` explicito (sin el plugin de inferencia @nx/js/typescript, que exige un
    // tsconfig.json raiz con project references sincronizadas - fuera del arbol raiz de
    // docs/engineering/01-WORKSPACE.md SS1). Usado por el hook `pre-push` del paso 2.
    const projectConfig = readProjectConfiguration(tree, projectName);
    updateProjectConfiguration(tree, projectName, {
      ...projectConfig,
      targets: {
        ...projectConfig.targets,
        typecheck: {
          executor: 'nx:run-commands',
          options: {
            command: 'tsc --build tsconfig.json',
            cwd: projectRoot,
          },
          cache: true,
          inputs: ['default', '^production'],
        },
      },
    });

    logger.info(`  ${projectName} -> ${projectRoot} (${importPath})`);
  }

  await formatFiles(tree);

  return runTasksInSerial(...tasks);
}
