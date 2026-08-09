import { sharedConfig } from '../../tooling/eslint/index.mjs';

export default [...sharedConfig, { ignores: ['.expo', 'web-build', 'cache', 'dist'] }];
