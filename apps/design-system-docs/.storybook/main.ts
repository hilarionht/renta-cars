import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import type { StorybookConfig } from '@storybook/react-vite';
import react from '@vitejs/plugin-react';
import { mergeConfig } from 'vite';

// docs/technical/02-PROYECTOS.md SS4: "catalogo vivo de ui-kit" - las historias viven en
// libs/frontend/ui-kit-core (headless) y ui-kit-web (renderizado DOM), no en este proyecto
// (docs/07-DESIGN-SYSTEM.md SS2: capas 1-3 viven en libs/frontend/ui-kit).
const config: StorybookConfig = {
  stories: [
    '../../../libs/frontend/ui-kit-core/**/*.@(mdx|stories.@(js|jsx|ts|tsx))',
    '../../../libs/frontend/ui-kit-web/**/*.@(mdx|stories.@(js|jsx|ts|tsx))',
  ],
  addons: [],
  framework: {
    name: getAbsolutePath('@storybook/react-vite'),
    options: {},
  },

  viteFinal: (config) =>
    mergeConfig(config, {
      // Boilerplate oficial de @nx/storybook - nxViteTsPaths() no resuelve tipos bajo
      // nuestro lint estricto (mismo motivo que getAbsolutePath mas abajo).

      plugins: [react(), nxViteTsPaths()],
    }),
};

function getAbsolutePath(value: string): string {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

export default config;

// To customize your Vite configuration you can use the viteFinal field.
// Check https://storybook.js.org/docs/react/builders/vite#configuration
// and https://nx.dev/recipes/storybook/custom-builder-configs
