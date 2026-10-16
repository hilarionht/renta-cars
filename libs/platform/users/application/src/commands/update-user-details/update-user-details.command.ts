export interface UpdateUserDetailsCommand {
  userId: string;
  companyId: string;
  name?: string;
  // null = quitarle la sucursal; undefined = no tocarla.
  branchId?: string | null;
}
