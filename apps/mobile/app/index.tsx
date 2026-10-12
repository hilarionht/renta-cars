// Fase 5 (operador de sucursal, docs/persistence/10-DECISIONES.md #108) - reemplaza el
// placeholder "Renta" del bootstrap. 2 listas (para retirar/para devolver), tap navega al
// flujo de check-out/check-in de esa reserva.
//
// Sin nombre de customer/vehicle en ReservationSummary (solo IDs, docs/contracts/
// 02-RESOURCE-CATALOG.md) - se muestra el id truncado + fechas + monto, lo unico
// disponible sin un endpoint de enriquecimiento que no existe todavia (gap conocido, no
// resuelto en esta tanda).
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ReservationSummary } from '@frontend/domain-types';
import {
  useAuth,
  useReservationsToCheckIn,
  useReservationsToCheckOut,
} from '@frontend/data-access';
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
      testID={`reservation-${reservation.id}`}
    >
      <Text style={styles.rowId}>#{reservation.id.slice(0, 8)}</Text>
      <Text style={styles.rowDates}>
        {new Date(reservation.startDate).toLocaleDateString()} -{' '}
        {new Date(reservation.endDate).toLocaleDateString()}
      </Text>
    </Pressable>
  );
}

function ReservationSection({
  title,
  emptyLabel,
  reservations,
  isLoading,
  onPressReservation,
  testID,
}: {
  title: string;
  emptyLabel: string;
  reservations: ReservationSummary[] | undefined;
  isLoading: boolean;
  onPressReservation: (id: string) => void;
  testID: string;
}) {
  return (
    <View style={styles.section} testID={testID}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {isLoading ? (
        <LoadingSpinner />
      ) : !reservations || reservations.length === 0 ? (
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      ) : (
        <FlatList
          data={reservations}
          keyExtractor={(reservation) => reservation.id}
          renderItem={({ item }) => (
            <ReservationRow reservation={item} onPress={() => onPressReservation(item.id)} />
          )}
        />
      )}
    </View>
  );
}

export default function Index() {
  const { logout } = useAuth();
  const toCheckOut = useReservationsToCheckOut();
  const toCheckIn = useReservationsToCheckIn();

  return (
    <Screen testID="home-screen">
      <Text testID="heading" role="heading" style={styles.heading}>
        Renta
      </Text>

      <ReservationSection
        title="Para retirar"
        emptyLabel="No hay reservas para retirar."
        reservations={toCheckOut.data}
        isLoading={toCheckOut.isLoading}
        onPressReservation={(id) => router.push(`/reservations/${id}/check-out`)}
        testID="section-check-out"
      />

      <ReservationSection
        title="Para devolver"
        emptyLabel="No hay reservas para devolver."
        reservations={toCheckIn.data}
        isLoading={toCheckIn.isLoading}
        onPressReservation={(id) => router.push(`/reservations/${id}/check-in`)}
        testID="section-check-in"
      />

      <Button label="Cerrar sesión" variant="danger" onPress={() => void logout()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    color: '#6B6B6B',
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
});
