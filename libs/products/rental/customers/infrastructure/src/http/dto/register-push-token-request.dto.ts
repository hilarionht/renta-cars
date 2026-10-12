import { IsNotEmpty, IsString } from 'class-validator';

// deviceToken opaco (Recipient VO, notifications/domain: "sin formato propio validable aca") -
// esta ruta siempre registra, nunca limpia (null es uso interno del comando, ver
// register-customer-push-token.command.ts).
export class RegisterPushTokenRequestDto {
  @IsString()
  @IsNotEmpty()
  deviceToken!: string;
}
