import Constants, { ExecutionEnvironment } from 'expo-constants';

import { customerApiRequest } from './customer-api-client';

// Conectar Push a Reminder (docs/persistence/10-DECISIONES.md #122). Fire-and-forget desde
// CustomerAuthGuard tras el login - nunca lanza, cualquier fallo (permiso denegado, sin
// projectId de EAS vinculado) se resuelve en silencio, sin bloquear la UI. projectId de
// app.json extra.eas.projectId (Constants.expoConfig) - requerido por getExpoPushTokenAsync()
// en SDKs modernos.
//
// Expo Go (executionEnvironment StoreClient) no soporta push remoto desde SDK 53, y en Android
// el solo hecho de IMPORTAR expo-notifications lanza al cargar el modulo - tumbaba la app
// entera al arrancar, porque @frontend/data-access lo importaba estaticamente (#133). Por eso:
// en Expo Go no se hace nada, y en un development/standalone build el modulo se carga recien
// aca, de forma diferida, nunca al importar la libreria.
export async function registerDevicePushToken(): Promise<void> {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return;
  }
  const notifications = await import('expo-notifications');

  const { status: existingStatus } = await notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== notifications.PermissionStatus.GRANTED) {
    const { status } = await notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== notifications.PermissionStatus.GRANTED) {
    return;
  }

  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  const { data: deviceToken } = await notifications.getExpoPushTokenAsync({
    projectId: extra?.eas?.projectId,
  });

  await customerApiRequest('/api/v1/me/push-token', { method: 'PATCH', body: { deviceToken } });
}
