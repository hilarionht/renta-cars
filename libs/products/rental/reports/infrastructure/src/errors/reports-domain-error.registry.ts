import type { DomainErrorEntries } from '@platform/shared-kernel';
import { InvalidReportRangeError } from '@rental/reports/application';

export const REPORTS_DOMAIN_ERROR_ENTRIES: DomainErrorEntries = [
  [
    InvalidReportRangeError,
    { status: 422, code: 'INVALID_REPORT_RANGE', title: 'Rango de fechas invalido' },
  ],
];
