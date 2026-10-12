import { IsString } from 'class-validator';

// Sin @IsIn() a proposito - un valor fuera del catalogo lo rechaza el dominio
// (NotificationChannelPreference.from() -> InvalidNotificationChannelError -> 422), mismo
// criterio que UpdatePaymentMethodsEnabledRequestDto.
export class UpdateNotificationChannelPreferenceRequestDto {
  @IsString()
  preferredChannel!: string;
}
