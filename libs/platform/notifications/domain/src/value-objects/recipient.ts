import { Email, PhoneNumber } from '@platform/shared-kernel';

import type { ChannelValue } from './channel';

export interface RecipientProps {
  email?: string;
  phone?: string;
  deviceToken?: string;
}

// docs/model/04-VALUE_OBJECTS.md SS7 - "destinatario... email o telefono, segun el canal.
// Coherente con el Channel elegido". Reutiliza Email/PhoneNumber de shared-kernel para
// validacion sintactica - deviceToken es opaco (gestionado por mobile via Expo, sin formato
// propio validable aca).
export class Recipient {
  private readonly emailValue?: Email;
  private readonly phoneValue?: PhoneNumber;
  private readonly deviceTokenValue?: string;

  private constructor(props: { email?: Email; phone?: PhoneNumber; deviceToken?: string }) {
    this.emailValue = props.email;
    this.phoneValue = props.phone;
    this.deviceTokenValue = props.deviceToken;
  }

  static from(props: RecipientProps): Recipient {
    return new Recipient({
      email: props.email ? Email.from(props.email) : undefined,
      phone: props.phone ? PhoneNumber.from(props.phone) : undefined,
      deviceToken: props.deviceToken,
    });
  }

  // WhatsApp/SMS necesitan telefono, Email necesita email, Push necesita deviceToken -
  // usado por el fallback de canales de SendNotificationHandler para saltar un canal sin el
  // dato necesario (RN-34).
  hasChannel(channel: ChannelValue): boolean {
    switch (channel) {
      case 'WhatsApp':
      case 'SMS':
        return this.phoneValue !== undefined;
      case 'Email':
        return this.emailValue !== undefined;
      case 'Push':
        return this.deviceTokenValue !== undefined;
    }
  }

  get email(): string | undefined {
    return this.emailValue?.toString();
  }

  get phone(): string | undefined {
    return this.phoneValue?.toString();
  }

  get deviceToken(): string | undefined {
    return this.deviceTokenValue;
  }
}
