import {
  NOTIFICATION_CHANNELS,
  NotificationChannelPreference,
} from './notification-channel-preference';
import { InvalidNotificationChannelError } from '../errors/invalid-notification-channel.error';

describe('NotificationChannelPreference', () => {
  it.each(NOTIFICATION_CHANNELS)('from() acepta "%s" (catalogo cerrado)', (channel) => {
    expect(NotificationChannelPreference.from(channel).toString()).toBe(channel);
  });

  it('from() rechaza un valor fuera del catalogo con InvalidNotificationChannelError', () => {
    expect(() => NotificationChannelPreference.from('Fax')).toThrow(
      InvalidNotificationChannelError,
    );
  });

  it('from() rechaza "Push" - fuera de la preferencia/fallback (VO propio de Notification)', () => {
    expect(() => NotificationChannelPreference.from('Push')).toThrow(
      InvalidNotificationChannelError,
    );
  });

  it('default() es Email', () => {
    expect(NotificationChannelPreference.default().toString()).toBe('Email');
  });
});
