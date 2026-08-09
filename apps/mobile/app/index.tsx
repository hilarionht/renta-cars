import { StyleSheet, Text, View } from 'react-native';

// Pantalla raiz minima del bootstrap (docs/engineering/10-BOOTSTRAP-PLAN.md, paso 13) -
// sin logica de negocio real todavia (Identity no existe hasta Fase 0). La primera feature
// de prueba real vive en app/login/, generada con `generate:feature`.
export default function Index() {
  return (
    <View style={styles.container}>
      <Text testID="heading" role="heading">
        Renta
      </Text>
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
