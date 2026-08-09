import { sharedConfig } from '../../tooling/eslint/index.mjs';

export default [...sharedConfig, { ignores: ['.next/**/*'] }];
