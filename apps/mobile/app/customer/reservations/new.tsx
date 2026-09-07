// Feature "customer/reservations/new" - docs/06-CONVENCIONES-FRONTEND.md SS2. Fase 5
// cliente-autogestion (docs/persistence/10-DECISIONES.md #109). vehicleId sigue siendo un
// campo de texto editable (UUID) - desde #123, customer/vehicles/search.tsx es el punto de
// entrada normal y precompleta los 3 campos via route params (mismo mecanismo que
// login-otp.tsx), pero la edicion manual se conserva como via de escape explicita.
// POST /me/reservations devuelve solo {id}, nunca un ReservationSummary completo - se
// navega al detalle (que si hace su propio GET) al terminar.
import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, StyleSheet } from 'react-native';
import { z } from 'zod';

import { ApiError, useCreateMyReservation } from '@frontend/data-access';
import { Button, Screen, TextField } from '@frontend/ui-kit-mobile';

const newReservationSchema = z.object({
  vehicleId: z.string().uuid('vehicleId debe ser un UUID valido.'),
  startDate: z.string().min(1, 'Ingresa la fecha de inicio (ISO 8601).'),
  endDate: z.string().min(1, 'Ingresa la fecha de fin (ISO 8601).'),
});

type NewReservationFormValues = z.infer<typeof newReservationSchema>;

export default function NewMyReservation() {
  const params = useLocalSearchParams<{
    vehicleId?: string;
    startDate?: string;
    endDate?: string;
  }>();
  const createReservation = useCreateMyReservation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewReservationFormValues>({
    resolver: zodResolver(newReservationSchema),
    defaultValues: {
      vehicleId: params.vehicleId ?? '',
      startDate: params.startDate ?? '',
      endDate: params.endDate ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const result = await createReservation.mutateAsync(values);
      router.replace(`/customer/reservations/${result.id}`);
    } catch (error) {
      setSubmitError(
        error instanceof ApiError
          ? error.message
          : 'No se pudo crear la reserva. Intenta de nuevo.',
      );
    }
  });

  return (
    <Screen scrollable testID="customer-new-reservation-screen">
      <Text role="heading" style={styles.heading}>
        Nueva reserva
      </Text>

      <Controller
        control={control}
        name="vehicleId"
        render={({ field }) => (
          <TextField
            label="ID de vehículo"
            value={field.value}
            onChangeText={field.onChange}
            errorMessage={errors.vehicleId?.message}
            testID="new-reservation-vehicle-id"
          />
        )}
      />
      <Controller
        control={control}
        name="startDate"
        render={({ field }) => (
          <TextField
            label="Fecha de inicio (ISO 8601)"
            value={field.value}
            onChangeText={field.onChange}
            placeholder="2026-09-01T10:00:00.000Z"
            errorMessage={errors.startDate?.message}
            testID="new-reservation-start-date"
          />
        )}
      />
      <Controller
        control={control}
        name="endDate"
        render={({ field }) => (
          <TextField
            label="Fecha de fin (ISO 8601)"
            value={field.value}
            onChangeText={field.onChange}
            placeholder="2026-09-04T10:00:00.000Z"
            errorMessage={errors.endDate?.message}
            testID="new-reservation-end-date"
          />
        )}
      />

      {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

      <Button
        label="Crear reserva"
        onPress={() => void onSubmit()}
        loading={isSubmitting}
        testID="new-reservation-submit"
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
  // #D92D20 = colors.danger de ui-kit-core, mismo literal documentado que login/index.tsx.
  errorText: {
    color: '#D92D20',
    marginBottom: 16,
  },
});
