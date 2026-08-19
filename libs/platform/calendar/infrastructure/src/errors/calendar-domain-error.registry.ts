import { ConcurrentModificationError, type DomainErrorEntries } from '@platform/shared-kernel';
import {
  AvailabilitySlotNotFoundError,
  AvailabilitySlotOverlapError,
} from '@platform/calendar/domain';

export const CALENDAR_DOMAIN_ERROR_ENTRIES: DomainErrorEntries = [
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
