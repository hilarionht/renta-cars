// @frontend/data-access-web - sesion del personal y permisos para la web de administracion
// (Next.js). Solo navegador: todo lo que exporta es 'use client'. docs/persistence/
// 10-DECISIONES.md #134.
export {
  WebAuthProvider,
  useWebAuth,
  type AuthStatus,
  type LoginInput,
  type LoginResult,
} from './auth-context';
export {
  Can,
  CURRENT_USER_QUERY_KEY,
  buildPermissions,
  useCurrentUser,
  usePermissions,
  type Permissions,
} from './current-user';
export { createRefreshCoordinator } from './refresh-coordinator';
export {
  SESSION_INDICATOR_COOKIE,
  clearSessionIndicator,
  hasSessionIndicator,
  markSessionActive,
} from './session-indicator';
