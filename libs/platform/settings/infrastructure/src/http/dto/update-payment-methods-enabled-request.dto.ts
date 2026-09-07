import { IsArray, IsString } from 'class-validator';

// Sin @ArrayNotEmpty()/@IsIn() a proposito - vacio lo rechaza el dominio
// (PaymentMethodsEmptyError -> 422); un valor fuera del catalogo lo rechaza PaymentMethod.from()
// (InvalidPaymentMethodError -> 422) - ambos son reglas de negocio, no de forma de la request.
export class UpdatePaymentMethodsEnabledRequestDto {
  @IsArray()
  @IsString({ each: true })
  paymentMethodsEnabled!: string[];
}
