import { ConcurrentModificationError, type DomainErrorEntries } from '@platform/shared-kernel';
import {
  CompanySettingsNotFoundError,
  EnabledProductModulesEmptyError,
  InvalidPaymentMethodError,
  PaymentMethodsEmptyError,
} from '@platform/settings/domain';

export const SETTINGS_DOMAIN_ERROR_ENTRIES: DomainErrorEntries = [
  [
    EnabledProductModulesEmptyError,
    {
      status: 422,
      code: 'ENABLED_PRODUCT_MODULES_EMPTY',
      title: 'EnabledProductModules no puede quedar vacio',
    },
  ],
  [
    PaymentMethodsEmptyError,
    {
      status: 422,
      code: 'PAYMENT_METHODS_EMPTY',
      title: 'PaymentMethodsEnabled no puede quedar vacio',
    },
  ],
  [
    InvalidPaymentMethodError,
    { status: 422, code: 'INVALID_PAYMENT_METHOD', title: 'Metodo de pago fuera del catalogo' },
  ],
  [
    CompanySettingsNotFoundError,
    { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'CompanySettings no encontrado' },
  ],
  [
    ConcurrentModificationError,
    { status: 409, code: 'CONCURRENT_MODIFICATION', title: 'Modificacion concurrente' },
  ],
];
