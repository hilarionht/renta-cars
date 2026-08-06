// Preset unico de Jest (docs/engineering/04-TESTING-FOUNDATION.md SS1), heredado por
// `preset` desde el jest.config.ts de cada proyecto que genera
// tooling/generators/bounded-context. Hoy es un envoltorio directo del preset de Nx; el
// paso 10 del bootstrap (docs/engineering/10-BOOTSTRAP-PLAN.md) lo completa con el
// globalSetup/globalTeardown de Testcontainers (SS2) para `infrastructure` y con los
// umbrales de cobertura (SS7) - no se crea desde cero en ese paso, se extiende este archivo.

import nxPreset from '@nx/jest/preset';

export default {
  ...nxPreset,
};
