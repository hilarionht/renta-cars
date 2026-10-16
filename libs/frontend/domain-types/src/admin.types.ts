// Tipos de la web de administracion, modulo Administracion (docs/persistence/10-DECISIONES.md
// #140). Escritos a mano y verificados contra el backend:
//   - libs/platform/{users,roles-permissions,branches,companies,settings,audit}/infrastructure/
//     src/http/dto/*.ts (requests y respuestas).
// Sucursales: BranchSummary (staff-reservation.types.ts, #135).
import type { BranchSummary } from './staff-reservation.types';

export type UserStatus = 'Active' | 'Disabled';

// GET /users y /users/:id. roles: ids (el nombre sale de GET /roles).
export interface StaffUser {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  roles: string[];
  branchId?: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  roles: string[];
  branchId?: string;
}

// PATCH /users/:id. branchId null le quita la sucursal; el email no se edita.
export interface UpdateUserRequest {
  name?: string;
  branchId?: string | null;
}

export interface DisableUserRequest {
  reason?: string;
}

export interface ChangePasswordRequest {
  newPassword: string;
}

export interface RoleAssignmentRequest {
  roleId: string;
}

export type RoleScope = 'System' | 'Custom';
export type RoleStatus = 'Active' | 'Inactive';

// GET /roles: los Custom de la company y los System (globales, inmutables).
export interface Role {
  id: string;
  roleName: string;
  scope: RoleScope;
  status: RoleStatus;
  permissions: string[];
}

// GET /permissions: catalogo de claves "modulo:accion".
export interface PermissionKey {
  key: string;
}

export interface CreateRoleRequest {
  roleName: string;
  permissions: string[];
}

export interface EditRolePermissionsRequest {
  permissions: string[];
}

export type BranchAddress = BranchSummary['address'];
export type DaySchedule = BranchSummary['operatingHours'][number];

export interface CreateBranchRequest {
  name: string;
  address: BranchAddress;
  operatingHours: DaySchedule[];
  timeZone?: string;
}

export type UpdateBranchRequest = Partial<CreateBranchRequest>;

// GET /companies: la company del token.
export interface Company {
  id: string;
  legalName: string;
  taxId: string;
  billingContactEmail: string;
  billingContactPhone?: string;
  status: string;
}

export interface UpdateCompanyRequest {
  legalName?: string;
  billingContactEmail?: string;
  billingContactPhone?: string;
}

export interface CancellationPolicyTier {
  minHoursBeforeStart: number;
  penaltyPercentage: number;
}

// GET /company-settings.
export interface CompanySettings {
  companyId: string;
  enabledProductModules: string[];
  paymentMethodsEnabled: string[];
  cancellationPolicyTiers: CancellationPolicyTier[];
  lateReturnGraceMinutes: number;
  lateReturnPenaltyPercentagePerHour: number;
  depositApplies: boolean;
  depositPercentageOfTotal: number;
  draftExpirationMinutes: number;
  minimumBookingLeadTimeMinutes: number;
  reminderLeadTimeMinutes: number;
  notificationChannelPreference: string;
  maintenanceThresholdApplies: boolean;
  maintenanceThresholdOdometerKm?: number;
  maintenanceThresholdDays?: number;
}

// PATCH /company-settings/<politica>: cada politica con su cuerpo.
export interface SettingsPolicyRequests {
  'payment-methods-enabled': { paymentMethodsEnabled: string[] };
  'cancellation-policy': { tiers: CancellationPolicyTier[] };
  'late-return-policy': { graceMinutes: number; penaltyPercentagePerHour: number };
  'deposit-policy': { applies: boolean; percentageOfTotal: number };
  'draft-expiration-policy': { expirationMinutes: number };
  'minimum-booking-lead-time': { leadTimeMinutes: number };
  'reminder-lead-time': { leadTimeMinutes: number };
  'notification-channel-preference': { preferredChannel: string };
  'maintenance-threshold-policy': {
    applies: boolean;
    odometerThresholdKm?: number;
    daysThreshold?: number;
  };
}

export type SettingsPolicy = keyof SettingsPolicyRequests;

// GET /audit-log (paginado por cursor, #140).
export interface AuditLogEntry {
  id: string;
  actorRef: string;
  action: string;
  subjectType: string;
  subjectId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}
