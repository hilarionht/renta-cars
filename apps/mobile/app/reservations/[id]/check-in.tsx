// Feature "check-in" - docs/06-CONVENCIONES-FRONTEND.md SS2. Fase 5 (operador de sucursal,
// docs/persistence/10-DECISIONES.md #108). Mismo patron que check-out.tsx (react-hook-form +
// zod, orquestacion de upload en la pantalla) mas la lista opcional de danos
// (useFieldArray) - cada dano tiene su propio PhotoPicker, con un estado local paralelo
// (damagePhotoUris) para el preview: photoFileIds en el form solo guarda ids ya subidos,
// PhotoPicker necesita las URIs locales para mostrar la miniatura.
import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { ApiError, useAuth, useCheckInReservation, useUploadPhoto } from '@frontend/data-access';
import { Button, PhotoPicker, Screen, TextField } from '@frontend/ui-kit-mobile';

const damageSchema = z.object({
  description: z.string().min(1, 'La descripción es obligatoria.'),
  severity: z.enum(['Minor', 'Severe']),
  imputableToCustomer: z.boolean(),
  photoFileIds: z.array(z.string()),
  penaltyAmountMinorUnits: z.coerce.number().min(0).optional(),
});

const checkInSchema = z.object({
  odometer: z.coerce.number().min(0, 'El odómetro no puede ser negativo.'),
  fuelLevelPercentage: z.coerce
    .number()
    .min(0, 'El nivel de combustible debe estar entre 0 y 100.')
    .max(100, 'El nivel de combustible debe estar entre 0 y 100.'),
  damages: z.array(damageSchema),
});

type CheckInFormValues = z.infer<typeof checkInSchema>;

export default function CheckIn() {
  const { id: reservationId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const checkInReservation = useCheckInReservation();
  const uploadPhoto = useUploadPhoto();
  const [photos, setPhotos] = useState<{ uri: string; fileId: string }[]>([]);
  const [damagePhotoUris, setDamagePhotoUris] = useState<Record<number, string[]>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CheckInFormValues>({
    resolver: zodResolver(checkInSchema),
    defaultValues: { odometer: 0, fuelLevelPercentage: 100, damages: [] },
  });
  const { fields, append, remove, update } = useFieldArray({ control, name: 'damages' });

  const handlePickPhoto = async (uri: string) => {
    const fileId = await uploadPhoto.mutateAsync(uri);
    setPhotos((current) => [...current, { uri, fileId }]);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((current) => current.filter((_, i) => i !== index));
  };

  const handlePickDamagePhoto = async (
    damageIndex: number,
    uri: string,
    damage: CheckInFormValues['damages'][number],
  ) => {
    const fileId = await uploadPhoto.mutateAsync(uri);
    setDamagePhotoUris((current) => ({
      ...current,
      [damageIndex]: [...(current[damageIndex] ?? []), uri],
    }));
    update(damageIndex, { ...damage, photoFileIds: [...damage.photoFileIds, fileId] });
  };

  const handleRemoveDamagePhoto = (
    damageIndex: number,
    photoIndex: number,
    damage: CheckInFormValues['damages'][number],
  ) => {
    setDamagePhotoUris((current) => ({
      ...current,
      [damageIndex]: (current[damageIndex] ?? []).filter((_, i) => i !== photoIndex),
    }));
    update(damageIndex, {
      ...damage,
      photoFileIds: damage.photoFileIds.filter((_, i) => i !== photoIndex),
    });
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!user) {
      return;
    }
    setSubmitError(null);
    try {
      await checkInReservation.mutateAsync({
        reservationId,
        body: {
          odometer: values.odometer,
          fuelLevelPercentage: values.fuelLevelPercentage,
          photoFileIds: photos.map((photo) => photo.fileId),
          inspectedBy: user.sub,
          damages: values.damages.length > 0 ? values.damages : undefined,
        },
      });
      router.replace('/');
    } catch (error) {
      setSubmitError(
        error instanceof ApiError
          ? error.message
          : 'No se pudo registrar la devolución. Intenta de nuevo.',
      );
    }
  });

  return (
    <Screen scrollable testID="check-in-screen">
      <Text role="heading" style={styles.heading}>
        Devolución de vehículo
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
            testID="check-in-odometer"
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
            testID="check-in-fuel"
          />
        )}
      />

      <PhotoPicker
        uris={photos.map((photo) => photo.uri)}
        onPick={(uri) => void handlePickPhoto(uri)}
        onRemove={handleRemovePhoto}
        testID="check-in-photos"
      />

      <Text style={styles.sectionTitle}>Daños</Text>
      {fields.map((field, index) => (
        <View key={field.id} style={styles.damageRow} testID={`damage-${index}`}>
          <Controller
            control={control}
            name={`damages.${index}.description`}
            render={({ field: descriptionField }) => (
              <TextField
                label="Descripción del daño"
                value={descriptionField.value}
                onChangeText={descriptionField.onChange}
                errorMessage={errors.damages?.[index]?.description?.message}
                testID={`damage-${index}-description`}
              />
            )}
          />
          <Controller
            control={control}
            name={`damages.${index}.severity`}
            render={({ field: severityField }) => (
              <View style={styles.severityRow}>
                <Button
                  label="Menor"
                  variant={severityField.value === 'Minor' ? 'primary' : 'danger'}
                  onPress={() => severityField.onChange('Minor')}
                  testID={`damage-${index}-severity-minor`}
                />
                <Button
                  label="Grave"
                  variant={severityField.value === 'Severe' ? 'primary' : 'danger'}
                  onPress={() => severityField.onChange('Severe')}
                  testID={`damage-${index}-severity-severe`}
                />
              </View>
            )}
          />
          <Controller
            control={control}
            name={`damages.${index}.imputableToCustomer`}
            render={({ field: imputableField }) => (
              <Button
                label={
                  imputableField.value ? 'Imputable al cliente: sí' : 'Imputable al cliente: no'
                }
                onPress={() => imputableField.onChange(!imputableField.value)}
                testID={`damage-${index}-imputable`}
              />
            )}
          />
          <PhotoPicker
            uris={damagePhotoUris[index] ?? []}
            onPick={(uri) => void handlePickDamagePhoto(index, uri, field)}
            onRemove={(photoIndex) => handleRemoveDamagePhoto(index, photoIndex, field)}
            testID={`damage-${index}-photos`}
          />
          <Button
            label="Quitar daño"
            variant="danger"
            onPress={() => remove(index)}
            testID={`damage-${index}-remove`}
          />
        </View>
      ))}
      <Button
        label="+ Agregar daño"
        onPress={() =>
          append({
            description: '',
            severity: 'Minor',
            imputableToCustomer: false,
            photoFileIds: [],
          })
        }
        testID="damage-add"
      />

      {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

      <Button
        label="Confirmar devolución"
        onPress={() => void onSubmit()}
        loading={isSubmitting}
        testID="check-in-submit"
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 8,
  },
  damageRow: {
    borderWidth: 1,
    borderColor: '#D9D9D9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  // #D92D20 = colors.danger de ui-kit-core (literal, no importado directo - esta capa solo
  // puede pasar por ui-kit-mobile, que no re-exporta tokens crudos).
  errorText: {
    color: '#D92D20',
    marginBottom: 16,
  },
});
