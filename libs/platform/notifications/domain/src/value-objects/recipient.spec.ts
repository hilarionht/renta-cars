import { Recipient } from './recipient';

describe('Recipient', () => {
  it('hasChannel: Email requiere email', () => {
    expect(Recipient.from({ email: 'user@example.com' }).hasChannel('Email')).toBe(true);
    expect(Recipient.from({ phone: '+525500000000' }).hasChannel('Email')).toBe(false);
  });

  it('hasChannel: WhatsApp/SMS requieren telefono', () => {
    const withPhone = Recipient.from({ phone: '+525500000000' });
    expect(withPhone.hasChannel('WhatsApp')).toBe(true);
    expect(withPhone.hasChannel('SMS')).toBe(true);

    const withEmail = Recipient.from({ email: 'user@example.com' });
    expect(withEmail.hasChannel('WhatsApp')).toBe(false);
    expect(withEmail.hasChannel('SMS')).toBe(false);
  });

  it('hasChannel: Push requiere deviceToken', () => {
    expect(Recipient.from({ deviceToken: 'expo-token-1' }).hasChannel('Push')).toBe(true);
    expect(Recipient.from({ email: 'user@example.com' }).hasChannel('Push')).toBe(false);
  });

  it('valida email/telefono con los VOs de shared-kernel', () => {
    expect(() => Recipient.from({ email: 'no-es-un-email' })).toThrow(TypeError);
    expect(() => Recipient.from({ phone: 'no-es-un-telefono' })).toThrow(TypeError);
  });
});
