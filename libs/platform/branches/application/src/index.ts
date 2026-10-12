// Superficie publica de "platform-branches-application".
// Exporta explicitamente cada simbolo (`export { X } from './entities/x'`) - prohibido
// `export *`, salvo el propio index.ts reexportando un unico submodulo interno de barrel.
// Ver docs/technical/09-CODING-STANDARDS.md SS2.
export { BRANCH_REPOSITORY, type BranchRepository } from './ports/branch.repository';
export { BRANCH_LOOKUP_PORT, type BranchLookupPort } from './ports/branch-lookup.port';
export { CreateBranchHandler } from './commands/create-branch/create-branch.handler';
export type { CreateBranchCommand } from './commands/create-branch/create-branch.command';
export { UpdateBranchHandler } from './commands/update-branch/update-branch.handler';
export type { UpdateBranchCommand } from './commands/update-branch/update-branch.command';
export { CloseBranchHandler } from './commands/close-branch/close-branch.handler';
export type { CloseBranchCommand } from './commands/close-branch/close-branch.command';
export { ReopenBranchHandler } from './commands/reopen-branch/reopen-branch.handler';
export type { ReopenBranchCommand } from './commands/reopen-branch/reopen-branch.command';
export type {
  GetBranchQuery,
  ListBranchesQuery,
  BranchSummary,
} from './queries/get-branch/get-branch.query';
