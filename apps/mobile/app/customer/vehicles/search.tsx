// Feature "customer/vehicles/search" - docs/06-CONVENCIONES-FRONTEND.md SS2. Cierra el gap
// aceptado en customer/reservations/new.tsx (docs/persistence/10-DECISIONES.md #109/#116):
// el cliente elegia el vehiculo tipeando un UUID a mano. Primer punto de entrada real desde
// customer/index.tsx hacia reservations/new.tsx (docs/persistence/10-DECISIONES.md #123) -
// flujo forward-only (expo-router no tiene mecanismo de "devolver resultado a la pantalla
// anterior" en este repo, confirmado): al elegir un vehiculo se empuja HACIA ADELANTE a
// reservations/new.tsx con los 3 campos como route params, mismo mecanismo que
// login-phone.tsx -> login-otp.tsx. El link "Ingresar ID manualmente" preserva la via de
// escape sin params, tambien forward-only.
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, StyleSheet } from 'react-native';

import type { VehicleSummary } from '@frontend/domain-types';
import { useSearchAvailableVehicles } from '@frontend/data-access';
import { Button, LoadingSpinner, Screen, TextField } from '@frontend/ui-kit-mobile';

function VehicleRow({ vehicle, onPress }: { vehicle: VehicleSummary; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.row}
      testID={`vehicle-${vehicle.id}`}
    >
      <Text style={styles.rowTitle}>{vehicle.vehicleCategory?.name ?? 'Vehículo'}</Text>
      <Text style={styles.rowSubtitle}>{vehicle.licensePlate}</Text>
    </Pressable>
  );
}

export default function SearchVehicles() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const search = useSearchAvailableVehicles(startDate, endDate);

  const onSelect = (vehicle: VehicleSummary) => {
    router.push({
      pathname: '/customer/reservations/new',
      params: { vehicleId: vehicle.id, startDate, endDate },
    });
  };

  return (
    <Screen scrollable testID="vehicle-search-screen">
      <Text role="heading" style={styles.heading}>
        Buscar vehículo
      </Text>

      <TextField
        label="Fecha de inicio (ISO 8601)"
        value={startDate}
        onChangeText={setStartDate}
        placeholder="2026-09-01T10:00:00.000Z"
        testID="vehicle-search-start-date"
      />
      <TextField
        label="Fecha de fin (ISO 8601)"
        value={endDate}
        onChangeText={setEndDate}
        placeholder="2026-09-04T10:00:00.000Z"
        testID="vehicle-search-end-date"
      />

      {search.isLoading ? (
        <LoadingSpinner />
      ) : !search.data ? null : search.data.length === 0 ? (
        <Text style={styles.emptyText}>No hay vehículos disponibles en ese rango.</Text>
      ) : (
        <FlatList
          data={search.data}
          keyExtractor={(vehicle) => vehicle.id}
          renderItem={({ item }) => <VehicleRow vehicle={item} onPress={() => onSelect(item)} />}
        />
      )}

      <Button
        label="Ingresar ID manualmente"
        onPress={() => router.push('/customer/reservations/new')}
        testID="vehicle-search-manual-entry"
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
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 14,
    color: '#6B6B6B',
  },
});
