import { formatFiles, joinPathFragments, readProjectConfiguration, type Tree } from '@nx/devkit';

import type { FrontendFeatureGeneratorSchema } from './schema';

const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

// docs/06-CONVENCIONES-FRONTEND.md SS2: "ui-kit no importa data-access (un boton no sabe de
// reservas)"; una feature nunca importa ui-kit-core directamente, solo la variante de su
// plataforma (docs/engineering/01-WORKSPACE.md SS5.2).
const UI_KIT_ALIAS = {
  'web-admin': '@frontend/ui-kit-web',
  mobile: '@frontend/ui-kit-mobile',
} as const;

// Convencion de enrutado por app - docs/06-CONVENCIONES-FRONTEND.md SS3 (Next.js App Router)
// y SS4 (Expo Router). No inventa una tercera convencion: cada app usa la suya.
// web-admin se genera con `--src` (Next.js App Router bajo src/app/, docs/engineering/
// 10-BOOTSTRAP-PLAN.md paso 13) - mobile no usa carpeta `src/` para sus rutas (Expo Router
// las resuelve desde app/ en la raiz del proyecto).
function featureFileForApp(
  app: FrontendFeatureGeneratorSchema['app'],
  appRoot: string,
  name: string,
): string {
  return app === 'web-admin'
    ? joinPathFragments(appRoot, 'src', 'app', '(admin)', name, 'page.tsx')
    : joinPathFragments(appRoot, 'app', name, 'index.tsx');
}

export default async function frontendFeatureGenerator(
  tree: Tree,
  schema: FrontendFeatureGeneratorSchema,
): Promise<void> {
  const { name, app } = schema;

  if (!KEBAB_CASE.test(name)) {
    throw new Error(`El nombre de la feature debe ser kebab-case (recibido: "${name}").`);
  }

  let appConfig;
  try {
    appConfig = readProjectConfiguration(tree, app);
  } catch {
    throw new Error(
      `El proyecto "${app}" todavia no existe en el workspace - se genera en el paso 13 de ` +
        'docs/engineering/10-BOOTSTRAP-PLAN.md ("apps/web-admin y apps/mobile: esqueletos"). ' +
        'Ejecuta este generador despues de completar ese paso.',
    );
  }

  const uiKitAlias = UI_KIT_ALIAS[app];
  const featureFile = featureFileForApp(app, appConfig.root, name);

  tree.write(
    featureFile,
    [
      `// Feature "${name}" de "${app}" - docs/06-CONVENCIONES-FRONTEND.md SS2.`,
      '// Regla de dependencia: esta feature -> @frontend/data-access + ui-kit -> @frontend/domain-types.',
      "// Nunca al reves, y nunca importa '@frontend/ui-kit-core' directamente (solo la variante de plataforma).",
      '//',
      "// import { /* useX */ } from '@frontend/data-access';",
      `// import { /* Componente */ } from '${uiKitAlias}';`,
      '',
    ].join('\n'),
  );

  await formatFiles(tree);
}
