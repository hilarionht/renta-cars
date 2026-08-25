// docs/07-DESIGN-SYSTEM.md SS3 (Capa 2, Primitivas) - presentacional puro, sin conocer
// dominio (props genericas unicamente, ver comentario de cabecera del proyecto). Wrapea
// SafeAreaView + padding de tokens - toda pantalla de Fase 5 lo usa como contenedor raiz.
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@frontend/ui-kit-core';

export interface ScreenProps {
  children: ReactNode;
  scrollable?: boolean;
  testID?: string;
}

export function Screen({ children, scrollable = false, testID }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} testID={testID}>
      {scrollable ? (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {children}
        </ScrollView>
      ) : (
        <View style={styles.content}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: spacing.md,
  },
});
