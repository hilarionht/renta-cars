// Feature "login" de "mobile" - docs/06-CONVENCIONES-FRONTEND.md SS2.
// Regla de dependencia: esta feature -> @frontend/data-access + ui-kit -> @frontend/domain-types.
// Nunca al reves, y nunca importa '@frontend/ui-kit-core' directamente (solo la variante de plataforma).
//
// Pantalla minima del bootstrap (docs/engineering/10-BOOTSTRAP-PLAN.md, paso 13) - sin
// logica de negocio real todavia (Identity no existe hasta Fase 0). fetch nativo de React
// Native no aplica CORS (no hay same-origin policy fuera del navegador). Cuando exista
// @frontend/data-access real, este fetch directo se reemplaza por su hook correspondiente.
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type ApiStatus = 'loading' | 'ok' | 'error';

export default function Login() {
  const [status, setStatus] = useState<ApiStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    fetch(`${process.env.EXPO_PUBLIC_API_URL}/health/ready`)
      .then((response) => {
        if (!cancelled) {
          setStatus(response.ok ? 'ok' : 'error');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text role="heading">Iniciar sesión</Text>
      <Text testID="api-status">Estado de la API: {status}</Text>
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
