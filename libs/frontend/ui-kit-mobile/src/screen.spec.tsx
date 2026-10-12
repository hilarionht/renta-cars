import { render, screen as rtlScreen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Screen } from './screen';

// Screen solo usa <SafeAreaView> (componente plano, no useSafeAreaInsets/useSafeAreaFrame)
// - no necesita el mock oficial de la libreria (pensado para las hooks que consumen un
// Context Provider), el entorno de jest-expo ya renderiza el componente real sin problema.

describe('Screen', () => {
  it('renderiza sus children', () => {
    render(
      <Screen testID="screen">
        <Text>Contenido</Text>
      </Screen>,
    );

    expect(rtlScreen.getByTestId('screen')).toBeTruthy();
    expect(rtlScreen.getByText('Contenido')).toBeTruthy();
  });

  it('renderiza sus children en modo scrollable', () => {
    render(
      <Screen testID="screen" scrollable>
        <Text>Contenido scrolleable</Text>
      </Screen>,
    );

    expect(rtlScreen.getByText('Contenido scrolleable')).toBeTruthy();
  });
});
