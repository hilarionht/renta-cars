// Extraido de auth/api-client.ts - sin acoplamiento a ningun mecanismo de auth (lectura de
// env pura), reusado tal cual por customer-auth/customer-api-client.ts en vez de duplicar
// el mensaje de error 2 veces.
export function getApiBaseUrl(): string {
  // `unknown`, no `string | undefined`: expo-modules-core (traido por expo-notifications,
  // docs/persistence/10-DECISIONES.md #122) fusiona en NodeJS.ProcessEnv una firma
  // `[key: string]: any`, asi que cualquier variable no declarada se tipa como `any`. Se
  // valida en runtime en vez de confiar en ese tipo (#124). La expresion literal
  // `process.env.EXPO_PUBLIC_API_URL` se conserva - babel-preset-expo la reemplaza al bundlear.
  const url: unknown = process.env.EXPO_PUBLIC_API_URL;
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error('EXPO_PUBLIC_API_URL no esta configurada (apps/mobile/.env).');
  }
  return url;
}
