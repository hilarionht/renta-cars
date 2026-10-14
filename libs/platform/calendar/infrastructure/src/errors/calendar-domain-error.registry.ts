import {
  ConcurrentModificationError,
  type DomainErrorEntries,
  InvalidValueError,
} from '@platform/shared-kernel';
import {
  AvailabilitySlotNotFoundError,
  AvailabilitySlotOverlapError,
} from '@platform/calendar/domain';

export const CALENDAR_DOMAIN_ERROR_ENTRIES: DomainErrorEntries = [
  // #137: VO con dato de entrada invalido (antes TypeError crudo -> 500).
  [
    InvalidValueError,
    { status: 400, code: 'INVALID_VALUE', title: 'Un valor de la solicitud no es valido' },
  ],
  [
    AvailabilitySlotOverlapError,
    {
      status: 409,
      code: 'AVAILABILITY_SLOT_OVERLAP',
      title: 'El rango solicitado se solapa con un slot activo existente',
    },
  ],
  [
    AvailabilitySlotNotFoundError,
    { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'Availability slot no encontrado' },
  ],
  [
    ConcurrentModificationError,
    { status: 409, code: 'CONCURRENT_MODIFICATION', title: 'Modificacion concurrente' },
  ],
];
