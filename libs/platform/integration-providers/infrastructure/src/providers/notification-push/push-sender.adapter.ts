import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Expo } from 'expo-server-sdk';

import {
  type PushNotificationInput,
  type PushNotificationResult,
  type PushNotificationSenderPort,
  PushTokenInvalidError,
} from '@platform/notifications/application';

interface ExpoConfig {
  accessToken: string;
}

// docs/11-INTEGRACIONES.md SS5 - SDK oficial "expo-server-sdk", coherente con la decision de
// Expo en el frontend movil. Implementa PushNotificationSenderPort directo (puerto separado
// de NotificationSenderPort, Hallazgo #9).
@Injectable()
export class PushSenderAdapter implements PushNotificationSenderPort {
  private readonly config: ExpoConfig;
  private lazyClient?: Expo;

  constructor(configService: ConfigService) {
    this.config = configService.getOrThrow<ExpoConfig>('notifications.expo');
  }

  private get client(): Expo {
    if (!this.lazyClient) {
      this.lazyClient = new Expo({ accessToken: this.config.accessToken || undefined });
    }
    return this.lazyClient;
  }

  // docs/contracts/05-INTEGRATION-CONTRACTS.md SS2, semantica de error: "un token invalido/
  // expirado... se registra y el token se marca para limpieza" - distinto de cualquier otro
  // fallo (transitorio, no se limpia el token solo por eso). Un deviceToken con formato
  // invalido (nunca fue un Expo push token real) y un ticket 'error' con
  // details.error === 'DeviceNotRegistered' (Expo confirmo que el dispositivo/token ya no
  // existe) son los 2 unicos casos "para siempre" - docs/persistence/10-DECISIONES.md #122.
  async sendPush(input: PushNotificationInput): Promise<PushNotificationResult> {
    const deviceToken = input.deviceToken;
    if (!Expo.isExpoPushToken(deviceToken)) {
      throw new PushTokenInvalidError(
        `formato invalido (se espera Expo push token): "${String(deviceToken)}"`,
      );
    }

    const [ticket] = await this.client.sendPushNotificationsAsync([
      {
        to: input.deviceToken,
        title: input.title,
        body: input.body,
        data: input.data,
      },
    ]);

    if (ticket.status === 'error') {
      if (ticket.details?.error === 'DeviceNotRegistered') {
        throw new PushTokenInvalidError('Expo respondio DeviceNotRegistered');
      }
      throw new Error(`Expo Push respondio con error: ${ticket.message}`);
    }
    return { providerReference: ticket.id };
  }
}
