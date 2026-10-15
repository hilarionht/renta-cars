// @frontend/data-access-web - sesion del personal y permisos para la web de administracion
// (Next.js). Solo navegador: todo lo que exporta es 'use client'. docs/persistence/
// 10-DECISIONES.md #134.
export {
  WebAuthProvider,
  useWebAuth,
  type AuthStatus,
  type LoginInput,
  type LoginResult,
} from './auth-context';
export {
  Can,
  CURRENT_USER_QUERY_KEY,
  buildPermissions,
  useCurrentUser,
  usePermissions,
  type Permissions,
} from './current-user';
export { createRefreshCoordinator } from './refresh-coordinator';
export {
  SESSION_INDICATOR_COOKIE,
  clearSessionIndicator,
  hasSessionIndicator,
  markSessionActive,
} from './session-indicator';
export {
  RESERVATIONS_QUERY_KEY,
  reservationQueryKey,
  useAvailableVehicles,
  useBranchTimeZones,
  useBranches,
  useCustomerSearch,
  useReservation,
  useReservationInvoices,
  useReservations,
  type AvailabilitySearch,
  type ReservationFilters,
} from './reservations/queries';
export {
  useCreateReservation,
  useReservationAction,
  type ReservationAction,
  type ReservationActionInput,
} from './reservations/mutations';
export {
  VEHICLES_QUERY_KEY,
  VEHICLE_CATEGORIES_QUERY_KEY,
  useVehicle,
  useVehicleCategories,
  useVehicleCategory,
  useVehicles,
  vehicleCategoryQueryKey,
  vehicleQueryKey,
} from './fleet/queries';
export {
  useAddRate,
  useCreateVehicleCategory,
  useRegisterVehicle,
  useVehicleAction,
  vehicleActionPath,
  type VehicleAction,
  type VehicleActionInput,
} from './fleet/mutations';
export {
  CUSTOMERS_QUERY_KEY,
  customerQueryKey,
  useCustomer,
  useCustomerActiveReservations,
  useCustomers,
} from './customers/queries';
export {
  customerActionPath,
  useCustomerAction,
  useRegisterCustomer,
  useUpdateCustomer,
  type CustomerAction,
  type CustomerActionInput,
} from './customers/mutations';
export {
  UPLOAD_ALLOWED_TYPES,
  UPLOAD_MAX_BYTES,
  UploadValidationError,
  useFileSignedUrl,
  useUploadFile,
  validateUploadFile,
} from './files/use-upload-file';
