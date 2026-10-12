// Movido a @platform/persistence-kernel - libs/ (platform-identity-infrastructure/http/
// auth.controller.ts, que aplica @Public() a login/refresh/logout) no puede importar
// apps/api. Re-exportado aca para no romper el resto de apps/api/src/app/auth que ya lo
// importaba desde este path.
export { IS_PUBLIC_KEY, Public } from '@platform/persistence-kernel';
