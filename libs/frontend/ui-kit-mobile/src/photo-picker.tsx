// Presentacional + interaccion nativa generica (camara/galeria) - sin conocer dominio
// (docs/technical/01-MONOREPO.md SS4-5: type:ui solo puede depender de otro type:ui, ni
// siquiera domain-types esta permitido - "un boton no sabe de reservas"). Las URIs
// resultantes se pasan hacia arriba via onPick(); que esas fotos sean "de inspeccion de
// vehiculo" lo sabe la pantalla que usa este componente (app/reservations/[id]/
// check-out.tsx), nunca este archivo.
import { useCallback } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { colors, radius, spacing, typography } from '@frontend/ui-kit-core';

export interface PhotoPickerProps {
  uris: string[];
  onPick: (uri: string) => void;
  onRemove: (index: number) => void;
  testID?: string;
}

export function PhotoPicker({ uris, onPick, onRemove, testID }: PhotoPickerProps) {
  const handlePick = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      onPick(result.assets[0].uri);
    }
  }, [onPick]);

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.thumbnails}>
        {uris.map((uri, index) => (
          <View key={uri} style={styles.thumbnailWrapper}>
            <Image source={{ uri }} style={styles.thumbnail} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Quitar foto ${index + 1}`}
              onPress={() => onRemove(index)}
              style={styles.removeButton}
            >
              <Text style={styles.removeButtonText}>×</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => void handlePick()}
        style={styles.addButton}
      >
        <Text style={styles.addButtonText}>+ Agregar foto</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  thumbnails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  thumbnailWrapper: {
    position: 'relative',
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: colors.primaryText,
    fontSize: 14,
    lineHeight: 14,
  },
  addButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  addButtonText: {
    color: colors.primary,
    fontSize: typography.body.fontSize,
  },
});
