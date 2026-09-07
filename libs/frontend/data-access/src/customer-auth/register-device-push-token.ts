import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

import { customerApiRequest } from './customer-api-client';

// Conectar Push a Reminder (docs/persistence/10-DECISIONES.md #122). Fire-and-forget desde
// CustomerAuthGuard tras el login - nunca lanza, cualquier fallo (permiso denegado, sin
// projectId de EAS vinculado, Expo Go sin soporte de push remoto desde SDK 53+) se resuelve en
// silencio, sin bloquear la UI. projectId de app.json extra.eas.projectId (Constants.
// expoConfig) - requerido por getExpoPushTokenAsync() en SDKs modernos.
export async function registerDevicePushToken(): Promise<void> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== Notifications.PermissionStatus.GRANTED) {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== Notifications.PermissionStatus.GRANTED) {
    return;
  }

  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  const { data: deviceToken } = await Notifications.getExpoPushTokenAsync({
    projectId: extra?.eas?.projectId,
  });

  await customerApiRequest('/api/v1/me/push-token', { method: 'PATCH', body: { deviceToken } });
}
