import { render } from '@testing-library/react-native';

import Index from '../app/index';

// Vive fuera de app/ para que Expo Router no lo trate como una ruta (docs/06-CONVENCIONES-
// FRONTEND.md SS4) - mismo patron que apps/web-admin/specs/.
test('renders correctly', () => {
  const { getByTestId } = render(<Index />);
  expect(getByTestId('heading')).toHaveTextContent(/Renta/);
});
