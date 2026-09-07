// Feature "customer/reservations/[id]" - docs/06-CONVENCIONES-FRONTEND.md SS2. Fase 5
// cliente-autogestion (docs/persistence/10-DECISIONES.md #109). "Cancelar" solo visible para
// Draft/Confirmed - Reservation.cancel() (dominio) tira ReservationInvalidStateTransitionError
// para cualquier otro estado, confirmado leyendo libs/products/rental/reservations/domain.
// Label de Draft explicito ("Borrador - pendiente de confirmacion") - una reserva creada por
// el cliente no esta garantizada hasta que un operador la confirme, no debe leerse como ya
// asegurada.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { ApiError, useCancelMyReservation, useMyReservation } from '@frontend/data-access';
import { Button, LoadingSpinner, Screen } from '@frontend/ui-kit-mobile';

const CANCELLABLE_STATUSES = ['Draft', 'Confirmed'];

const STATUS_LABELS: Record<string, string> = {
  Draft: 'Borrador — pendiente de confirmación',
  Confirmed: 'Confirmada',
  CheckedOut: 'Vehículo entregado',
  CheckedIn: 'Vehículo devuelto',
  Closed: 'Cerrada',
  Cancelled: 'Cancelada',
  NoShow: 'No presentado',
};

export default function MyReservationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reservation = useMyReservation(id);
  const cancelReservation = useCancelMyReservation();
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const onCancel = async () => {
    setCancelError(null);
    setIsCancelling(true);
    try {
      await cancelReservation.mutateAsync(id);
      router.replace('/customer');
    } catch (error) {
      setCancelError(error instanceof ApiError ? error.message : 'No se pudo cancelar la reserva.');
    } finally {
      setIsCancelling(false);
    }
  };

  if (reservation.isLoading) {
    return <LoadingSpinner testID="my-reservation-detail-loading" />;
  }

  if (!reservation.data) {
    return (
      <Screen testID="my-reservation-detail-screen">
        <Text style={styles.errorText}>No se encontró la reserva.</Text>
      </Screen>
    );
  }

  const { data } = reservation;
  const canCancel = CANCELLABLE_STATUSES.includes(data.status);

  return (
    <Screen testID="my-reservation-detail-screen">
      <Text role="heading" style={styles.heading}>
        Reserva #{data.id.slice(0, 8)}
      </Text>
      <Text style={styles.status}>{STATUS_LABELS[data.status] ?? data.status}</Text>
      <Text style={styles.detailLine}>
        {new Date(data.startDate).toLocaleDateString()} -{' '}
        {new Date(data.endDate).toLocaleDateString()}
      </Text>
      <Text style={styles.detailLine}>
        Total: {(data.baseAmountMinorUnits / 100).toFixed(2)} {data.currency}
      </Text>

      {cancelError ? <Text style={styles.errorText}>{cancelError}</Text> : null}

      {canCancel ? (
        <Button
          label="Cancelar reserva"
          variant="danger"
          onPress={() => void onCancel()}
          loading={isCancelling}
          testID="my-reservation-cancel"
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
  },
  status: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  detailLine: {
    fontSize: 14,
    color: '#6B6B6B',
    marginBottom: 8,
  },
  // #D92D20 = colors.danger de ui-kit-core, mismo literal documentado que login/index.tsx.
  errorText: {
    color: '#D92D20',
    marginBottom: 16,
  },
});
