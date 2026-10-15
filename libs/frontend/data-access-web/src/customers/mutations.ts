'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type {
  BlockCustomerRequest,
  RegisterAdditionalDriverRequest,
  RegisterCustomerRequest,
  UpdateCustomerRequest,
  UploadIdentityDocumentRequest,
} from '@frontend/domain-types';

import { useWebAuth } from '../auth-context';
import { CUSTOMERS_QUERY_KEY } from './queries';

// docs/persistence/10-DECISIONES.md #139. Mismo criterio que fleet/mutations.ts: cada accion
// invalida tambien ante error (un 409 recarga el estado real). Invalida ademas las reservas:
// el listado y el detalle muestran al cliente.
export type CustomerActionInput =
  | { action: 'block'; body: BlockCustomerRequest }
  | { action: 'unblock' }
  | { action: 'identity-documents'; body: UploadIdentityDocumentRequest }
  | { action: 'verify-document'; documentId: string }
  | { action: 'additional-drivers'; body: RegisterAdditionalDriverRequest }
  | { action: 'validate-license'; driverId: string }
  | { action: 'revoke-driver'; driverId: string };

export type CustomerAction = CustomerActionInput['action'];

export function customerActionPath(customerId: string, input: CustomerActionInput): string {
  const base = `/api/v1/customers/${customerId}`;
  switch (input.action) {
    case 'verify-document':
      return `${base}/identity-documents/${input.documentId}/verify`;
    case 'validate-license':
      return `${base}/additional-drivers/${input.driverId}/validate-license`;
    case 'revoke-driver':
      return `${base}/additional-drivers/${input.driverId}/revoke`;
    default:
      return `${base}/${input.action}`;
  }
}

function useInvalidateCustomers() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ['reservations'] }),
    ]);
}

export function useCustomerAction(customerId: string) {
  const { api } = useWebAuth();
  const invalidate = useInvalidateCustomers();
  return useMutation({
    mutationFn: (input: CustomerActionInput) =>
      api.request<unknown>(customerActionPath(customerId, input), {
        method: 'POST',
        body: 'body' in input ? input.body : undefined,
      }),
    onSettled: invalidate,
  });
}

export function useUpdateCustomer(customerId: string) {
  const { api } = useWebAuth();
  const invalidate = useInvalidateCustomers();
  return useMutation({
    mutationFn: (body: UpdateCustomerRequest) =>
      api.request<unknown>(`/api/v1/customers/${customerId}`, { method: 'PATCH', body }),
    onSettled: invalidate,
  });
}

export function useRegisterCustomer() {
  const { api } = useWebAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RegisterCustomerRequest) =>
      api.request<{ id: string }>('/api/v1/customers', { method: 'POST', body }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY }),
  });
}
