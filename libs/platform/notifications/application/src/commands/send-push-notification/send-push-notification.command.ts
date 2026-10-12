export interface SendPushNotificationCommand {
  deviceToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}
