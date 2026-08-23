import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Expo } from 'expo-server-sdk';

import type {
  PushNotificationInput,
  PushNotificationResult,
  PushNotificationSenderPort,
} from '@platform/notifications/application';

interface ExpoConfig {
  accessToken: string;
}

// docs/11-INTEGRACIONES.md SS5 - SDK oficial "expo-server-sdk", coherente con la decision de
// Expo en el frontend movil. Implementa PushNotificationSenderPort directo (puerto separado
// de NotificationSenderPort, Hallazgo #9) - sin useFactory fake/real, nada lo ejercita esta
// tanda (Hallazgo #11 del plan).
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

  async sendPush(input: PushNotificationInput): Promise<PushNotificationResult> {
    const deviceToken = input.deviceToken;
    if (!Expo.isExpoPushToken(deviceToken)) {
      throw new Error(`deviceToken invalido (se espera Expo push token): "${String(deviceToken)}"`);
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
      throw new Error(`Expo Push respondio con error: ${ticket.message}`);
    }
    return { providerReference: ticket.id };
  }
}
