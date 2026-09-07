// Feature "check-out" - docs/06-CONVENCIONES-FRONTEND.md SS2. Fase 5 (operador de sucursal,
// docs/persistence/10-DECISIONES.md #108). react-hook-form + zod (SS9), schema espeja
// CheckOutReservationRequest salvo photoFileIds/inspectedBy (se completan en submit, no son
// campos de formulario).
//
// PhotoPicker es 100% presentacional (docs/technical/01-MONOREPO.md SS4-5, type:ui no
// conoce dominio) - la orquestacion real vive aca: onPick sube la foto de inmediato
// (useUploadPhoto) y solo agrega el fileId resultante a photoFileIds cuando el upload
// termina, no antes.
import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, StyleSheet } from 'react-native';
import { z } from 'zod';

import { ApiError, useAuth, useCheckOutReservation, useUploadPhoto } from '@frontend/data-access';
import { Button, PhotoPicker, Screen, TextField } from '@frontend/ui-kit-mobile';

const checkOutSchema = z.object({
  odometer: z.coerce.number().min(0, 'El odometro no puede ser negativo.'),
  fuelLevelPercentage: z.coerce
    .number()
    .min(0, 'El nivel de combustible debe estar entre 0 y 100.')
    .max(100, 'El nivel de combustible debe estar entre 0 y 100.'),
});

type CheckOutFormValues = z.infer<typeof checkOutSchema>;

export default function CheckOut() {
  const { id: reservationId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const checkOutReservation = useCheckOutReservation();
  const uploadPhoto = useUploadPhoto();
  const [photos, setPhotos] = useState<{ uri: string; fileId: string }[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CheckOutFormValues>({
    resolver: zodResolver(checkOutSchema),
    defaultValues: { odometer: 0, fuelLevelPercentage: 100 },
  });

  const handlePickPhoto = async (uri: string) => {
    const fileId = await uploadPhoto.mutateAsync(uri);
    setPhotos((current) => [...current, { uri, fileId }]);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((current) => current.filter((_, i) => i !== index));
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!user) {
      return;
    }
    setSubmitError(null);
    try {
      await checkOutReservation.mutateAsync({
        reservationId,
        body: {
          odometer: values.odometer,
          fuelLevelPercentage: values.fuelLevelPercentage,
          photoFileIds: photos.map((photo) => photo.fileId),
          inspectedBy: user.sub,
        },
      });
      router.replace('/');
    } catch (error) {
      setSubmitError(
        error instanceof ApiError
          ? error.message
          : 'No se pudo registrar el retiro. Intenta de nuevo.',
      );
    }
  });

  return (
    <Screen scrollable testID="check-out-screen">
      <Text role="heading" style={styles.heading}>
        Retiro de vehículo
      </Text>

      <Controller
        control={control}
        name="odometer"
        render={({ field }) => (
          <TextField
            label="Odómetro (km)"
            value={String(field.value)}
            onChangeText={field.onChange}
            keyboardType="numeric"
            errorMessage={errors.odometer?.message}
            testID="check-out-odometer"
          />
        )}
      />
      <Controller
        control={control}
        name="fuelLevelPercentage"
        render={({ field }) => (
          <TextField
            label="Combustible (%)"
            value={String(field.value)}
            onChangeText={field.onChange}
            keyboardType="numeric"
            errorMessage={errors.fuelLevelPercentage?.message}
            testID="check-out-fuel"
          />
        )}
      />

      <PhotoPicker
        uris={photos.map((photo) => photo.uri)}
        onPick={(uri) => void handlePickPhoto(uri)}
        onRemove={handleRemovePhoto}
        testID="check-out-photos"
      />

      {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

      <Button
        label="Confirmar retiro"
        onPress={() => void onSubmit()}
        loading={isSubmitting}
        testID="check-out-submit"
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
  // #D92D20 = colors.danger de ui-kit-core (literal, no importado directo - esta capa solo
  // puede pasar por ui-kit-mobile, que no re-exporta tokens crudos).
  errorText: {
    color: '#D92D20',
    marginBottom: 16,
  },
});
