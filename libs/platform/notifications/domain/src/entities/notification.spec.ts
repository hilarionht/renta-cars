import { NotificationInvalidStateTransitionError } from '../errors/notification-invalid-state-transition.error';
import { Recipient } from '../value-objects/recipient';
import { Notification } from './notification';

function createNotification(): Notification {
  return Notification.create({
    companyId: 'company-1',
    kind: 'Alert',
    recipient: Recipient.from({ email: 'user@example.com' }),
    templateId: 'user-welcome',
  });
}

describe('Notification', () => {
  describe('create', () => {
    it('crea la notification Pending, version 1, sin evento propio', () => {
      const notification = createNotification();

      expect(notification.status).toBe('Pending');
      expect(notification.version).toBe(1);
      expect(notification.isNew).toBe(true);
      expect(notification.pullDomainEvents()).toHaveLength(0);
    });
  });

  describe('send', () => {
    it('transiciona Pending -> Sent y emite NotificationSent.v1', () => {
      const notification = createNotification();

      notification.send('Email', 'provider-ref-1');

      expect(notification.status).toBe('Sent');
      expect(notification.channel).toBe('Email');
      expect(notification.providerReference).toBe('provider-ref-1');
      const events = notification.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventType: 'NotificationSent.v1',
        channel: 'Email',
        kind: 'Alert',
      });
    });

    it('lanza NotificationInvalidStateTransitionError si ya esta Sent', () => {
      const notification = createNotification();
      notification.send('Email', 'provider-ref-1');

      expect(() => notification.send('SMS', 'provider-ref-2')).toThrow(
        NotificationInvalidStateTransitionError,
      );
    });
  });

  describe('markDelivered', () => {
    it('transiciona Sent -> Delivered y emite NotificationDelivered.v1', () => {
      const notification = createNotification();
      notification.send('Email', 'provider-ref-1');
      notification.pullDomainEvents();

      notification.markDelivered();

      expect(notification.status).toBe('Delivered');
      expect(notification.deliveredAt).toBeInstanceOf(Date);
      const events = notification.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ eventType: 'NotificationDelivered.v1' });
    });

    it('lanza NotificationInvalidStateTransitionError si no esta Sent', () => {
      const notification = createNotification();

      expect(() => notification.markDelivered()).toThrow(NotificationInvalidStateTransitionError);
    });
  });

  describe('fail', () => {
    it('transiciona Pending -> Failed (reintento agotado) y emite NotificationFailed.v1', () => {
      const notification = createNotification();

      notification.fail('todos los canales fallaron', true);

      expect(notification.status).toBe('Failed');
      expect(notification.failureReason).toBe('todos los canales fallaron');
      expect(notification.channelsExhausted).toBe(true);
      const events = notification.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventType: 'NotificationFailed.v1',
        channelsExhausted: true,
      });
    });

    it('lanza NotificationInvalidStateTransitionError si ya esta Sent', () => {
      const notification = createNotification();
      notification.send('Email', 'provider-ref-1');

      expect(() => notification.fail('x', true)).toThrow(NotificationInvalidStateTransitionError);
    });
  });

  describe('markFailed', () => {
    it('transiciona Sent -> Failed (fallo asincrono) con channelsExhausted false', () => {
      const notification = createNotification();
      notification.send('Email', 'provider-ref-1');
      notification.pullDomainEvents();

      notification.markFailed('rebotado por el proveedor');

      expect(notification.status).toBe('Failed');
      expect(notification.failureReason).toBe('rebotado por el proveedor');
      expect(notification.channelsExhausted).toBe(false);
      const events = notification.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventType: 'NotificationFailed.v1',
        channelsExhausted: false,
      });
    });

    it('lanza NotificationInvalidStateTransitionError si no esta Sent', () => {
      const notification = createNotification();

      expect(() => notification.markFailed('x')).toThrow(NotificationInvalidStateTransitionError);
    });
  });
});
