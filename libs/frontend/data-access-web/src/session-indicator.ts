// docs/persistence/10-DECISIONES.md #134. La cookie refresh_token es httpOnly y pertenece al
// origen del API: el proxy de Next (apps/web-admin/src/proxy.ts) no la puede ver. Para decidir
// redirecciones usa esta cookie INDICADORA, que no contiene ningun secreto ("hubo login en
// este navegador"). La autorizacion real la hace siempre el API en cada request.
export const SESSION_INDICATOR_COOKIE = 'renta_session';

export function markSessionActive(): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.cookie = `${SESSION_INDICATOR_COOKIE}=1; Path=/; SameSite=Lax`;
}

export function clearSessionIndicator(): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.cookie = `${SESSION_INDICATOR_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function hasSessionIndicator(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  return document.cookie
    .split(';')
    .some((part) => part.trim().startsWith(`${SESSION_INDICATOR_COOKIE}=1`));
}
