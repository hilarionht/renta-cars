// Presentacional puro - sin conocer dominio.
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@frontend/ui-kit-core';

export interface LoadingSpinnerProps {
  testID?: string;
}

export function LoadingSpinner({ testID }: LoadingSpinnerProps) {
  return (
    <View style={styles.container} testID={testID}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
