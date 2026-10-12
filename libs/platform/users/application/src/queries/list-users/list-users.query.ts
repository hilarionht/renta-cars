import type { UserSummary } from '../get-user/get-user.query';

// docs/persistence/10-DECISIONES.md #134: listado del personal de la company, paginado por
// cursor (mismo mecanismo que ListReservationsQuery, #112).
export interface ListUsersQuery {
  companyId: string;
  cursor?: string;
  limit?: number;
}

export interface ListUsersResult {
  items: UserSummary[];
  nextCursor: string | null;
  limit: number;
}
