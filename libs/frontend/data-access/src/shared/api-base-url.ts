// Extraido de auth/api-client.ts - sin acoplamiento a ningun mecanismo de auth (lectura de
// env pura), reusado tal cual por customer-auth/customer-api-client.ts en vez de duplicar
// el mensaje de error 2 veces.
export function getApiBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) {
    throw new Error('EXPO_PUBLIC_API_URL no esta configurada (apps/mobile/.env).');
  }
  return url;
}
