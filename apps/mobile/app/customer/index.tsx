// Feature "customer/index" ("Mis reservas") - docs/06-CONVENCIONES-FRONTEND.md SS2. Fase 5
// cliente-autogestion (docs/persistence/10-DECISIONES.md #109).
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';

import type { ReservationSummary } from '@frontend/domain-types';
import { useCustomerAuth, useMyReservations } from '@frontend/data-access';
import { Button, LoadingSpinner, Screen } from '@frontend/ui-kit-mobile';

function ReservationRow({
  reservation,
  onPress,
}: {
  reservation: ReservationSummary;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.row}
      testID={`my-reservation-${reservation.id}`}
    >
      <Text style={styles.rowId}>#{reservation.id.slice(0, 8)}</Text>
      <Text style={styles.rowDates}>
        {new Date(reservation.startDate).toLocaleDateString()} -{' '}
        {new Date(reservation.endDate).toLocaleDateString()}
      </Text>
      <Text style={styles.rowStatus}>{reservation.status}</Text>
    </Pressable>
  );
}

export default function CustomerHome() {
  const { logout } = useCustomerAuth();
  const myReservations = useMyReservations();

  return (
    <Screen testID="customer-home-screen">
      <Text testID="heading" role="heading" style={styles.heading}>
        Mis reservas
      </Text>

      {myReservations.isLoading ? (
        <LoadingSpinner />
      ) : !myReservations.data || myReservations.data.length === 0 ? (
        <Text style={styles.emptyText}>Todavía no tenés reservas.</Text>
      ) : (
        <FlatList
          data={myReservations.data}
          keyExtractor={(reservation) => reservation.id}
          renderItem={({ item }) => (
            <ReservationRow
              reservation={item}
              onPress={() => router.push(`/customer/reservations/${item.id}`)}
            />
          )}
        />
      )}

      <Button
        label="Nueva reserva"
        onPress={() => router.push('/customer/vehicles/search')}
        testID="customer-new-reservation"
      />
      <Button
        label="Cerrar sesión"
        variant="danger"
        onPress={() => void logout()}
        testID="customer-logout"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 16,
  },
  emptyText: {
    color: '#6B6B6B',
    marginBottom: 16,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#D9D9D9',
  },
  rowId: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowDates: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  rowStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
});
